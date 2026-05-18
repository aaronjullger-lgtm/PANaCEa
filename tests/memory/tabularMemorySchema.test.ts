import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const schema = readFileSync('prisma/schema.prisma', 'utf8');

function modelBlock(modelName: string): string {
  const match = schema.match(new RegExp(`model ${modelName} \\{[\\s\\S]*?\\n\\}`));
  return match?.[0] ?? '';
}

describe('tabular memory schema contract', () => {
  it('keeps learner-memory models user scoped', () => {
    for (const model of ['QuestionAttempt', 'ReviewLog', 'StudySession', 'UserProgress']) {
      const block = modelBlock(model);
      expect(block, `${model} should exist`).not.toBe('');
      expect(block, `${model} should carry userId`).toMatch(/\buserId\s+String\b/);
      expect(block, `${model} should index or uniquely key userId`).toMatch(
        /@@(?:index|unique)\(\[[^\]]*userId/
      );
    }
  });

  it('keeps external knowledge cache records deletable and expirable', () => {
    const block = modelBlock('KnowledgeCache');

    expect(block).toMatch(/\bgeminiCacheName\s+String/);
    expect(block).toMatch(/\buserId\s+String/);
    expect(block).toMatch(/\bexpiresAt\s+DateTime/);
    expect(block).toMatch(/@@index\(\[[^\]]*userId/);
    expect(block).toMatch(/@@index\(\[[^\]]*expiresAt/);
  });

  it('tracks semantic and vector table memory entry points', () => {
    const semanticCache = modelBlock('SemanticCache');
    const questionEmbedding = modelBlock('QuestionEmbedding');
    const medicalContentEmbedding = modelBlock('MedicalContentEmbedding');

    expect(semanticCache).toMatch(/\bqueryText\s+String/);
    expect(semanticCache).toMatch(/\bcachedQuestion\s+Json/);
    expect(questionEmbedding).toMatch(/\bmodel\s+String\s+@default\("text-embedding-004"\)/);
    expect(questionEmbedding).toMatch(/\bembeddedText\s+String\?/);
    expect(medicalContentEmbedding).toMatch(/\bembedding\s+Unsupported\("vector"\)/);
  });
});
