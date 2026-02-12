import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react';

export type ValidationSeverity = 'error' | 'warning' | 'info' | 'success';

export interface ValidationMessage {
  id: string;
  message: string;
  severity: ValidationSeverity;
  fieldId?: string;
  actionable?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}

export interface FormValidationProps {
  /** Array of validation messages to display */
  messages: ValidationMessage[];
  /** Whether to show the validation summary */
  showSummary?: boolean;
  /** Title for the validation summary */
  summaryTitle?: string;
  /** Whether to animate messages */
  animate?: boolean;
  /** Additional CSS classes */
  className?: string;
}

const severityConfig: Record<ValidationSeverity, {
  icon: React.ReactNode;
  bgColor: string;
  borderColor: string;
  textColor: string;
  iconColor: string;
}> = {
  error: {
    icon: <XCircle className="w-5 h-5" />,
    bgColor: 'bg-[var(--color-data-fail)]/10',
    borderColor: 'border-[var(--color-data-fail)]/30',
    textColor: 'text-[var(--color-data-fail)]',
    iconColor: 'text-[var(--color-data-fail)]',
  },
  warning: {
    icon: <AlertCircle className="w-5 h-5" />,
    bgColor: 'bg-[var(--color-data-provisional)]/10',
    borderColor: 'border-[var(--color-data-provisional)]/30',
    textColor: 'text-[var(--color-data-provisional)]',
    iconColor: 'text-[var(--color-data-provisional)]',
  },
  info: {
    icon: <Info className="w-5 h-5" />,
    bgColor: 'bg-[var(--color-accent)]/10',
    borderColor: 'border-[var(--color-accent)]/30',
    textColor: 'text-[var(--color-accent)]',
    iconColor: 'text-[var(--color-accent)]',
  },
  success: {
    icon: <CheckCircle className="w-5 h-5" />,
    bgColor: 'bg-[var(--color-data-pass)]/10',
    borderColor: 'border-[var(--color-data-pass)]/30',
    textColor: 'text-[var(--color-data-pass)]',
    iconColor: 'text-[var(--color-data-pass)]',
  },
};

export const FormValidation: React.FC<FormValidationProps> = ({
  messages,
  showSummary = true,
  summaryTitle = 'Please check the following:',
  animate = true,
  className = '',
}) => {
  const hasErrors = messages.some(m => m.severity === 'error');
  const hasWarnings = messages.some(m => m.severity === 'warning');
  
  if (messages.length === 0) {
    return null;
  }

  const groupedMessages = {
    errors: messages.filter(m => m.severity === 'error'),
    warnings: messages.filter(m => m.severity === 'warning'),
    info: messages.filter(m => m.severity === 'info'),
    success: messages.filter(m => m.severity === 'success'),
  };

  const renderMessage = (message: ValidationMessage, index: number) => {
    const config = severityConfig[message.severity];
    
    return (
      <motion.div
        key={message.id}
        initial={animate ? { opacity: 0, x: -10 } : false}
        animate={animate ? { opacity: 1, x: 0 } : false}
        transition={{ duration: 0.2, delay: index * 0.05 }}
        className={`flex items-start gap-3 p-3 rounded-lg ${config.bgColor} ${config.borderColor} border`}
        role={message.severity === 'error' ? 'alert' : 'status'}
        aria-live={message.severity === 'error' ? 'assertive' : 'polite'}
      >
        <div className={`flex-shrink-0 mt-0.5 ${config.iconColor}`}>
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${config.textColor}`}>
            {message.message}
          </p>
          {message.fieldId && (
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Related to: <code className="font-mono bg-[var(--color-bg-secondary)] px-1 py-0.5 rounded">{message.fieldId}</code>
            </p>
          )}
        </div>
        {message.actionable && message.actionLabel && (
          <button
            onClick={message.onAction}
            className={`flex-shrink-0 px-3 py-1 text-xs font-medium rounded ${config.bgColor} hover:opacity-90 transition-opacity ${config.textColor}`}
          >
            {message.actionLabel}
          </button>
        )}
      </motion.div>
    );
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {showSummary && (hasErrors || hasWarnings) && (
        <div className="mb-2">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
            {summaryTitle}
          </h3>
          <p className="text-xs text-[var(--color-text-muted)]">
            {hasErrors 
              ? 'Please fix the errors below before submitting.' 
              : 'Please review the warnings below.'}
          </p>
        </div>
      )}

      <AnimatePresence>
        {groupedMessages.errors.length > 0 && (
          <div className="space-y-2">
            {groupedMessages.errors.map((message, index) => renderMessage(message, index))}
          </div>
        )}

        {groupedMessages.warnings.length > 0 && (
          <div className="space-y-2">
            {groupedMessages.warnings.map((message, index) => renderMessage(message, index))}
          </div>
        )}

        {groupedMessages.info.length > 0 && (
          <div className="space-y-2">
            {groupedMessages.info.map((message, index) => renderMessage(message, index))}
          </div>
        )}

        {groupedMessages.success.length > 0 && (
          <div className="space-y-2">
            {groupedMessages.success.map((message, index) => renderMessage(message, index))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Hook for form validation
export interface UseFormValidationOptions {
  initialMessages?: ValidationMessage[];
  scrollToFirstError?: boolean;
}

export function useFormValidation(options: UseFormValidationOptions = {}) {
  const [messages, setMessages] = React.useState<ValidationMessage[]>(options.initialMessages || []);

  const addMessage = React.useCallback((message: Omit<ValidationMessage, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setMessages(prev => [...prev, { ...message, id }]);
    
    // Scroll to first error if enabled
    if (options.scrollToFirstError && message.severity === 'error' && message.fieldId) {
      setTimeout(() => {
        const element = document.getElementById(message.fieldId!);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.focus({ preventScroll: true });
        }
      }, 100);
    }
  }, [options.scrollToFirstError]);

  const removeMessage = React.useCallback((id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id));
  }, []);

  const clearMessages = React.useCallback(() => {
    setMessages([]);
  }, []);

  const clearFieldMessages = React.useCallback((fieldId: string) => {
    setMessages(prev => prev.filter(m => m.fieldId !== fieldId));
  }, []);

  const hasErrors = React.useMemo(() => 
    messages.some(m => m.severity === 'error'), 
    [messages]
  );

  const hasWarnings = React.useMemo(() => 
    messages.some(m => m.severity === 'warning'), 
    [messages]
  );

  return {
    messages,
    addMessage,
    removeMessage,
    clearMessages,
    clearFieldMessages,
    hasErrors,
    hasWarnings,
    FormValidation: (props: Omit<FormValidationProps, 'messages'>) => (
      <FormValidation messages={messages} {...props} />
    ),
  };
}

// Field-level validation helpers
export function validateRequired(value: string, fieldName: string): string | null {
  if (!value.trim()) {
    return `${fieldName} is required`;
  }
  return null;
}

export function validateEmail(email: string): string | null {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'Please enter a valid email address';
  }
  return null;
}

export function validateMinLength(value: string, minLength: number, fieldName: string): string | null {
  if (value.length < minLength) {
    return `${fieldName} must be at least ${minLength} characters`;
  }
  return null;
}

export function validateMaxLength(value: string, maxLength: number, fieldName: string): string | null {
  if (value.length > maxLength) {
    return `${fieldName} must be no more than ${maxLength} characters`;
  }
  return null;
}

export function validateNumberRange(value: number, min: number, max: number, fieldName: string): string | null {
  if (value < min || value > max) {
    return `${fieldName} must be between ${min} and ${max}`;
  }
  return null;
}

export function validateDateFuture(date: string, fieldName: string): string | null {
  const inputDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (inputDate < today) {
    return `${fieldName} must be in the future`;
  }
  return null;
}