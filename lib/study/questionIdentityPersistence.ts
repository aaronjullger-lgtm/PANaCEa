import type { QuestionIdentity, QuestionSource } from './questionIdentity';

type QuestionIdentityDelegate = {
  upsert?: (args: Record<string, unknown>) => Promise<{ id: string } | null>;
  createMany?: (args: Record<string, unknown>) => Promise<unknown>;
  findMany?: (
    args: Record<string, unknown>
  ) => Promise<Array<{ id: string; questionSource: string; sourceQuestionId: string }>>;
};

export type QuestionIdentityPrismaClient = unknown;

export type QuestionIdentityPersistenceInput = Omit<Partial<QuestionIdentity>, 'questionSource'> & {
  questionSource?: QuestionSource | string | null;
  medicalContentId?: string | null;
  system?: string | null;
  conditionId?: string | null;
  source?: string | null;
  provenance?: Record<string, unknown>;
};

type NormalizedQuestionIdentityInput = {
  canonicalQuestionId: string | null;
  sourceQuestionId: string;
  questionSource: QuestionSource;
  provenance?: Record<string, unknown>;
};

type ResolveOptions = {
  provenance?: Record<string, unknown>;
  linkSourceReferences?: boolean;
};

const QUESTION_SOURCES: ReadonlySet<string> = new Set([
  'question',
  'pre_generated',
  'staging',
  'seed',
  'generated',
]);

function compact<T extends Record<string, unknown>>(record: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined && value !== null)
  );
}

function getQuestionIdentityDelegate(
  prisma: QuestionIdentityPrismaClient
): QuestionIdentityDelegate | undefined {
  return (prisma as { questionIdentity?: QuestionIdentityDelegate } | null | undefined)
    ?.questionIdentity;
}

function normalizeNullableString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeQuestionSource(value: string | null | undefined): QuestionSource {
  return QUESTION_SOURCES.has(value ?? '') ? (value as QuestionSource) : 'question';
}

function identityKey(identity: { questionSource: string; sourceQuestionId: string }): string {
  return `${identity.questionSource}:${identity.sourceQuestionId}`;
}

export function normalizeQuestionIdentityInput(
  input: QuestionIdentityPersistenceInput,
  options: ResolveOptions = {}
): NormalizedQuestionIdentityInput | null {
  const sourceQuestionId = normalizeNullableString(input.sourceQuestionId);
  if (!sourceQuestionId) return null;

  const questionSource = normalizeQuestionSource(input.questionSource ?? null);
  const explicitCanonicalId = normalizeNullableString(input.canonicalQuestionId);
  const canonicalQuestionId =
    explicitCanonicalId ?? (questionSource === 'question' ? sourceQuestionId : null);
  const provenance = compact({
    ...options.provenance,
    medicalContentId: normalizeNullableString(input.medicalContentId),
    system: normalizeNullableString(input.system),
    conditionId: normalizeNullableString(input.conditionId),
    selectionSource: normalizeNullableString(input.source),
  });

  return {
    canonicalQuestionId,
    sourceQuestionId,
    questionSource,
    provenance: Object.keys(provenance).length > 0 ? provenance : undefined,
  };
}

function sourceReferenceFields(
  identity: NormalizedQuestionIdentityInput,
  linkSourceReferences: boolean
): Record<string, unknown> {
  if (!linkSourceReferences) return {};

  switch (identity.questionSource) {
    case 'question':
      return { canonicalQuestionId: identity.canonicalQuestionId ?? identity.sourceQuestionId };
    case 'pre_generated':
      return {
        canonicalQuestionId: identity.canonicalQuestionId ?? undefined,
        preGeneratedQuestionId: identity.sourceQuestionId,
      };
    case 'staging':
      return {
        canonicalQuestionId: identity.canonicalQuestionId ?? undefined,
        stagingQuestionId: identity.sourceQuestionId,
      };
    case 'seed':
      return {
        canonicalQuestionId: identity.canonicalQuestionId ?? undefined,
        questionSeedId: identity.sourceQuestionId,
      };
    case 'generated':
    default:
      return { canonicalQuestionId: identity.canonicalQuestionId ?? undefined };
  }
}

function createData(
  identity: NormalizedQuestionIdentityInput,
  linkSourceReferences: boolean
): Record<string, unknown> {
  return compact({
    questionSource: identity.questionSource,
    sourceQuestionId: identity.sourceQuestionId,
    ...sourceReferenceFields(identity, linkSourceReferences),
    provenance: identity.provenance,
  });
}

function updateData(
  identity: NormalizedQuestionIdentityInput,
  linkSourceReferences: boolean
): Record<string, unknown> {
  return compact({
    ...sourceReferenceFields(identity, linkSourceReferences),
    provenance: identity.provenance,
  });
}

export async function resolveOrCreateQuestionIdentityId(
  prisma: QuestionIdentityPrismaClient,
  input: QuestionIdentityPersistenceInput,
  options: ResolveOptions = {}
): Promise<string | null> {
  const delegate = getQuestionIdentityDelegate(prisma);
  if (!delegate?.upsert) return null;

  const identity = normalizeQuestionIdentityInput(input, options);
  if (!identity) return null;

  const linkSourceReferences = options.linkSourceReferences !== false;

  try {
    const result = await delegate.upsert({
      where: {
        questionSource_sourceQuestionId: {
          questionSource: identity.questionSource,
          sourceQuestionId: identity.sourceQuestionId,
        },
      },
      create: createData(identity, linkSourceReferences),
      update: updateData(identity, linkSourceReferences),
      select: { id: true },
    });
    return result?.id ?? null;
  } catch {
    if (!linkSourceReferences) return null;

    try {
      const result = await delegate.upsert({
        where: {
          questionSource_sourceQuestionId: {
            questionSource: identity.questionSource,
            sourceQuestionId: identity.sourceQuestionId,
          },
        },
        create: createData(identity, false),
        update: updateData(identity, false),
        select: { id: true },
      });
      return result?.id ?? null;
    } catch {
      return null;
    }
  }
}

export async function resolveOrCreateQuestionIdentity(
  prisma: QuestionIdentityPrismaClient,
  input: QuestionIdentityPersistenceInput,
  _logger?: { warn?: (msg: string, data?: Record<string, unknown>) => void }
): Promise<string | null> {
  const { provenance, ...identity } = input;
  return resolveOrCreateQuestionIdentityId(prisma, identity, {
    provenance,
  });
}

export async function resolveOrCreateQuestionIdentityIds(
  prisma: QuestionIdentityPrismaClient,
  inputs: QuestionIdentityPersistenceInput[],
  options: ResolveOptions = {}
): Promise<Map<string, string>> {
  const delegate = getQuestionIdentityDelegate(prisma);
  if (!delegate?.findMany) return new Map();

  const identities = Array.from(
    new Map(
      inputs
        .map((input) => normalizeQuestionIdentityInput(input, options))
        .filter((identity): identity is NormalizedQuestionIdentityInput => Boolean(identity))
        .map((identity) => [identityKey(identity), identity])
    ).values()
  );

  if (identities.length === 0) return new Map();

  const linkSourceReferences = options.linkSourceReferences !== false;

  if (delegate.createMany) {
    try {
      await delegate.createMany({
        data: identities.map((identity) => createData(identity, linkSourceReferences)),
        skipDuplicates: true,
      });
    } catch {
      if (linkSourceReferences) {
        try {
          await delegate.createMany({
            data: identities.map((identity) => createData(identity, false)),
            skipDuplicates: true,
          });
        } catch {
          return new Map();
        }
      } else {
        return new Map();
      }
    }
  } else if (delegate.upsert) {
    await Promise.all(
      identities.map((identity) => resolveOrCreateQuestionIdentityId(prisma, identity, options))
    );
  }

  try {
    const rows = await delegate.findMany({
      where: {
        OR: identities.map((identity) => ({
          questionSource: identity.questionSource,
          sourceQuestionId: identity.sourceQuestionId,
        })),
      },
      select: {
        id: true,
        questionSource: true,
        sourceQuestionId: true,
      },
    });
    return new Map(rows.map((row) => [identityKey(row), row.id]));
  } catch {
    return new Map();
  }
}

export function questionIdentityLookupKey(input: QuestionIdentityPersistenceInput): string | null {
  const normalized = normalizeQuestionIdentityInput(input);
  return normalized ? identityKey(normalized) : null;
}
