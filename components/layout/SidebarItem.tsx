/**
 * SidebarItem - Unified sidebar list item for Study (NavRail) and Knowledge Base (LibrarySidebar).
 * Ensures consistent padding, hover states, icon alignment, and optional count across the app.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

const BASE_CLASS =
  'w-full flex items-center gap-2 min-h-[44px] px-3 py-2.5 rounded-xl text-left transition-all duration-200 ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]';

const ACTIVE_CLASS =
  'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20';

const INACTIVE_CLASS =
  'border border-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]/80 hover:text-[var(--color-text-primary)]';

const COMPACT_CLASS = 'min-h-0 py-2 text-xs';

export interface SidebarItemProps {
  /** Primary label (e.g. "Cardiovascular", "Home") */
  label: string;
  /** Optional icon (Lucide) */
  icon?: LucideIcon;
  /** Optional count shown as secondary, muted text */
  count?: number;
  /** Whether the item is the current selection */
  active?: boolean;
  /** Render as button, link, or span (span for composition inside a Link) */
  as: 'button' | 'link' | 'span';
  /** Required when as="link" */
  href?: string;
  /** Click handler when as="button" or as="span" */
  onClick?: () => void;
  /** Optional leading slot (e.g. ChevronRight/ChevronDown for expandable rows) */
  leftSlot?: React.ReactNode;
  /** Smaller text and padding for nested items */
  compact?: boolean;
  /** Icon style: 'box' = rounded box (NavRail), 'plain' = icon only (LibrarySidebar) */
  iconVariant?: 'box' | 'plain';
  /** When true, show only icon (centered); used by NavRail when rail is collapsed */
  collapsed?: boolean;
  /** Extra class names */
  className?: string;
  /** For Link: aria-current="page" when active */
  ariaCurrent?: 'page';
  /** For accessibility */
  'aria-label'?: string;
}

function SidebarItemContent({
  label,
  icon: Icon,
  count,
  active,
  leftSlot,
  compact,
  iconVariant = 'plain',
  collapsed = false,
}: Readonly<Pick<SidebarItemProps, 'label' | 'icon' | 'count' | 'active' | 'leftSlot' | 'compact' | 'iconVariant' | 'collapsed'>>) {
  const iconClass = active
    ? 'text-[var(--color-accent)]'
    : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)]';

  if (collapsed && Icon != null) {
    return (
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
          active
            ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
            : 'text-[var(--color-text-muted)] group-hover:bg-[var(--color-bg-tertiary)] group-hover:text-[var(--color-text-primary)]'
        }`}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </span>
    );
  }

  const leading = leftSlot ?? (Icon == null ? <span className="w-4 shrink-0" /> : null);
  return (
    <>
      {leading}
      {Icon != null &&
        (iconVariant === 'box' ? (
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
              active
                ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                : 'text-[var(--color-text-muted)] group-hover:bg-[var(--color-bg-tertiary)] group-hover:text-[var(--color-text-primary)]'
            }`}
          >
            <Icon className="h-5 w-5" aria-hidden />
          </span>
        ) : (
          <Icon className={`h-4 w-4 shrink-0 ${iconClass}`} aria-hidden />
        ))}
      <span className={`flex-1 truncate font-medium ${compact ? 'text-xs' : 'text-sm'}`}>
        {label}
      </span>
      {count != null && (
        <span className="text-xs text-[var(--color-text-muted)] tabular-nums shrink-0">
          {count}
        </span>
      )}
    </>
  );
}

export const SidebarItem: React.FC<Readonly<SidebarItemProps>> = ({
  label,
  icon,
  count,
  active = false,
  as,
  href,
  onClick,
  leftSlot,
  compact = false,
  iconVariant = 'plain',
  collapsed = false,
  className = '',
  ariaCurrent,
  'aria-label': ariaLabel,
}) => {
  const content = (
    <SidebarItemContent
      label={label}
      icon={icon}
      count={count}
      active={active}
      leftSlot={leftSlot}
      compact={compact}
      iconVariant={iconVariant}
      collapsed={collapsed}
    />
  );

  const COLLAPSED_CLASS = 'justify-center px-2';
  const styleClass = `${BASE_CLASS} ${compact ? COMPACT_CLASS : ''} ${collapsed ? COLLAPSED_CLASS : ''} group ${
    active ? ACTIVE_CLASS : INACTIVE_CLASS
  } ${className}`.trim();

  if (as === 'span') {
    return (
      <span className={styleClass} aria-current={ariaCurrent} aria-label={ariaLabel}>
        {content}
      </span>
    );
  }

  if (as === 'link' && href != null) {
    return (
      <Link
        to={href}
        className={styleClass}
        onClick={onClick}
        aria-current={ariaCurrent}
        aria-label={ariaLabel}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={styleClass}
      onClick={onClick}
      aria-current={ariaCurrent}
      aria-label={ariaLabel}
    >
      {content}
    </button>
  );
};

export default SidebarItem;
