/**
 * Spacing Constants & Design Tokens
 * 
 * Standardized spacing system for consistent UI layout across PANaCEa.
 * Based on 4px base unit (0.25rem) with semantic naming.
 * 
 * Usage:
 * - Use semantic tokens (SPACING.CONTAINER_PADDING) for maintainability
 * - Use numeric values (SPACING[4]) for fine-grained control
 * - Use responsive utilities (SPACING.RESPONSIVE.CONTAINER) for mobile-first design
 */

export const SPACING = {
  // Base unit: 4px (0.25rem)
  BASE_UNIT: 4,
  
  // Numeric scale (multiples of 4px)
  0: '0px',
  1: '4px',    // 0.25rem
  2: '8px',    // 0.5rem
  3: '12px',   // 0.75rem
  4: '16px',   // 1rem
  5: '20px',   // 1.25rem
  6: '24px',   // 1.5rem
  8: '32px',   // 2rem
  10: '40px',  // 2.5rem
  12: '48px',  // 3rem
  16: '64px',  // 4rem
  20: '80px',  // 5rem
  24: '96px',  // 6rem
  32: '128px', // 8rem
  40: '160px', // 10rem
  48: '192px', // 12rem
  64: '256px', // 16rem
  
  // Semantic spacing tokens
  SEMANTIC: {
    // Container spacing
    CONTAINER_PADDING: '16px', // SPACING[4]
    CONTAINER_PADDING_MOBILE: '12px', // SPACING[3]
    CONTAINER_MAX_WIDTH: '1280px',
    CONTAINER_MAX_WIDTH_NARROW: '800px',
    
    // Section spacing
    SECTION_VERTICAL: '48px', // SPACING[12]
    SECTION_VERTICAL_MOBILE: '32px', // SPACING[8]
    SECTION_HORIZONTAL: '32px', // SPACING[8]
    
    // Card spacing
    CARD_PADDING: '20px', // SPACING[5]
    CARD_PADDING_MOBILE: '16px', // SPACING[4]
    CARD_GAP: '16px', // SPACING[4]
    CARD_BORDER_RADIUS: '12px',
    
    // Form spacing
    FORM_FIELD_GAP: '12px', // SPACING[3]
    FORM_LABEL_MARGIN: '4px', // SPACING[1]
    FORM_INPUT_PADDING: '12px', // SPACING[3]
    FORM_BUTTON_GAP: '8px', // SPACING[2]
    
    // Button spacing
    BUTTON_PADDING_X: '16px', // SPACING[4]
    BUTTON_PADDING_Y: '10px', // SPACING[2.5] (custom)
    BUTTON_ICON_GAP: '8px', // SPACING[2]
    BUTTON_BORDER_RADIUS: '8px',
    
    // Navigation spacing
    NAV_ITEM_PADDING: '12px', // SPACING[3]
    NAV_ITEM_GAP: '8px', // SPACING[2]
    NAV_BAR_HEIGHT: '64px', // SPACING[16]
    NAV_BAR_HEIGHT_MOBILE: '56px', // SPACING[14] (custom)
    
    // Modal spacing
    MODAL_PADDING: '24px', // SPACING[6]
    MODAL_GAP: '16px', // SPACING[4]
    MODAL_BACKDROP_BLUR: '8px',
    
    // Grid spacing
    GRID_GAP: '24px', // SPACING[6]
    GRID_GAP_MOBILE: '16px', // SPACING[4]
    
    // Typography spacing
    HEADING_MARGIN: '16px', // SPACING[4]
    PARAGRAPH_MARGIN: '12px', // SPACING[3]
    LINE_HEIGHT_TIGHT: '1.25',
    LINE_HEIGHT_NORMAL: '1.5',
    LINE_HEIGHT_LOOSE: '1.75',
  },
  
  // Responsive spacing utilities
  RESPONSIVE: {
    CONTAINER: {
      base: '12px',
      sm: '16px',
      lg: '24px',
    },
    SECTION: {
      base: '32px',
      sm: '48px',
      lg: '64px',
    },
    CARD: {
      base: '16px',
      sm: '20px',
    },
    GRID: {
      base: '16px',
      sm: '24px',
    },
  },
  
  // Accessibility spacing
  ACCESSIBILITY: {
    MIN_TOUCH_TARGET: '44px',
    FOCUS_RING_OFFSET: '2px',
    FOCUS_RING_WIDTH: '2px',
  },
} as const;

/**
 * CSS Custom Properties for spacing
 * These can be used in CSS files or inline styles
 */
export const SPACING_CSS_VARS = {
  '--spacing-base': SPACING.BASE_UNIT + 'px',
  
  // Semantic CSS variables
  '--spacing-container-padding': SPACING.SEMANTIC.CONTAINER_PADDING,
  '--spacing-container-padding-mobile': SPACING.SEMANTIC.CONTAINER_PADDING_MOBILE,
  '--spacing-section-vertical': SPACING.SEMANTIC.SECTION_VERTICAL,
  '--spacing-card-padding': SPACING.SEMANTIC.CARD_PADDING,
  '--spacing-card-gap': SPACING.SEMANTIC.CARD_GAP,
  '--spacing-form-field-gap': SPACING.SEMANTIC.FORM_FIELD_GAP,
  '--spacing-button-padding-x': SPACING.SEMANTIC.BUTTON_PADDING_X,
  '--spacing-button-padding-y': SPACING.SEMANTIC.BUTTON_PADDING_Y,
  '--spacing-nav-bar-height': SPACING.SEMANTIC.NAV_BAR_HEIGHT,
  '--spacing-nav-bar-height-mobile': SPACING.SEMANTIC.NAV_BAR_HEIGHT_MOBILE,
  '--spacing-grid-gap': SPACING.SEMANTIC.GRID_GAP,
  
  // Accessibility
  '--spacing-min-touch-target': SPACING.ACCESSIBILITY.MIN_TOUCH_TARGET,
  '--spacing-focus-ring-offset': SPACING.ACCESSIBILITY.FOCUS_RING_OFFSET,
  '--spacing-focus-ring-width': SPACING.ACCESSIBILITY.FOCUS_RING_WIDTH,
} as const;

/**
 * Type-safe spacing utilities
 */
export type SpacingScale = keyof typeof SPACING;
export type SemanticSpacing = keyof typeof SPACING.SEMANTIC;

/**
 * Convert spacing token to CSS value
 */
export function getSpacing(token: SpacingScale | SemanticSpacing): string {
  if (typeof token === 'number' || !isNaN(Number(token))) {
    return SPACING[token as SpacingScale] || `${Number(token) * 4}px`;
  }
  
  // Handle semantic tokens
  const semanticValue = SPACING.SEMANTIC[token as SemanticSpacing];
  if (semanticValue) return semanticValue;
  
  // Fallback to 16px
  return '16px';
}

/**
 * Generate spacing CSS for a component
 */
export function generateSpacingStyles(options: {
  padding?: SpacingScale | SemanticSpacing | [SpacingScale, SpacingScale] | [SpacingScale, SpacingScale, SpacingScale, SpacingScale];
  margin?: SpacingScale | SemanticSpacing | [SpacingScale, SpacingScale] | [SpacingScale, SpacingScale, SpacingScale, SpacingScale];
  gap?: SpacingScale | SemanticSpacing;
}): Record<string, string> {
  const styles: Record<string, string> = {};
  
  // Handle padding
  if (options.padding) {
    if (Array.isArray(options.padding)) {
      if (options.padding.length === 2) {
        styles.padding = `${getSpacing(options.padding[0])} ${getSpacing(options.padding[1])}`;
      } else if (options.padding.length === 4) {
        styles.padding = `${getSpacing(options.padding[0])} ${getSpacing(options.padding[1])} ${getSpacing(options.padding[2])} ${getSpacing(options.padding[3])}`;
      }
    } else {
      styles.padding = getSpacing(options.padding);
    }
  }
  
  // Handle margin
  if (options.margin) {
    if (Array.isArray(options.margin)) {
      if (options.margin.length === 2) {
        styles.margin = `${getSpacing(options.margin[0])} ${getSpacing(options.margin[1])}`;
      } else if (options.margin.length === 4) {
        styles.margin = `${getSpacing(options.margin[0])} ${getSpacing(options.margin[1])} ${getSpacing(options.margin[2])} ${getSpacing(options.margin[3])}`;
      }
    } else {
      styles.margin = getSpacing(options.margin);
    }
  }
  
  // Handle gap
  if (options.gap) {
    styles.gap = getSpacing(options.gap);
  }
  
  return styles;
}

/**
 * Responsive spacing helper
 */
export function responsiveSpacing(
  base: SpacingScale | SemanticSpacing,
  sm?: SpacingScale | SemanticSpacing,
  md?: SpacingScale | SemanticSpacing,
  lg?: SpacingScale | SemanticSpacing
): string {
  const baseValue = getSpacing(base);
  const smValue = sm ? getSpacing(sm) : baseValue;
  const mdValue = md ? getSpacing(md) : smValue;
  const lgValue = lg ? getSpacing(lg) : mdValue;
  
  return `
    ${baseValue}
    ${sm !== undefined ? `sm:${smValue}` : ''}
    ${md !== undefined ? `md:${mdValue}` : ''}
    ${lg !== undefined ? `lg:${lgValue}` : ''}
  `.trim();
}