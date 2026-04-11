/**
 * PANaCEa Agent Tool Registry — default exports
 *
 * Re-exports every built-in tool and provides a convenience factory that
 * returns a fully populated `ToolRegistry`.
 */

import { ToolRegistry } from '../toolRegistry';
import { clinicalLibrarySearchTool } from './clinicalLibrarySearch';
import { userProgressSummaryTool } from './userProgressSummary';
import { fsrsDueCountTool } from './fsrsDueCount';

export { clinicalLibrarySearchTool } from './clinicalLibrarySearch';
export { userProgressSummaryTool } from './userProgressSummary';
export { fsrsDueCountTool } from './fsrsDueCount';

/**
 * Build the default PANaCEa tool registry. Consumers that want a
 * restricted registry (e.g., only `read` tools, or only clinical
 * content) can call `new ToolRegistry([...])` directly with their own
 * selection instead.
 */
export function createDefaultToolRegistry(): ToolRegistry {
  return new ToolRegistry([
    clinicalLibrarySearchTool,
    userProgressSummaryTool,
    fsrsDueCountTool,
  ]);
}

/**
 * Names of every built-in tool. Useful as a default `allowedTools`
 * value when you trust the full default set.
 */
export const DEFAULT_TOOL_NAMES = [
  'clinical_library_search',
  'user_progress_summary',
  'fsrs_due_count',
] as const;
