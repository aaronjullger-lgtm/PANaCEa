import React from 'react';
import { cn } from '@/lib/utils';

// Spacing scale constants
export const SPACING = {
  xs: '0.5rem', // 8px
  sm: '0.75rem', // 12px
  md: '1rem', // 16px
  lg: '1.5rem', // 24px
  xl: '2rem', // 32px
  '2xl': '2.5rem', // 40px
  '3xl': '3rem', // 48px
} as const;

// Tailwind class equivalents
export const SPACING_CLASSES = {
  xs: 'space-y-2 gap-2 p-2',
  sm: 'space-y-3 gap-3 p-3',
  md: 'space-y-4 gap-4 p-4',
  lg: 'space-y-6 gap-6 p-6',
  xl: 'space-y-8 gap-8 p-8',
  '2xl': 'space-y-10 gap-10 p-10',
  '3xl': 'space-y-12 gap-12 p-12',
} as const;

export type SpacingSize = keyof typeof SPACING;

export interface SpacingProps {
  size?: SpacingSize;
  vertical?: boolean;
  horizontal?: boolean;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Spacing component for consistent vertical/horizontal spacing
 */
export const Spacing: React.FC<SpacingProps> = ({
  size = 'md',
  vertical = true,
  horizontal = false,
  children,
  className,
}) => {
  const baseClass = vertical ? 'space-y-4' : horizontal ? 'space-x-4' : '';
  const sizeClass = {
    xs: vertical ? 'space-y-2' : 'space-x-2',
    sm: vertical ? 'space-y-3' : 'space-x-3',
    md: vertical ? 'space-y-4' : 'space-x-4',
    lg: vertical ? 'space-y-6' : 'space-x-6',
    xl: vertical ? 'space-y-8' : 'space-x-8',
    '2xl': vertical ? 'space-y-10' : 'space-x-10',
    '3xl': vertical ? 'space-y-12' : 'space-x-12',
  }[size];

  return <div className={cn(baseClass, sizeClass, className)}>{children}</div>;
};

export interface StackProps {
  spacing?: SpacingSize;
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
  children?: React.ReactNode;
  className?: string;
}

/**
 * Stack component for vertical layouts with consistent spacing
 */
export const Stack: React.FC<StackProps> = ({
  spacing = 'md',
  align = 'stretch',
  justify = 'start',
  children,
  className,
}) => {
  const spacingClass = {
    xs: 'space-y-2',
    sm: 'space-y-3',
    md: 'space-y-4',
    lg: 'space-y-6',
    xl: 'space-y-8',
    '2xl': 'space-y-10',
    '3xl': 'space-y-12',
  }[spacing];

  const alignClass = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch',
  }[align];

  const justifyClass = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between',
    around: 'justify-around',
  }[justify];

  return (
    <div className={cn('flex flex-col', spacingClass, alignClass, justifyClass, className)}>
      {children}
    </div>
  );
};

export interface HStackProps {
  spacing?: SpacingSize;
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  wrap?: boolean;
  children?: React.ReactNode;
  className?: string;
}

/**
 * HStack component for horizontal layouts with consistent spacing
 */
export const HStack: React.FC<HStackProps> = ({
  spacing = 'md',
  align = 'center',
  justify = 'start',
  wrap = false,
  children,
  className,
}) => {
  const spacingClass = {
    xs: 'gap-2',
    sm: 'gap-3',
    md: 'gap-4',
    lg: 'gap-6',
    xl: 'gap-8',
    '2xl': 'gap-10',
    '3xl': 'gap-12',
  }[spacing];

  const alignClass = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch',
    baseline: 'items-baseline',
  }[align];

  const justifyClass = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between',
    around: 'justify-around',
    evenly: 'justify-evenly',
  }[justify];

  return (
    <div
      className={cn('flex', spacingClass, alignClass, justifyClass, wrap && 'flex-wrap', className)}
    >
      {children}
    </div>
  );
};

export interface GridProps {
  cols?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  gap?: SpacingSize;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Grid component for consistent grid layouts
 */
export const Grid: React.FC<GridProps> = ({ cols = 1, gap = 'md', children, className }) => {
  const gridColsClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6',
    7: 'grid-cols-7',
    8: 'grid-cols-8',
    9: 'grid-cols-9',
    10: 'grid-cols-10',
    11: 'grid-cols-11',
    12: 'grid-cols-12',
  }[cols];

  const gapClass = {
    xs: 'gap-2',
    sm: 'gap-3',
    md: 'gap-4',
    lg: 'gap-6',
    xl: 'gap-8',
    '2xl': 'gap-10',
    '3xl': 'gap-12',
  }[gap];

  return <div className={cn('grid', gridColsClass, gapClass, className)}>{children}</div>;
};

export interface ContainerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full' | 'fluid';
  padding?: SpacingSize | 'none';
  children?: React.ReactNode;
  className?: string;
}

/**
 * Container component for consistent content width and padding
 */
export const Container: React.FC<ContainerProps> = ({
  size = 'md',
  padding = 'md',
  children,
  className,
}) => {
  const sizeClass = {
    xs: 'max-w-xs',
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-full',
    fluid: 'w-full',
  }[size];

  const paddingClass =
    padding === 'none'
      ? ''
      : {
          xs: 'p-2',
          sm: 'p-3',
          md: 'p-4',
          lg: 'p-6',
          xl: 'p-8',
          '2xl': 'p-10',
          '3xl': 'p-12',
        }[padding];

  return <div className={cn('mx-auto', sizeClass, paddingClass, className)}>{children}</div>;
};

export interface CardProps {
  padding?: SpacingSize;
  spacing?: SpacingSize;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Card component with consistent spacing
 */
export const Card: React.FC<CardProps> = ({
  padding = 'md',
  spacing = 'md',
  children,
  className,
}) => {
  const paddingClass = {
    xs: 'p-2',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
    xl: 'p-8',
    '2xl': 'p-10',
    '3xl': 'p-12',
  }[padding];

  const spacingClass = {
    xs: 'space-y-2',
    sm: 'space-y-3',
    md: 'space-y-4',
    lg: 'space-y-6',
    xl: 'space-y-8',
    '2xl': 'space-y-10',
    '3xl': 'space-y-12',
  }[spacing];

  return (
    <div className={cn('rounded-lg border bg-card', paddingClass, spacingClass, className)}>
      {children}
    </div>
  );
};

export interface FormGroupProps {
  spacing?: SpacingSize;
  children?: React.ReactNode;
  className?: string;
}

/**
 * FormGroup component for consistent form spacing
 */
export const FormGroup: React.FC<FormGroupProps> = ({ spacing = 'md', children, className }) => {
  const spacingClass = {
    xs: 'space-y-1',
    sm: 'space-y-2',
    md: 'space-y-3',
    lg: 'space-y-4',
    xl: 'space-y-5',
    '2xl': 'space-y-6',
    '3xl': 'space-y-8',
  }[spacing];

  return <div className={cn('flex flex-col', spacingClass, className)}>{children}</div>;
};

export interface ButtonGroupProps {
  spacing?: SpacingSize;
  vertical?: boolean;
  children?: React.ReactNode;
  className?: string;
}

/**
 * ButtonGroup component for consistent button spacing
 */
export const ButtonGroup: React.FC<ButtonGroupProps> = ({
  spacing = 'md',
  vertical = false,
  children,
  className,
}) => {
  const spacingClass = vertical
    ? {
        xs: 'space-y-1',
        sm: 'space-y-2',
        md: 'space-y-3',
        lg: 'space-y-4',
        xl: 'space-y-5',
        '2xl': 'space-y-6',
      }[spacing]
    : {
        xs: 'gap-1',
        sm: 'gap-2',
        md: 'gap-3',
        lg: 'gap-4',
        xl: 'gap-5',
        '2xl': 'gap-6',
      }[spacing];

  const directionClass = vertical ? 'flex-col' : 'flex-row';

  return <div className={cn('flex', directionClass, spacingClass, className)}>{children}</div>;
};

/**
 * Utility hook for consistent spacing values
 */
export function useSpacing() {
  const getClass = (type: 'space-y' | 'space-x' | 'gap' | 'p' | 'm', size: SpacingSize): string => {
    const map = {
      'space-y': {
        xs: 'space-y-2',
        sm: 'space-y-3',
        md: 'space-y-4',
        lg: 'space-y-6',
        xl: 'space-y-8',
        '2xl': 'space-y-10',
        '3xl': 'space-y-12',
      },
      'space-x': {
        xs: 'space-x-2',
        sm: 'space-x-3',
        md: 'space-x-4',
        lg: 'space-x-6',
        xl: 'space-x-8',
        '2xl': 'space-x-10',
        '3xl': 'space-x-12',
      },
      gap: {
        xs: 'gap-2',
        sm: 'gap-3',
        md: 'gap-4',
        lg: 'gap-6',
        xl: 'gap-8',
        '2xl': 'gap-10',
        '3xl': 'gap-12',
      },
      p: {
        xs: 'p-2',
        sm: 'p-3',
        md: 'p-4',
        lg: 'p-6',
        xl: 'p-8',
        '2xl': 'p-10',
        '3xl': 'p-12',
      },
      m: {
        xs: 'm-2',
        sm: 'm-3',
        md: 'm-4',
        lg: 'm-6',
        xl: 'm-8',
        '2xl': 'm-10',
        '3xl': 'm-12',
      },
    };

    return map[type][size];
  };

  return {
    // Get spacing value in pixels
    getPixels: (size: SpacingSize): number => {
      const rem = parseFloat(SPACING[size]);
      return rem * 16; // Convert rem to pixels (1rem = 16px)
    },

    // Get Tailwind class for spacing
    getClass,

    // Check if element has consistent spacing
    checkConsistency: (element: HTMLElement): boolean => {
      const style = window.getComputedStyle(element);
      const padding = style.padding.split(' ').map((v) => parseFloat(v) || 0);
      const margin = style.margin.split(' ').map((v) => parseFloat(v) || 0);

      // Check if all padding values are the same
      const paddingConsistent = padding.every((val, _, arr) => val === arr[0]);
      // Check if all margin values are the same (or zero)
      const marginConsistent = margin.every((val, _, arr) => val === arr[0]);

      return paddingConsistent && marginConsistent;
    },

    // Apply consistent spacing to element
    applyConsistentSpacing: (element: HTMLElement, size: SpacingSize = 'md'): void => {
      const paddingClass = getClass('p', size);
      element.classList.add(paddingClass);

      // Remove any existing padding/margin classes
      const spacingClasses = [
        'p-',
        'px-',
        'py-',
        'pt-',
        'pb-',
        'pl-',
        'pr-',
        'm-',
        'mx-',
        'my-',
        'mt-',
        'mb-',
        'ml-',
        'mr-',
      ];

      spacingClasses.forEach((prefix) => {
        const classes = Array.from(element.classList).filter((cls) => cls.startsWith(prefix));
        classes.forEach((cls) => element.classList.remove(cls));
      });
    },
  };
}

/**
 * Example usage component
 */
export const SpacingExample: React.FC = () => {
  return (
    <Container size="lg" padding="lg">
      <Stack spacing="lg">
        <h2 className="text-2xl font-bold">Spacing Examples</h2>

        <Card>
          <Stack spacing="md">
            <h3 className="text-lg font-semibold">Stack (Vertical)</h3>
            <Stack spacing="sm">
              <div className="p-3 bg-[var(--color-category-practice)] rounded">Item 1</div>
              <div className="p-3 bg-[var(--color-category-practice)] rounded">Item 2</div>
              <div className="p-3 bg-[var(--color-category-practice)] rounded">Item 3</div>
            </Stack>
          </Stack>
        </Card>

        <Card>
          <Stack spacing="md">
            <h3 className="text-lg font-semibold">HStack (Horizontal)</h3>
            <HStack spacing="sm">
              <button className="px-4 py-2 bg-[var(--color-category-practice)] text-white rounded">Button 1</button>
              <button className="px-4 py-2 bg-[var(--color-text-muted)] rounded">Button 2</button>
              <button className="px-4 py-2 bg-[var(--color-text-muted)] rounded">Button 3</button>
            </HStack>
          </Stack>
        </Card>

        <Card>
          <Stack spacing="md">
            <h3 className="text-lg font-semibold">Grid</h3>
            <Grid cols={3} gap="md">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="p-4 bg-data-pass rounded text-center">
                  Item {i}
                </div>
              ))}
            </Grid>
          </Stack>
        </Card>

        <Card>
          <Stack spacing="md">
            <h3 className="text-lg font-semibold">Form Group</h3>
            <FormGroup spacing="md">
              <div>
                <label htmlFor="email-example" className="block text-sm font-medium mb-1">
                  Email
                </label>
                <input
                  id="email-example"
                  className="w-full p-2 border rounded"
                  placeholder="Enter your email"
                  aria-label="Email address"
                />
              </div>
              <div>
                <label htmlFor="password-example" className="block text-sm font-medium mb-1">
                  Password
                </label>
                <input
                  id="password-example"
                  type="password"
                  className="w-full p-2 border rounded"
                  placeholder="Enter your password"
                  aria-label="Password"
                />
              </div>
              <ButtonGroup>
                <button className="px-4 py-2 bg-[var(--color-category-practice)] text-white rounded">Submit</button>
                <button className="px-4 py-2 border rounded">Cancel</button>
              </ButtonGroup>
            </FormGroup>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
};
