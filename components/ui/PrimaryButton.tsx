/**
 * Consolidated button component – re‑exports from the unified Button.
 *
 * This file exists for backward compatibility. New code should import directly from
 * '@/components/ui/button'.
 */

export {
  Button as PrimaryButton,
  type ButtonVariant,
  type ButtonSize,
} from '@/components/ui/button';

// Default export for compatibility
import { Button as PrimaryButton } from '@/components/ui/button';
export default PrimaryButton;