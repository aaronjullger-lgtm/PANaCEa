import React, { useEffect, useId, useMemo, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import {
  BrainCircuit,
  FileQuestion,
  GitCompareArrows,
  Image as ImageIcon,
  Lightbulb,
  ListChecks,
  Send,
  Sparkles,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react';
import type { DashboardContext } from '../../model/DashboardContext';
import { MedicalGlassCard } from '@/components/studypanacea';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { InlineSpinner } from '@/components/loading';
import { cn } from '@/lib/utils';

type TutorMessageRole = 'user' | 'model';

type TutorMessage = {
  id: string;
  role: TutorMessageRole;
  text: string;
};

type GroundingSource = {
  title: string;
  uri: string;
};

type TutorResponsePayload = {
  error?: string;
  reply?: string;
  sessionCacheName?: string;
  groundingSources?: GroundingSource[];
  data?: {
    reply?: string;
    sessionCacheName?: string;
    groundingSources?: GroundingSource[];
  };
};

export type AITutorDrawerSource =
  | 'dashboard'
  | 'study_prescription'
  | 'question_review'
  | 'clinical_image'
  | 'insight_rail';

export type AITutorDrawerContext = {
  source: AITutorDrawerSource;
  topic?: string;
  system?: string;
  result?: string;
  summary?: string;
  chips?: string[];
  isMock?: boolean;
};

type TutorActionId =
  | 'explain_concept'
  | 'why_wrong'
  | 'compare_diagnoses'
  | 'memory_hook'
  | 'similar_questions'
  | 'mini_study_plan'
  | 'clinical_image_pattern';

type ResolvedTutorContext = {
  source: AITutorDrawerSource;
  topic: string;
  system: string;
  result?: string;
  summary: string;
  chips: string[];
  isMock: boolean;
};

type TutorAction = {
  id: TutorActionId;
  label: string;
  description: string;
  icon: LucideIcon;
  buildPrompt: (context: ResolvedTutorContext) => string;
};

const tutorActions: TutorAction[] = [
  {
    id: 'explain_concept',
    label: 'Explain this concept',
    description: 'Break the topic into a high-yield PANCE reasoning frame.',
    icon: Stethoscope,
    buildPrompt: (context) =>
      `Explain ${context.topic} in ${context.system} for PANCE prep. Start with the core concept, then show the decision cues, common distractors, and one quick self-check question.`,
  },
  {
    id: 'why_wrong',
    label: 'Why was my answer wrong?',
    description: 'Analyze the missed or flagged reasoning pattern.',
    icon: FileQuestion,
    buildPrompt: (context) =>
      `Use this study context to explain why a learner might miss ${context.topic}: ${context.summary}. Focus on reasoning errors, distractors, and the next repair step. Do not discuss real patient diagnosis.`,
  },
  {
    id: 'compare_diagnoses',
    label: 'Compare two diagnoses',
    description: 'Create a tight contrast table for look-alike answer choices.',
    icon: GitCompareArrows,
    buildPrompt: (context) =>
      `Compare two commonly confused PANCE answer choices related to ${context.topic} in ${context.system}. Use columns for key clue, ruling feature, first test or next step when appropriate, and common trap.`,
  },
  {
    id: 'memory_hook',
    label: 'Make a memory hook',
    description: 'Generate a precise recall cue without gimmicky wording.',
    icon: Lightbulb,
    buildPrompt: (context) =>
      `Create a concise memory hook for ${context.topic}. Tie it to exam clues and explain exactly when the hook applies and when it does not.`,
  },
  {
    id: 'similar_questions',
    label: 'Generate similar practice questions',
    description: 'Draft short practice prompts for the same weak pattern.',
    icon: Sparkles,
    buildPrompt: (context) =>
      `Generate three brief PANCE-style practice prompts targeting ${context.topic}. Keep them educational, include the tested concept, and do not include real patient details.`,
  },
  {
    id: 'mini_study_plan',
    label: 'Create a mini study plan',
    description: 'Turn the context into a compact next-session plan.',
    icon: ListChecks,
    buildPrompt: (context) =>
      `Create a 15-minute mini study plan for ${context.topic} in ${context.system}. Include targeted review, one practice block, one recall check, and what success should look like by the end.`,
  },
  {
    id: 'clinical_image_pattern',
    label: 'Review this clinical image pattern',
    description: 'Use structured image-reading steps, not diagnosis claims.',
    icon: ImageIcon,
    buildPrompt: (context) =>
      `Review the clinical image learning pattern for ${context.topic}. Give a structured image-reading checklist, likely distractor categories, and a safe study-only explanation. Do not imply diagnosis for real patients.`,
  },
];

function formatLabel(raw: string | null | undefined): string {
  if (!raw) return 'Mixed clinical pattern';
  return raw
    .replace(/__/g, ' / ')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getDefaultSystem(context: DashboardContext): string {
  return formatLabel(context.matrix[0]?.label ?? context.raw.growthAreas[0]);
}

function getDefaultTopic(context: DashboardContext): string {
  return context.today.title || 'today\'s study prescription';
}

function buildResolvedContext(
  dashboardContext: DashboardContext,
  tutorContext: AITutorDrawerContext | null | undefined
): ResolvedTutorContext {
  const system = tutorContext?.system || getDefaultSystem(dashboardContext);
  const topic = tutorContext?.topic || getDefaultTopic(dashboardContext);
  const readiness = dashboardContext.readiness.available
    ? `${dashboardContext.readiness.points.at(-1) ?? 0}% readiness`
    : dashboardContext.goal.statusLabel;
  const chips = [
    tutorContext?.source === 'question_review' ? 'Question review' : null,
    tutorContext?.source === 'clinical_image' ? 'Clinical image lab' : null,
    tutorContext?.source === 'study_prescription' ? 'Study prescription' : null,
    system,
    readiness,
    tutorContext?.result,
    ...(tutorContext?.chips ?? []),
    tutorContext?.isMock ? 'Mock training signal' : null,
  ].filter((chip): chip is string => Boolean(chip));
  const summary =
    tutorContext?.summary ||
    `Current StudyPanacea target is ${getDefaultTopic(dashboardContext)} with ${system} as the leading context.`;

  return {
    source: tutorContext?.source ?? 'dashboard',
    topic,
    system,
    result: tutorContext?.result,
    summary,
    chips: Array.from(new Set(chips)).slice(0, 8),
    isMock: Boolean(tutorContext?.isMock),
  };
}

function buildWeakSpotOverride(context: ResolvedTutorContext, dashboardContext: DashboardContext): string {
  const growthAreas = dashboardContext.raw.growthAreas.map(formatLabel).slice(0, 4);
  return [
    'StudyPanacea dashboard context for educational PANCE tutoring:',
    `- Active source: ${context.source}`,
    `- Topic: ${context.topic}`,
    `- System: ${context.system}`,
    context.result ? `- Result/status: ${context.result}` : null,
    `- Context note: ${context.summary}`,
    growthAreas.length ? `- Current weak-area labels: ${growthAreas.join(', ')}` : null,
    context.isMock
      ? '- Some context is mock UI data; use it only as an example training signal.'
      : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function buildSafeMessage(prompt: string, context: ResolvedTutorContext): string {
  return [
    'Educational PANCE prep support only. Do not present yourself as a clinician, do not provide real patient diagnosis or treatment advice, and avoid unsupported medical claims.',
    `Dashboard context: ${context.system} / ${context.topic}. ${context.summary}`,
    context.isMock ? 'This context may include mock UI data; treat it as illustrative training context.' : null,
    prompt,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function sourceLabel(source: AITutorDrawerSource): string {
  switch (source) {
    case 'question_review':
      return 'Question review context';
    case 'clinical_image':
      return 'Clinical image context';
    case 'study_prescription':
      return 'Study prescription context';
    case 'insight_rail':
      return 'Insight rail context';
    default:
      return 'Dashboard context';
  }
}

export function AITutorDrawer({
  open,
  onOpenChange,
  context,
  tutorContext,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: DashboardContext;
  tutorContext?: AITutorDrawerContext | null;
}) {
  const { getToken } = useAuth();
  const promptId = useId();
  const resolvedContext = useMemo(
    () => buildResolvedContext(context, tutorContext),
    [context, tutorContext],
  );
  const [selectedActionId, setSelectedActionId] = useState<TutorActionId>('mini_study_plan');
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [sessionCacheName, setSessionCacheName] = useState<string | undefined>();
  const [groundingSources, setGroundingSources] = useState<GroundingSource[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const defaultAction =
      resolvedContext.source === 'clinical_image'
        ? tutorActions.find((action) => action.id === 'clinical_image_pattern')
        : resolvedContext.source === 'question_review'
          ? tutorActions.find((action) => action.id === 'why_wrong')
          : tutorActions.find((action) => action.id === 'mini_study_plan');

    const action = defaultAction ?? tutorActions[0];
    setSelectedActionId(action.id);
    setPrompt(action.buildPrompt(resolvedContext));
    setMessages([]);
    setSessionCacheName(undefined);
    setGroundingSources([]);
    setError(null);
  }, [open, resolvedContext]);

  const selectedAction = tutorActions.find((action) => action.id === selectedActionId) ?? tutorActions[0];
  const lastTutorMessage = [...messages].reverse().find((message) => message.role === 'model');

  const handleSelectAction = (action: TutorAction) => {
    setSelectedActionId(action.id);
    setPrompt(action.buildPrompt(resolvedContext));
    setError(null);
  };

  const handleSend = async () => {
    const trimmed = prompt.trim();
    if (!trimmed || isSending) return;

    setError(null);
    setIsSending(true);
    setGroundingSources([]);

    const userMessage: TutorMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: trimmed,
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);

    try {
      const token = await getToken();
      if (!token) {
        setError('Sign in is required to use the live tutor endpoint. The prompt starters remain available for planning.');
        setIsSending(false);
        return;
      }

      const response = await fetch('/api/ai/tutor/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: buildSafeMessage(trimmed, resolvedContext),
          history: nextMessages.slice(-6).map((message) => ({
            role: message.role,
            text: message.text,
          })),
          sessionCacheName,
          thinkingLevel: 'medium',
          maxTokens: 1400,
          weakSpotProfileOverride: buildWeakSpotOverride(resolvedContext, context),
        }),
      });

      const json = (await response.json()) as TutorResponsePayload;
      if (!response.ok) {
        setError(json.error || 'Tutor failed to respond. Please try again.');
        return;
      }

      const reply = json.reply ?? json.data?.reply;
      const cacheName = json.sessionCacheName ?? json.data?.sessionCacheName;
      const sources = json.groundingSources ?? json.data?.groundingSources ?? [];

      if (!reply) {
        setError('Tutor returned an empty response. Please try a more specific study prompt.');
        return;
      }

      if (cacheName) {
        setSessionCacheName(cacheName);
      }
      setGroundingSources(sources);
      setMessages((current) => [
        ...current,
        {
          id: `model-${Date.now()}`,
          role: 'model',
          text: reply,
        },
      ]);
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : 'Network error while contacting the tutor endpoint.',
      );
    } finally {
      setIsSending(false);
    }
  };

  const handlePromptKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void handleSend();
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="theme-diagnostic-atlas flex w-full flex-col overflow-hidden border-atlas-border bg-atlas-surface p-0 text-atlas-white sm:max-w-xl"
      >
        <div className="border-b border-atlas-border bg-[radial-gradient(circle_at_20%_0%,color-mix(in_srgb,var(--atlas-accent-cyan)_16%,transparent),transparent_32%)] px-5 pb-4 pt-6">
          <SheetHeader className="pr-8">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-atlas-border-glow bg-[color-mix(in_srgb,var(--atlas-accent-cyan)_12%,transparent)] text-atlas-cyan">
                <BrainCircuit className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <SheetTitle className="text-atlas-white">AI Tutor</SheetTitle>
                <SheetDescription className="text-atlas-muted">
                  Contextual PANCE study support for mistakes, weak areas, memory hooks, and image-reading patterns.
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>
          <MedicalGlassCard className="mt-4 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-atlas-border-glow bg-[color-mix(in_srgb,var(--atlas-accent-cyan)_10%,transparent)] px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-atlas-cyan">
                {sourceLabel(resolvedContext.source)}
              </span>
              {resolvedContext.chips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-atlas-border bg-atlas-glass px-2.5 py-1 text-xs text-atlas-muted"
                >
                  {chip}
                </span>
              ))}
            </div>
            <p className="mt-3 text-sm leading-6 text-atlas-muted">{resolvedContext.summary}</p>
          </MedicalGlassCard>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="space-y-5">
            <section aria-labelledby="ai-tutor-actions-title">
              <h3 id="ai-tutor-actions-title" className="text-sm font-semibold uppercase tracking-[0.14em] text-atlas-cyan">
                Tutor actions
              </h3>
              <div className="mt-3 grid gap-2">
                {tutorActions.map((action) => {
                  const Icon = action.icon;
                  const active = action.id === selectedActionId;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => handleSelectAction(action)}
                      aria-pressed={active}
                      className={cn(
                        'atlas-focus-ring group rounded-2xl border p-3 text-left transition-colors motion-reduce:transition-none',
                        active
                          ? 'border-atlas-border-glow bg-[color-mix(in_srgb,var(--atlas-accent-cyan)_10%,transparent)]'
                          : 'border-atlas-border bg-atlas-glass hover:border-atlas-border-glow',
                      )}
                    >
                      <span className="flex items-start gap-3">
                        <span className={cn(
                          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border',
                          active
                            ? 'border-atlas-border-glow text-atlas-cyan'
                            : 'border-atlas-border text-atlas-muted group-hover:text-atlas-white',
                        )}>
                          <Icon className="h-4 w-4" aria-hidden />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-atlas-white">{action.label}</span>
                          <span className="mt-1 block text-xs leading-5 text-atlas-muted">{action.description}</span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section aria-labelledby={promptId}>
              <div className="flex items-center justify-between gap-3">
                <h3 id={promptId} className="text-sm font-semibold uppercase tracking-[0.14em] text-atlas-cyan">
                  Prompt
                </h3>
                <span className="text-xs text-atlas-subtle">Cmd/Ctrl + Enter to send</span>
              </div>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={handlePromptKeyDown}
                rows={7}
                className="atlas-focus-ring mt-3 w-full resize-none rounded-2xl border border-atlas-border bg-[color-mix(in_srgb,var(--atlas-bg-soft)_82%,transparent)] px-4 py-3 text-sm leading-6 text-atlas-white placeholder:text-atlas-subtle"
                aria-label={`${selectedAction.label} prompt`}
              />
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-atlas-subtle">
                  Educational study support only. This panel does not diagnose real patients or replace clinical judgment.
                </p>
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={isSending || !prompt.trim()}
                  className="atlas-focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-atlas-border-glow bg-[color-mix(in_srgb,var(--atlas-accent-cyan)_14%,transparent)] px-4 text-sm font-semibold text-atlas-cyan transition-colors hover:bg-[color-mix(in_srgb,var(--atlas-accent-cyan)_20%,transparent)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSending ? <InlineSpinner size="sm" /> : <Send className="h-4 w-4" aria-hidden />}
                  Send to tutor
                </button>
              </div>
            </section>

            <section aria-labelledby="ai-tutor-response-title" aria-live="polite">
              <h3 id="ai-tutor-response-title" className="text-sm font-semibold uppercase tracking-[0.14em] text-atlas-cyan">
                Tutor response
              </h3>
              <div className="mt-3 rounded-2xl border border-atlas-border bg-atlas-glass p-4">
                {error ? (
                  <p className="text-sm leading-6 text-atlas-warning">{error}</p>
                ) : isSending ? (
                  <div className="flex items-center gap-2 text-sm text-atlas-muted">
                    <InlineSpinner size="sm" />
                    Reasoning through the selected study context…
                  </div>
                ) : lastTutorMessage ? (
                  <div className="space-y-3">
                    <p className="whitespace-pre-wrap text-sm leading-6 text-atlas-muted">{lastTutorMessage.text}</p>
                    {groundingSources.length ? (
                      <div className="border-t border-atlas-border pt-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-atlas-subtle">Sources</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {groundingSources.map((source) => (
                            <a
                              key={source.uri}
                              href={source.uri}
                              target="_blank"
                              rel="noreferrer"
                              className="atlas-focus-ring rounded-full border border-atlas-border bg-atlas-glass px-2.5 py-1 text-xs text-atlas-cyan hover:border-atlas-border-glow"
                            >
                              {source.title}
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-atlas-muted">
                    Choose a tutor action, adjust the prompt if needed, then send it to the existing reasoning tutor endpoint.
                  </p>
                )}
              </div>
            </section>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
