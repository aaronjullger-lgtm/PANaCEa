import { describe, expect, it } from 'vitest';
import {
  BUILDER_AGENT_CAPABILITIES,
  CAPABILITY_SUMMARY,
  isPlaceholderCapability,
} from '@/lib/builder-agent/capabilities';

describe('BuilderAgent capability honesty', () => {
  it('marks implementation as missing not implemented', () => {
    expect(BUILDER_AGENT_CAPABILITIES.implementation).toBe('missing');
    expect(BUILDER_AGENT_CAPABILITIES.specification).toBe('placeholder');
    expect(BUILDER_AGENT_CAPABILITIES.planning).toBe('placeholder');
    expect(BUILDER_AGENT_CAPABILITIES.revision).toBe('placeholder');
  });

  it('marks production mutations as blocked', () => {
    expect(BUILDER_AGENT_CAPABILITIES.productionMutations).toBe('blocked');
  });

  it('documents boundary in summary', () => {
    expect(CAPABILITY_SUMMARY).toContain('placeholder');
    expect(CAPABILITY_SUMMARY).toContain('not an autonomous code-writing agent');
  });

  it('identifies placeholder capabilities', () => {
    expect(isPlaceholderCapability('implementation')).toBe(true);
    expect(isPlaceholderCapability('orchestration')).toBe(false);
  });
});
