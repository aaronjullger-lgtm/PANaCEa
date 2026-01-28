import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

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

export type ButtonVariant =
  | 'primary' // Blue gradient, white text
  | 'secondary' // White bg, colored text
  | 'success' // Green
  | 'warning' // Amber/Orange
  | 'danger' // Red
  | 'ghost'; // Transparent

export type ButtonSize = 'sm' | 'md' | 'lg';

interface PrimaryButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  fullWidth?: boolean;
  disabled?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-blue-600 hover:bg-blue-700 text-white shadow-none',
  secondary:
    'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-slate-50 dark:hover:bg-slate-700/80 shadow-sm',
  success:
    'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40',
  warning:
    'bg-amber-500 hover:bg-amber-600 text-white shadow-none',
  danger:
    'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-lg shadow-red-500/25 hover:shadow-red-500/40',
  ghost:
    'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-10 px-5 text-sm',
  lg: 'h-12 px-6 text-base',
};

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  icon: Icon,
  iconRight: IconRight,
  fullWidth = false,
  disabled = false,
  className = '',
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2';
  const disabledStyles = disabled ? 'opacity-50 cursor-not-allowed' : '';
  const widthStyles = fullWidth ? 'w-full' : '';

  const getIconSize = (buttonSize: ButtonSize): string => {
    if (buttonSize === 'sm') return 'w-4 h-4';
    if (buttonSize === 'lg') return 'w-6 h-6';
    return 'w-5 h-5';
  };

  return (
    <motion.button
      whileHover={disabled ? {} : { scale: 1.02, y: -2 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      disabled={disabled}
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
      {Icon && <Icon className={getIconSize(size)} />}
      <span>{children}</span>
      {IconRight && <IconRight className={getIconSize(size)} />}
    </motion.button>
  );
};
