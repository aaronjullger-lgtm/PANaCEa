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
    'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25',
  secondary:
    'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 shadow-sm',
  success:
    'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-lg shadow-emerald-500/25',
  warning:
    'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/25',
  danger:
    'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-lg shadow-red-500/25',
  ghost:
    'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-base',
  lg: 'px-8 py-4 text-lg',
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
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2';
  const disabledStyles = disabled ? 'opacity-50 cursor-not-allowed' : '';
  const widthStyles = fullWidth ? 'w-full' : '';

  return (
    <motion.button
      whileHover={disabled ? {} : { scale: 1.02, y: -1 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
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
      {Icon && (
        <Icon className={size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5'} />
      )}
      <span>{children}</span>
      {IconRight && (
        <IconRight className={size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5'} />
      )}
    </motion.button>
  );
};
