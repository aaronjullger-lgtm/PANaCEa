/**
 * Consolidated button component – re‑exports from the unified Button.
 *
 * This file exists for backward compatibility. New code should import directly from
 * '@/components/ui/button'.
 */

export {
  Button as StandardButton,
  type ButtonVariant,
  type ButtonSize,
  PrimaryButton,
  SecondaryButton,
  OutlineButton,
  SuccessButton,
  DangerButton,
  WarningButton,
} from '@/components/ui/button';

// Default export for compatibility with some import patterns
import { Button as StandardButton } from '@/components/ui/button';
export default StandardButton;