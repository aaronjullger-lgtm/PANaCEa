---
name: react-refactor
description: "Decompose large React components, extract custom hooks, consolidate useState into useReducer, and restructure JSX layouts. Use this skill whenever the user mentions refactoring a React component, breaking up a monolith, extracting hooks, reducing re-renders, consolidating state, replacing useState with useReducer, or restructuring JSX. Also trigger when a component exceeds ~500 lines or has more than 10 useState calls, or when the user says things like 'this component is too big', 'extract this into a hook', 'reduce re-renders', or 'clean up this component'."
---

# React Refactor

You're helping refactor large React components in a TypeScript + React 19 codebase. The goal is always the same: make components smaller, faster, and easier to reason about — without breaking behavior.

## Philosophy

Large React components accumulate state, handlers, effects, and JSX over time. The refactoring process is surgical: identify what can be extracted, extract it with zero behavioral change, then verify. Resist the urge to "improve" logic during extraction — that's a separate step. Refactoring and feature changes in the same pass create bugs that are hard to bisect.

## Assessment Phase

Before touching code, understand the component:

1. **Count state**: How many `useState` calls? If >10, consolidation into `useReducer` is likely worth it.
2. **Map view states**: Does the component render different UIs based on a state variable (e.g., `viewState === 'active'`)? Each view state is a candidate for extraction into its own component.
3. **Identify handler clusters**: Groups of callbacks that operate on related state are hook extraction candidates.
4. **Find memoization gaps**: Callbacks passed as props to child components should be wrapped in `useCallback`. Expensive computations should use `useMemo`.
5. **Check for dead code**: Unused state variables, unreachable branches, commented-out blocks.

## State Consolidation: useState → useReducer

When a component has many `useState` calls that represent a single conceptual state object, consolidate them.

### The Pattern

Create a dedicated hook file (e.g., `hooks/useEncounterReducer.ts`):

```typescript
// 1. Define the full state shape
interface ComponentState {
  viewState: ViewState;
  phase: Phase;
  isPaused: boolean;
  // ... all fields
}

// 2. Define action types
type Action =
  | { type: 'SET_FIELD'; field: keyof ComponentState; value: ComponentState[typeof field] }
  | { type: 'SET_FIELDS'; payload: Partial<ComponentState> }
  | { type: 'UPDATE_FIELD'; field: keyof ComponentState; updater: (prev: any) => any }
  | { type: 'RESET'; preserve?: (keyof ComponentState)[] };

// 3. Reducer with no-op optimization
function reducer(state: ComponentState, action: Action): ComponentState {
  switch (action.type) {
    case 'SET_FIELD':
      if (state[action.field] === action.value) return state; // no-op
      return { ...state, [action.field]: action.value };
    case 'SET_FIELDS':
      return { ...state, ...action.payload };
    case 'UPDATE_FIELD':
      return { ...state, [action.field]: action.updater(state[action.field]) };
    case 'RESET': {
      const preserved = action.preserve?.reduce(
        (acc, key) => ({ ...acc, [key]: state[key] }),
        {} as Partial<ComponentState>
      );
      return { ...INITIAL_STATE, ...preserved };
    }
  }
}

// 4. The set() factory — creates stable setter references
export function useComponentReducer() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  const set = useCallback(
    <K extends keyof ComponentState>(field: K) =>
      (value: ComponentState[K] | ((prev: ComponentState[K]) => ComponentState[K])) => {
        if (typeof value === 'function') {
          dispatch({ type: 'UPDATE_FIELD', field, updater: value as any });
        } else {
          dispatch({ type: 'SET_FIELD', field, value });
        }
      },
    [],
  );

  // 5. Named setters for drop-in replacement of useState setters
  const actions = useMemo(() => ({
    setViewState: set('viewState'),
    setPhase: set('phase'),
    setIsPaused: set('isPaused'),
    // ... one per field, matching old setter names exactly
    setFields: (payload: Partial<ComponentState>) => dispatch({ type: 'SET_FIELDS', payload }),
    reset: (preserve?: (keyof ComponentState)[]) => dispatch({ type: 'RESET', preserve }),
  }), [set]);

  return [state, dispatch, actions] as const;
}
```

### Migration Checklist

The critical thing is that the component's JSX and handlers should need **zero changes** after swapping in the reducer. This means:

- Every old `setFoo` must have a matching `actions.setFoo` with the same signature
- Functional updaters (`setFoo(prev => prev + 1)`) must work via the `UPDATE_FIELD` action
- Destructure both state and actions at the call site for drop-in compatibility:
  ```typescript
  const [state, , actions] = useComponentReducer();
  const { viewState, phase, isPaused } = state;
  const { setViewState, setPhase, setIsPaused } = actions;
  ```

## Hook Extraction

When extracting logic into a custom hook:

1. **Identify the boundary**: A hook should encapsulate a single concern — timer logic, telemetry collection, API communication, etc.
2. **Move state + effects + handlers together**: If a handler depends on certain state and effects, they all move as a unit.
3. **Return a clean API**: The hook's return type is its public contract. Return only what consumers need.
4. **Preserve reference stability**: Wrap returned callbacks in `useCallback` and returned objects in `useMemo` to prevent unnecessary re-renders in consumers.

## JSX Layout Refactoring

When restructuring JSX (e.g., converting modals to inline panels, changing grid layouts):

1. **Extract JSX into named variables** before the return statement when passing complex JSX as props. This prevents nesting bugs where a prop's opening tag absorbs subsequent JSX:
   ```typescript
   // GOOD: Extract first, then pass
   const sidebarContent = (
     <>
       <RapportMeter ... />
       <EncounterLog ... />
     </>
   );
   return <Workstation sidebarContent={sidebarContent}>...</Workstation>;

   // BAD: Inline complex JSX as prop value
   return <Workstation sidebarContent={<>
     <RapportMeter ... />  {/* Everything after here gets absorbed */}
   ```

2. **Use named slot props** for layout components rather than deep nesting:
   ```typescript
   interface WorkstationProps {
     children: ReactNode;      // main content
     sidebarContent: ReactNode; // sidebar
     orderPanel: ReactNode;     // order panel slot
     examPanel: ReactNode;      // exam panel slot
   }
   ```

3. **Responsive grid patterns**: Use Tailwind's `md:grid-cols-12` with dynamic column spans based on active panels:
   ```typescript
   const hasSidePanel = showOrders || showExam;
   // Main: col-span-7 when sidebar active, col-span-8 otherwise
   // Sidebar: col-span-5 when active, col-span-4 for just rapport/log
   ```

## Verification

After every refactoring step:

1. **TypeScript check**: Run `NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit` and filter for modified files
2. **Visual diff**: The rendered output should be pixel-identical before and after
3. **Handler signatures**: Every callback that existed before must still exist with the same name and signature
4. **Reference stability**: Verify `useCallback`/`useMemo` dependencies are correct — missing deps cause stale closures, extra deps cause unnecessary re-renders

## Common Pitfalls

- **Changing behavior during extraction**: Resist. Extract first, improve later.
- **Breaking functional updaters**: When consolidating state, ensure `setState(prev => ...)` patterns still work through the reducer's `UPDATE_FIELD` action.
- **JSX prop absorption**: When passing JSX as a prop inline, everything after the opening `{<>` until the matching `</>}` becomes part of that prop — including sibling elements you intended as children.
- **Forgetting to export types**: When extracting a hook to its own file, export the state interface and any enums/types that consumers need for type annotations.
- **Over-memoizing**: Not every value needs `useMemo`. Memoize when: (a) the value is passed as a prop to a `React.memo` child, or (b) the computation is genuinely expensive (>1ms).
