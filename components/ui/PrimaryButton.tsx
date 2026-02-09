import React, { useRef, useEffect } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { LucideIcon, Loader2 } from 'lucide-react';
import { buttonVariantStyles, type ButtonVariant } from '../../lib/utils/designVariants';
import { feedback } from '@/services/core/feedbackService';

/**
 * PrimaryButton - Standardized button component for consistent UI
 *
 * Design System Standards:
 * - Height: 48px (py-3 + text size)
 * - Border radius: 12px (rounded-xl)
 * - Font: Semibold
 * - Hover: Scale 1.02, slight lift
 * - Active: Scale 0.98
 */

export type { ButtonVariant };

export type ButtonSize = 'sm' | 'md' | 'lg';

interface PrimaryButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  fullWidth?: boolean;
  disabled?: boolean;
  /** Trigger selection haptic on press (for important CTAs) */
  hapticOnPress?: boolean;
  /** Show loading spinner and disable button */
  loading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = buttonVariantStyles;

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'min-h-[44px] h-9 px-4 text-sm',
  md: 'min-h-[44px] h-12 px-6 text-base',
  lg: 'min-h-[44px] h-14 px-8 text-lg',
};

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  icon: Icon,
  iconRight: IconRight,
  fullWidth = false,
  disabled = false,
  hapticOnPress = false,
  loading = false,
  className = '',
  onClick,
  ...props
}) => {
  const isDisabled = disabled || loading;
  const btnRef = useRef<HTMLButtonElement>(null);
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (hapticOnPress && !isDisabled) feedback.selection();
    if (!isDisabled) onClick?.(e);
  };
  const baseStyles =
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 ease-out cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 focus:ring-offset-[var(--color-bg-primary)] active:scale-[0.95]';
  const disabledStyles = isDisabled ? 'opacity-50 cursor-not-allowed' : '';
  const widthStyles = fullWidth ? 'w-full' : '';

  const getIconSize = (buttonSize: ButtonSize): string => {
    if (buttonSize === 'sm') return 'w-4 h-4';
    if (buttonSize === 'lg') return 'w-6 h-6';
    return 'w-5 h-5';
  };

  return (
    <motion.button
      ref={btnRef}
      whileHover={isDisabled ? {} : { y: -2, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)' }}
      whileTap={isDisabled ? {} : { scale: 0.95 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      disabled={isDisabled}
      aria-busy={loading}
      onClick={handleClick}
      className={`
        ${baseStyles}
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${disabledStyles}
        ${widthStyles}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <Loader2 className={`${getIconSize(size)} animate-spin`} aria-hidden="true" />
      ) : (
        Icon && <Icon className={getIconSize(size)} />
      )}
      <span>{children}</span>
      {!loading && IconRight && <IconRight className={getIconSize(size)} />}
    </motion.button>
  );
};
