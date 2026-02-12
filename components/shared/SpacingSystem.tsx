/**
 * Spacing System Components
 * 
 * Reusable spacing components for consistent layout across PANaCEa.
 * Uses the standardized spacing constants from lib/constants/spacing.ts
 */

import React from 'react';
import { SPACING, getSpacing, generateSpacingStyles, responsiveSpacing } from '@/lib/constants/spacing';

// ============================================================================
// Spacing Components
// ============================================================================

export interface SpacingProps {
  /** Size of the spacing (uses SPACING scale) */
  size?: keyof typeof SPACING | keyof typeof SPACING.SEMANTIC;
  /** Direction of spacing: vertical (margin-bottom) or horizontal (margin-right) */
  direction?: 'vertical' | 'horizontal' | 'both';
  /** Responsive sizes: [base, sm, md, lg] */
  responsive?: Array<keyof typeof SPACING | keyof typeof SPACING.SEMANTIC>;
  /** Additional CSS class */
  className?: string;
  /** Inline styles */
  style?: React.CSSProperties;
  /** Children to wrap with spacing */
  children?: React.ReactNode;
}

/**
 * Spacing component for consistent margins/padding
 * 
 * Example:
 * <Spacing size={4} direction="vertical" />
 * <Spacing size="CARD_GAP" direction="horizontal" />
 */
export const Spacing: React.FC<SpacingProps> = ({
  size = 4,
  direction = 'vertical',
  responsive,
  className = '',
  style = {},
  children,
}) => {
  const baseSize = getSpacing(size);
  
  // Generate responsive classes if provided
  const responsiveClasses = responsive
    ? responsive.map((s, i) => {
        const breakpoint = i === 0 ? '' : i === 1 ? 'sm:' : i === 2 ? 'md:' : 'lg:';
        return `${breakpoint}${getSpacing(s)}`;
      }).join(' ')
    : '';
  
  // Determine CSS properties based on direction
  const spacingStyles: React.CSSProperties = {
    ...style,
  };
  
  if (direction === 'vertical') {
    spacingStyles.marginBottom = baseSize;
  } else if (direction === 'horizontal') {
    spacingStyles.marginRight = baseSize;
  } else if (direction === 'both') {
    spacingStyles.margin = baseSize;
  }
  
  if (children) {
    return (
      <div 
        className={`${className} ${responsiveClasses}`.trim()}
        style={spacingStyles}
      >
        {children}
      </div>
    );
  }
  
  return (
    <div 
      className={`${className} ${responsiveClasses}`.trim()}
      style={spacingStyles}
      aria-hidden="true"
    />
  );
};

// ============================================================================
// Container Components
// ============================================================================

export interface ContainerProps {
  /** Container width: full, narrow, or custom */
  width?: 'full' | 'narrow' | 'wide' | 'custom';
  /** Padding size */
  padding?: keyof typeof SPACING | keyof typeof SPACING.SEMANTIC;
  /** Center content horizontally */
  center?: boolean;
  /** Additional CSS class */
  className?: string;
  /** Children */
  children: React.ReactNode;
}

/**
 * Standardized container component
 * 
 * Example:
 * <Container width="narrow" padding="CONTAINER_PADDING" center>
 *   Content here
 * </Container>
 */
export const Container: React.FC<ContainerProps> = ({
  width = 'full',
  padding = 'CONTAINER_PADDING',
  center = false,
  className = '',
  children,
}) => {
  const widthClass = {
    full: 'max-w-full',
    narrow: 'max-w-3xl',
    wide: 'max-w-6xl',
    custom: '',
  }[width];
  
  const paddingValue = getSpacing(padding);
  
  return (
    <div
      className={`
        ${widthClass}
        ${center ? 'mx-auto' : ''}
        ${className}
      `.trim()}
      style={{
        padding: paddingValue,
        width: '100%',
      }}
    >
      {children}
    </div>
  );
};

// ============================================================================
// Grid Components
// ============================================================================

export interface GridProps {
  /** Number of columns */
  cols?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Gap between grid items */
  gap?: keyof typeof SPACING | keyof typeof SPACING.SEMANTIC;
  /** Responsive columns: [base, sm, md, lg] */
  responsiveCols?: Array<1 | 2 | 3 | 4 | 5 | 6>;
  /** Additional CSS class */
  className?: string;
  /** Children */
  children: React.ReactNode;
}

/**
 * Standardized grid component
 * 
 * Example:
 * <Grid cols={3} gap="GRID_GAP" responsiveCols={[1, 2, 3]}>
 *   Grid items
 * </Grid>
 */
export const Grid: React.FC<GridProps> = ({
  cols = 3,
  gap = 'GRID_GAP',
  responsiveCols,
  className = '',
  children,
}) => {
  const gapValue = getSpacing(gap);
  
  // Generate responsive column classes
  const colClasses = responsiveCols
    ? responsiveCols.map((col, i) => {
        const breakpoint = i === 0 ? '' : i === 1 ? 'sm:' : i === 2 ? 'md:' : 'lg:';
        return `${breakpoint}grid-cols-${col}`;
      }).join(' ')
    : `grid-cols-${cols}`;
  
  return (
    <div
      className={`
        grid
        ${colClasses}
        ${className}
      `.trim()}
      style={{
        gap: gapValue,
      }}
    >
      {children}
    </div>
  );
};

// ============================================================================
// Stack Components
// ============================================================================

export interface StackProps {
  /** Direction: vertical or horizontal */
  direction?: 'vertical' | 'horizontal';
  /** Gap between items */
  gap?: keyof typeof SPACING | keyof typeof SPACING.SEMANTIC;
  /** Align items */
  align?: 'start' | 'center' | 'end' | 'stretch';
  /** Justify content */
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
  /** Wrap items */
  wrap?: boolean;
  /** Additional CSS class */
  className?: string;
  /** Children */
  children: React.ReactNode;
}

/**
 * Stack component for consistent spacing between items
 * 
 * Example:
 * <Stack direction="vertical" gap={4} align="center">
 *   Stacked items
 * </Stack>
 */
export const Stack: React.FC<StackProps> = ({
  direction = 'vertical',
  gap = 4,
  align = 'stretch',
  justify = 'start',
  wrap = false,
  className = '',
  children,
}) => {
  const gapValue = getSpacing(gap);
  
  const directionClass = direction === 'vertical' ? 'flex-col' : 'flex-row';
  const alignClass = `items-${align}`;
  const justifyClass = `justify-${justify}`;
  const wrapClass = wrap ? 'flex-wrap' : '';
  
  return (
    <div
      className={`
        flex
        ${directionClass}
        ${alignClass}
        ${justifyClass}
        ${wrapClass}
        ${className}
      `.trim()}
      style={{
        gap: gapValue,
      }}
    >
      {children}
    </div>
  );
};

// ============================================================================
// Inset Components
// ============================================================================

export interface InsetProps {
  /** Padding on all sides */
  all?: keyof typeof SPACING | keyof typeof SPACING.SEMANTIC;
  /** Vertical padding (top & bottom) */
  vertical?: keyof typeof SPACING | keyof typeof SPACING.SEMANTIC;
  /** Horizontal padding (left & right) */
  horizontal?: keyof typeof SPACING | keyof typeof SPACING.SEMANTIC;
  /** Top padding */
  top?: keyof typeof SPACING | keyof typeof SPACING.SEMANTIC;
  /** Right padding */
  right?: keyof typeof SPACING | keyof typeof SPACING.SEMANTIC;
  /** Bottom padding */
  bottom?: keyof typeof SPACING | keyof typeof SPACING.SEMANTIC;
  /** Left padding */
  left?: keyof typeof SPACING | keyof typeof SPACING.SEMANTIC;
  /** Additional CSS class */
  className?: string;
  /** Children */
  children: React.ReactNode;
}

/**
 * Inset component for consistent padding
 * 
 * Example:
 * <Inset all={4}>Content with padding</Inset>
 * <Inset vertical={6} horizontal={4}>Content with custom padding</Inset>
 */
export const Inset: React.FC<InsetProps> = ({
  all,
  vertical,
  horizontal,
  top,
  right,
  bottom,
  left,
  className = '',
  children,
}) => {
  const styles: React.CSSProperties = {};
  
  if (all) {
    styles.padding = getSpacing(all);
  } else {
    if (vertical) {
      styles.paddingTop = getSpacing(vertical);
      styles.paddingBottom = getSpacing(vertical);
    }
    if (horizontal) {
      styles.paddingLeft = getSpacing(horizontal);
      styles.paddingRight = getSpacing(horizontal);
    }
    if (top) styles.paddingTop = getSpacing(top);
    if (right) styles.paddingRight = getSpacing(right);
    if (bottom) styles.paddingBottom = getSpacing(bottom);
    if (left) styles.paddingLeft = getSpacing(left);
  }
  
  return (
    <div className={className} style={styles}>
      {children}
    </div>
  );
};

// ============================================================================
// Alignment Components
// ============================================================================

export interface CenterProps {
  /** Center horizontally */
  horizontal?: boolean;
  /** Center vertically */
  vertical?: boolean;
  /** Center both axes */
  both?: boolean;
  /** Additional CSS class */
  className?: string;
  /** Children */
  children: React.ReactNode;
}

/**
 * Center component for easy alignment
 * 
 * Example:
 * <Center both>
 *   Centered content
 * </Center>
 */
export const Center: React.FC<CenterProps> = ({
  horizontal = false,
  vertical = false,
  both = false,
  className = '',
  children,
}) => {
  const isHorizontal = horizontal || both;
  const isVertical = vertical || both;
  
  return (
    <div
      className={`
        ${isHorizontal ? 'flex justify-center' : ''}
        ${isVertical ? 'flex items-center' : ''}
        ${isHorizontal && isVertical ? 'flex items-center justify-center' : ''}
        ${className}
      `.trim()}
    >
      {children}
    </div>
  );
};

// ============================================================================
// Export Convenience Components
// ============================================================================

/**
 * Convenience components for common spacing patterns
 */
export const VStack = (props: Omit<StackProps, 'direction'>) => (
  <Stack direction="vertical" {...props} />
);

export const HStack = (props: Omit<StackProps, 'direction'>) => (
  <Stack direction="horizontal" {...props} />
);

export const CardContainer = (props: Omit<ContainerProps, 'width' | 'padding'>) => (
  <Container width="narrow" padding="CARD_PADDING" {...props} />
);

export const PageContainer = (props: Omit<ContainerProps, 'width'>) => (
  <Container width="wide" {...props} />
);

export const SectionSpacing = (props: Omit<SpacingProps, 'size' | 'direction'>) => (
  <Spacing size="SECTION_VERTICAL" direction="vertical" {...props} />
);

export const FormSpacing = (props: Omit<SpacingProps, 'size' | 'direction'>) => (
  <Spacing size="FORM_FIELD_GAP" direction="vertical" {...props} />
);