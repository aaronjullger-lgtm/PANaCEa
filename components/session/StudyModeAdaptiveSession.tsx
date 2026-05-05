import React, { useMemo } from 'react';
import CoreAdaptiveSession, {
  type CoreAdaptiveSessionProps,
  type CoreAdaptiveSessionScope,
} from './CoreAdaptiveSession';

type SharedAdaptiveModeProps = Omit<
  CoreAdaptiveSessionProps,
  | 'initialScope'
  | 'initialSessionSettings'
  | 'initialSelectorMode'
  | 'lockSelectorMode'
  | 'studyPlanSource'
>;

export interface SystemDrillSessionProps extends SharedAdaptiveModeProps {
  initialSystem?: string;
}

export const SystemDrillSession: React.FC<SystemDrillSessionProps> = ({
  initialSystem,
  ...props
}) => {
  const initialScope = useMemo<CoreAdaptiveSessionScope | null>(() => {
    if (!initialSystem) return null;
    return {
      mode: 'system',
      size: 20,
      system: initialSystem,
      systems: [initialSystem],
    };
  }, [initialSystem]);

  return (
    <CoreAdaptiveSession
      {...props}
      initialScope={initialScope}
      initialSelectorMode="system"
      lockSelectorMode
      studyPlanSource="mode-library"
    />
  );
};

export const ConditionDrillSession: React.FC<SharedAdaptiveModeProps> = (props) => (
  <CoreAdaptiveSession
    {...props}
    initialSelectorMode="condition"
    lockSelectorMode
    studyPlanSource="mode-library"
  />
);

export default SystemDrillSession;
