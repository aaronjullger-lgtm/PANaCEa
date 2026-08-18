/**
 * Canonical learner memory store — Postgres via UserPreferences.customSettings.
 *
 * KV is not used for durable learner memories. Pending and confirmed memories
 * live in customSettings.learnerAgentMemories until a dedicated table migration
 * is approved.
 */

import type { PrismaClient } from '@prisma/client';
import {
  proposeMemory,
  confirmMemory,
  correctMemory,
  type MemoryCandidate,
  type StoredLearnerMemory,
  type MemoryCategory,
  type MemorySource,
  type MemoryExpirationPolicy,
} from '../learnerAgent/memoryPolicy';

const SETTINGS_KEY = 'learnerAgentMemories';
const PENDING_KEY = 'learnerAgentPendingMemories';
const DISABLED_CATEGORIES_KEY = 'learnerAgentDisabledMemoryCategories';

interface LearnerMemorySettings {
  [SETTINGS_KEY]?: StoredLearnerMemory[];
  [PENDING_KEY]?: MemoryCandidate[];
  [DISABLED_CATEGORIES_KEY]?: MemoryCategory[];
}

function parseSettings(raw: unknown): LearnerMemorySettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as LearnerMemorySettings;
}

function isExpired(memory: StoredLearnerMemory, examDate: Date | null, now: Date): boolean {
  if (memory.expirationPolicy === 'manual' || memory.expirationPolicy === 'session') {
    return false;
  }
  if (memory.expirationPolicy === '30d') {
    const created = new Date(memory.timestamp);
    return now.getTime() - created.getTime() > 30 * 24 * 60 * 60 * 1000;
  }
  if (memory.expirationPolicy === 'until_exam' && examDate) {
    return now > examDate;
  }
  return false;
}

async function loadSettings(prisma: PrismaClient, userId: string) {
  const prefs = await prisma.userPreferences.findUnique({
    where: { userId },
    select: { customSettings: true, id: true },
  });
  return {
    prefsId: prefs?.id ?? null,
    settings: parseSettings(prefs?.customSettings),
  };
}

async function saveSettings(
  prisma: PrismaClient,
  userId: string,
  prefsId: string | null,
  settings: LearnerMemorySettings
) {
  const payload = { ...settings };
  if (prefsId) {
    await prisma.userPreferences.update({
      where: { id: prefsId },
      data: { customSettings: payload, updatedAt: new Date() },
    });
    return;
  }
  await prisma.userPreferences.create({
    data: {
      id: `prefs_${userId}`,
      userId,
      customSettings: payload,
      updatedAt: new Date(),
    },
  });
}

export async function listLearnerMemories(
  prisma: PrismaClient,
  userId: string,
  now: Date = new Date()
): Promise<{ confirmed: StoredLearnerMemory[]; pending: MemoryCandidate[] }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { examDate: true },
  });
  const { settings } = await loadSettings(prisma, userId);
  const disabled = new Set(settings[DISABLED_CATEGORIES_KEY] ?? []);
  const confirmed = (settings[SETTINGS_KEY] ?? []).filter(
    (m) => !disabled.has(m.category) && !isExpired(m, user?.examDate ?? null, now)
  );
  const pending = (settings[PENDING_KEY] ?? []).filter((m) => !disabled.has(m.category));
  return { confirmed, pending };
}

export async function proposeLearnerMemory(
  prisma: PrismaClient,
  userId: string,
  input: {
    proposed: string;
    category: MemoryCategory;
    source?: MemorySource;
    expirationPolicy?: MemoryExpirationPolicy;
  }
): Promise<{ candidate: MemoryCandidate; stored?: StoredLearnerMemory; pendingConfirmation: boolean }> {
  const { prefsId, settings } = await loadSettings(prisma, userId);
  const candidate = proposeMemory(input);

  if (!candidate.requiresConfirmation) {
    const stored = confirmMemory(candidate);
    settings[SETTINGS_KEY] = [...(settings[SETTINGS_KEY] ?? []), stored];
    await saveSettings(prisma, userId, prefsId, settings);
    return { candidate, stored, pendingConfirmation: false };
  }

  settings[PENDING_KEY] = [...(settings[PENDING_KEY] ?? []), candidate];
  await saveSettings(prisma, userId, prefsId, settings);
  return { candidate, pendingConfirmation: true };
}

export async function confirmLearnerMemory(
  prisma: PrismaClient,
  userId: string,
  memoryId: string
): Promise<StoredLearnerMemory> {
  const { prefsId, settings } = await loadSettings(prisma, userId);
  const pending = settings[PENDING_KEY] ?? [];
  const idx = pending.findIndex((m) => m.id === memoryId);
  if (idx < 0) {
    const existing = (settings[SETTINGS_KEY] ?? []).find((m) => m.id === memoryId);
    if (existing) return existing;
    throw new Error('MEMORY_NOT_FOUND');
  }
  const stored = confirmMemory(pending[idx]!);
  settings[PENDING_KEY] = pending.filter((m) => m.id !== memoryId);
  settings[SETTINGS_KEY] = [...(settings[SETTINGS_KEY] ?? []), stored];
  await saveSettings(prisma, userId, prefsId, settings);
  return stored;
}

export async function correctLearnerMemory(
  prisma: PrismaClient,
  userId: string,
  memoryId: string,
  correctedText: string
): Promise<StoredLearnerMemory> {
  const { prefsId, settings } = await loadSettings(prisma, userId);
  const memories = settings[SETTINGS_KEY] ?? [];
  const idx = memories.findIndex((m) => m.id === memoryId);
  if (idx < 0) throw new Error('MEMORY_NOT_FOUND');
  memories[idx] = correctMemory(memories[idx]!, correctedText);
  settings[SETTINGS_KEY] = memories;
  await saveSettings(prisma, userId, prefsId, settings);
  return memories[idx]!;
}

export async function deleteLearnerMemory(
  prisma: PrismaClient,
  userId: string,
  memoryId: string
): Promise<void> {
  const { prefsId, settings } = await loadSettings(prisma, userId);
  const beforeConfirmed = (settings[SETTINGS_KEY] ?? []).length;
  const beforePending = (settings[PENDING_KEY] ?? []).length;
  settings[SETTINGS_KEY] = (settings[SETTINGS_KEY] ?? []).filter((m) => m.id !== memoryId);
  settings[PENDING_KEY] = (settings[PENDING_KEY] ?? []).filter((m) => m.id !== memoryId);
  if (
    settings[SETTINGS_KEY]?.length === beforeConfirmed &&
    settings[PENDING_KEY]?.length === beforePending
  ) {
    throw new Error('MEMORY_NOT_FOUND');
  }
  await saveSettings(prisma, userId, prefsId, settings);
}

export async function setDisabledMemoryCategories(
  prisma: PrismaClient,
  userId: string,
  categories: MemoryCategory[]
): Promise<void> {
  const { prefsId, settings } = await loadSettings(prisma, userId);
  settings[DISABLED_CATEGORIES_KEY] = categories;
  await saveSettings(prisma, userId, prefsId, settings);
}

export function formatMemoriesForPrompt(memories: StoredLearnerMemory[]): string {
  if (memories.length === 0) return '';
  const lines = memories.map((m) => `- [${m.category}] ${m.proposed}`);
  return `LEARNER MEMORIES (user-confirmed, Postgres):\n${lines.join('\n')}`;
}
