/**
 * UnifiedDashboard Card — Re-exports the shared Card primitive.
 *
 * Previously a local motion.div wrapper with shadow-sm + backdrop-blur.
 * Now delegates to the unified Card component for consistent ring-shadow
 * elevation and design system alignment.
 */
export { Card as default } from '@/components/ui/Card';
