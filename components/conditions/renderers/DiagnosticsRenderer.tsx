import React from 'react';

interface DiagnosticsRendererProps {
  items: Record<string, string>;
}

const DiagnosticsRenderer: React.FC<DiagnosticsRendererProps> = ({ items }) => {
  if (!items || Object.keys(items).length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
      {Object.entries(items).map(([key, value]) => (
        <div
          key={key}
          className="flex flex-col p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-l-4 border-blue-500 shadow-sm"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
            {key.replace(/_/g, ' ')}
          </span>
          <span className="font-medium text-gray-900 dark:text-gray-200">{value}</span>
        </div>
      ))}
    </div>
  );
};

export default DiagnosticsRenderer;
