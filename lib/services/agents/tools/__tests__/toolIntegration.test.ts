/**
 * Tool Registry Integration Tests
 *
 * Verifies all 10 tools register correctly, domain-specific
 * registries filter properly, and tool categories are correct.
 */

import { describe, it, expect } from 'vitest';
import {
  ToolRegistry,
  createDefaultToolRegistry,
  createClinicalToolRegistry,
  createQualityToolRegistry,
  createInfraToolRegistry,
} from '../toolRegistry';
import {
  CLINICAL_TOOLS,
  QUALITY_TOOLS,
  COVERAGE_TOOLS,
  INFRA_TOOLS,
  DEFAULT_TOOL_NAMES,
} from '../tools';

describe('Tool Registry — Full Integration', () => {
  it('registers all 10 tools in the default registry', () => {
    const registry = createDefaultToolRegistry();
    const tools = registry.list();

    expect(tools).toHaveLength(10);
    expect(registry.hasAll(DEFAULT_TOOL_NAMES as unknown as string[])).toBe(true);
  });

  it('every tool has snake_case naming', () => {
    const registry = createDefaultToolRegistry();
    for (const tool of registry.list()) {
      expect(tool.name).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it('every tool has a valid category', () => {
    const registry = createDefaultToolRegistry();
    const validCategories = ['read', 'compute', 'write'];
    for (const tool of registry.list()) {
      expect(validCategories).toContain(tool.category);
    }
  });

  it('every tool has a description', () => {
    const registry = createDefaultToolRegistry();
    for (const tool of registry.list()) {
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });

  it('every tool has a Zod input schema', () => {
    const registry = createDefaultToolRegistry();
    for (const tool of registry.list()) {
      expect(tool.inputSchema).toBeDefined();
      expect(typeof tool.inputSchema.parse).toBe('function');
    }
  });

  it('every tool has valid parametersJsonSchema', () => {
    const registry = createDefaultToolRegistry();
    for (const tool of registry.list()) {
      expect(tool.parametersJsonSchema).toBeDefined();
      expect(tool.parametersJsonSchema).toHaveProperty('type', 'object');
      expect(tool.parametersJsonSchema).toHaveProperty('properties');
    }
  });
});

describe('Domain-Specific Registries', () => {
  it('CLINICAL_TOOLS has exactly 3 tools', () => {
    expect(CLINICAL_TOOLS).toHaveLength(3);
    const names = CLINICAL_TOOLS.map((t) => t.name);
    expect(names).toContain('clinical_library_search');
    expect(names).toContain('user_progress_summary');
    expect(names).toContain('fsrs_due_count');
  });

  it('QUALITY_TOOLS has exactly 3 tools', () => {
    expect(QUALITY_TOOLS).toHaveLength(3);
    const names = QUALITY_TOOLS.map((t) => t.name);
    expect(names).toContain('content_health_audit');
    expect(names).toContain('question_quality_check');
    expect(names).toContain('condition_verify');
  });

  it('COVERAGE_TOOLS has exactly 2 tools', () => {
    expect(COVERAGE_TOOLS).toHaveLength(2);
    const names = COVERAGE_TOOLS.map((t) => t.name);
    expect(names).toContain('blueprint_coverage_check');
    expect(names).toContain('drill_coverage_check');
  });

  it('INFRA_TOOLS has exactly 2 tools', () => {
    expect(INFRA_TOOLS).toHaveLength(2);
    const names = INFRA_TOOLS.map((t) => t.name);
    expect(names).toContain('database_integrity_check');
    expect(names).toContain('fsrs_calibration_status');
  });

  it('no tool appears in multiple registries', () => {
    const allTools = [
      ...CLINICAL_TOOLS,
      ...QUALITY_TOOLS,
      ...COVERAGE_TOOLS,
      ...INFRA_TOOLS,
    ];
    const names = allTools.map((t) => t.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('createClinicalToolRegistry returns correct registry', () => {
    const registry = createClinicalToolRegistry();
    expect(registry.list()).toHaveLength(3);
  });

  it('createQualityToolRegistry returns correct registry', () => {
    const registry = createQualityToolRegistry();
    expect(registry.list()).toHaveLength(3);
  });

  it('createInfraToolRegistry returns correct registry', () => {
    const registry = createInfraToolRegistry();
    expect(registry.list()).toHaveLength(2);
  });
});

describe('Tool Input Validation', () => {
  it('blueprint_coverage_check accepts valid input', () => {
    const registry = createDefaultToolRegistry();
    const tool = registry.get('blueprint_coverage_check');
    expect(tool).toBeDefined();

    // Valid: no args
    expect(() => tool!.inputSchema.parse({})).not.toThrow();

    // Valid: with system
    expect(() =>
      tool!.inputSchema.parse({ system: 'Cardiovascular' })
    ).not.toThrow();

    // Valid: with minHealthScore
    expect(() =>
      tool!.inputSchema.parse({ minHealthScore: 0.7 })
    ).not.toThrow();
  });

  it('content_health_audit rejects invalid health threshold', () => {
    const registry = createDefaultToolRegistry();
    const tool = registry.get('content_health_audit');
    expect(tool).toBeDefined();

    expect(() => tool!.inputSchema.parse({ healthThreshold: 1.5 })).toThrow();
    expect(() => tool!.inputSchema.parse({ healthThreshold: -1 })).toThrow();
  });

  it('question_quality_check rejects invalid minAttempts', () => {
    const registry = createDefaultToolRegistry();
    const tool = registry.get('question_quality_check');
    expect(tool).toBeDefined();

    expect(() => tool!.inputSchema.parse({ minAttempts: 3 })).toThrow();
    expect(() => tool!.inputSchema.parse({ minAttempts: 101 })).toThrow();
  });

  it('condition_verify accepts conditionId or conditionName', () => {
    const registry = createDefaultToolRegistry();
    const tool = registry.get('condition_verify');
    expect(tool).toBeDefined();

    // Valid: with conditionId
    expect(() =>
      tool!.inputSchema.parse({ conditionId: 'abc-123' })
    ).not.toThrow();

    // Valid: with conditionName
    expect(() =>
      tool!.inputSchema.parse({ conditionName: 'Hypertension' })
    ).not.toThrow();

    // Valid: empty (scan mode)
    expect(() => tool!.inputSchema.parse({})).not.toThrow();
  });

  it('database_integrity_check accepts valid checkType', () => {
    const registry = createDefaultToolRegistry();
    const tool = registry.get('database_integrity_check');
    expect(tool).toBeDefined();

    expect(() =>
      tool!.inputSchema.parse({ checkType: 'orphans' })
    ).not.toThrow();
    expect(() =>
      tool!.inputSchema.parse({ checkType: 'all' })
    ).not.toThrow();
    expect(() =>
      tool!.inputSchema.parse({ checkType: 'invalid' })
    ).toThrow();
  });

  it('fsrs_calibration_status accepts valid input', () => {
    const registry = createDefaultToolRegistry();
    const tool = registry.get('fsrs_calibration_status');
    expect(tool).toBeDefined();

    expect(() => tool!.inputSchema.parse({})).not.toThrow();
    expect(() =>
      tool!.inputSchema.parse({ userId: 'user-1', minReviews: 100 })
    ).not.toThrow();
  });

  it('drill_coverage_check accepts valid input', () => {
    const registry = createDefaultToolRegistry();
    const tool = registry.get('drill_coverage_check');
    expect(tool).toBeDefined();

    expect(() =>
      tool!.inputSchema.parse({ drillType: 'AnatomyDrill' })
    ).not.toThrow();
    expect(() =>
      tool!.inputSchema.parse({ minThreshold: 50 })
    ).not.toThrow();
  });
});

describe('Tool Category Constraints', () => {
  it('all new tools are read-only (category: read)', () => {
    const registry = createDefaultToolRegistry();
    const newToolNames = [
      'blueprint_coverage_check',
      'content_health_audit',
      'question_quality_check',
      'condition_verify',
      'database_integrity_check',
      'fsrs_calibration_status',
      'drill_coverage_check',
    ];

    for (const name of newToolNames) {
      const tool = registry.get(name);
      expect(tool, `Tool "${name}" not found`).toBeDefined();
      expect(tool!.category, `Tool "${name}" should be read-only`).toBe('read');
    }
  });
});
