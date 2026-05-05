export interface PoolRegenerationClearPlan {
  clearFirst: boolean;
  warnings: string[];
}

export function resolvePoolRegenerationClearPlan(
  args: string[],
  env: Pick<NodeJS.ProcessEnv, 'ALLOW_DESTRUCTIVE_POOL_REGENERATION'> = process.env
): PoolRegenerationClearPlan {
  const addMode = args.includes('--add');
  const noClear = args.includes('--no-clear');
  const explicitClear = args.includes('--clear');
  const legacyImplicitClear = !addMode && !noClear && !explicitClear;

  if (addMode || noClear) {
    return { clearFirst: false, warnings: [] };
  }

  if (legacyImplicitClear) {
    return {
      clearFirst: false,
      warnings: [
        'Implicit pool clearing is disabled. Use --clear with ALLOW_DESTRUCTIVE_POOL_REGENERATION=true to delete existing questions.',
      ],
    };
  }

  if (explicitClear && env.ALLOW_DESTRUCTIVE_POOL_REGENERATION !== 'true') {
    throw new Error(
      'Refusing to clear the pre-generated question pool without ALLOW_DESTRUCTIVE_POOL_REGENERATION=true.'
    );
  }

  return { clearFirst: explicitClear, warnings: [] };
}
