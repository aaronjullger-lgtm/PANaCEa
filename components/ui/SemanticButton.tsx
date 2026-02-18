/**
 * Consolidated button component – re‑exports from the unified Button.
 *
 * This file exists for backward compatibility. New code should import directly from
 * '@/components/ui/button'.
 */

export {
  SemanticButton,
  StartSessionButton,
  ActionButton,
  GhostButton,
} from '@/components/ui/button';

// Default export for compatibility
import { SemanticButton } from '@/components/ui/button';
export default SemanticButton;