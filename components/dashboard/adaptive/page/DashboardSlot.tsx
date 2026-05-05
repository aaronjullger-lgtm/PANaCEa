import React from 'react';
import type { SelectedWidget } from '../model/widgetTypes';

export function DashboardSlot({ widgets, className = '' }: { widgets?: SelectedWidget[]; className?: string }) {
  if (!widgets?.length) return null;

  return (
    <div className={className}>
      {widgets.map((widget) => {
        const Component = widget.component as React.ComponentType<{ data: unknown; visual: typeof widget.visual }>;
        return <Component key={`${widget.slot}-${widget.id}`} data={widget.data} visual={widget.visual} />;
      })}
    </div>
  );
}
