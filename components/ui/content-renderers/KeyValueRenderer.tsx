import React from 'react';

interface KeyValueRendererProps {
  data: Record<string, unknown>;
  className?: string;
  keyClassName?: string;
  valueClassName?: string;
}

/**
 * KeyValueRenderer - Renders an object as key-value pairs
 *
 * Useful for structured data like diagnostic criteria, treatment protocols,
 * or any nested object that needs to be displayed in a readable format.
 *
 * @param data - Object with key-value pairs to render
 * @param className - Additional CSS classes for container
 * @param keyClassName - Additional CSS classes for keys
 * @param valueClassName - Additional CSS classes for values
 */
export const KeyValueRenderer: React.FC<KeyValueRendererProps> = ({
  data,
  className = '',
  keyClassName = '',
  valueClassName = '',
}) => {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const entries = Object.entries(data).filter(
    ([_, value]) => value !== null && value !== undefined && value !== ''
  );

  if (entries.length === 0) {
    return null;
  }

  return (
    <dl className={`space-y-3 ${className}`}>
      {entries.map(([key, value]) => (
        <div key={key} className="flex flex-col sm:flex-row sm:gap-4">
          {/* Key */}
          <dt
            className={`
            font-semibold text-[var(--color-accent)] capitalize min-w-[140px]
            ${keyClassName}
          `}
          >
            {formatKey(key)}:
          </dt>

          {/* Value */}
          <dd
            className={`
            text-[var(--color-text-primary)] flex-1
            ${valueClassName}
          `}
          >
            {renderValue(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
};

/**
 * Formats a camelCase or snake_case key into readable text
 */
function formatKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

/**
 * Renders a value based on its type
 */
function renderValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-[var(--color-text-muted)] italic">Not specified</span>;
  }

  // Array of strings
  if (Array.isArray(value)) {
    return (
      <ul className="list-disc list-inside space-y-1">
        {value.map((item, idx) => (
          <li key={idx} className="text-[var(--color-text-primary)]">
            {String(item)}
          </li>
        ))}
      </ul>
    );
  }

  // Nested object
  if (typeof value === 'object') {
    return (
      <div className="pl-4 border-l-2 border-[var(--color-border)] space-y-2 mt-2">
        {Object.entries(value as Record<string, unknown>).map(([nestedKey, nestedValue]) => (
          <div key={nestedKey} className="text-sm">
            <span className="font-medium text-[var(--color-text-muted)]">
              {formatKey(nestedKey)}:
            </span>{' '}
            <span className="text-[var(--color-text-primary)]">{String(nestedValue)}</span>
          </div>
        ))}
      </div>
    );
  }

  // Boolean
  if (typeof value === 'boolean') {
    return (
      <span className={value ? 'text-emerald-500' : 'text-red-500'}>
        {value ? '✓ Yes' : '✗ No'}
      </span>
    );
  }

  // String or number
  return <span>{String(value)}</span>;
}

/**
 * Specialized component for diagnostic criteria
 */
export const DiagnosticCriteriaRenderer: React.FC<{
  criteria: Record<string, unknown>;
  className?: string;
}> = ({ criteria, className }) => (
  <KeyValueRenderer
    data={criteria}
    className={`bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-4 ${className}`}
    keyClassName="text-blue-400"
  />
);

/**
 * Specialized component for treatment protocols
 */
export const TreatmentProtocolRenderer: React.FC<{
  protocol: Record<string, unknown>;
  className?: string;
}> = ({ protocol, className }) => (
  <KeyValueRenderer
    data={protocol}
    className={`bg-emerald-950/20 border border-emerald-800/30 rounded-xl p-4 ${className}`}
    keyClassName="text-emerald-400"
  />
);

export default KeyValueRenderer;
