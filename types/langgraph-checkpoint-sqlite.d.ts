/**
 * Type stub for @langchain/langgraph-checkpoint-sqlite.
 *
 * This package is an optional dependency for persistent checkpointing.
 * The actual package is dynamically imported at runtime — this stub
 * satisfies the TypeScript compiler without requiring the package.
 *
 * When the real package is installed, remove this file to use the
 * bundled type declarations.
 */

declare module '@langchain/langgraph-checkpoint-sqlite' {
  export interface SqliteSaver {
    fromConnString(path: string): Promise<unknown>;
    put(config: Record<string, unknown>, checkpoint: unknown, metadata: unknown): Promise<RunnableConfig>;
    get(config: Record<string, unknown>): Promise<[unknown, unknown] | undefined>;
  }

  export interface RunnableConfig {
    configurable?: Record<string, unknown>;
    tags?: string[];
    metadata?: Record<string, unknown>;
  }

  const SqliteSaverClass: {
    fromConnString(path: string): Promise<SqliteSaver>;
  };

  export default SqliteSaverClass;
}
