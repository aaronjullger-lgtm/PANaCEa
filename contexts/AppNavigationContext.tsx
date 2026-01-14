/**
 * AppNavigationContext
 * 
 * Centralized navigation state management for the application.
 * Handles view routing, drill mode navigation, and URL-based navigation preparation.
 * Extracted from App.tsx to reduce component complexity.
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { TrainingModeId } from '../config/training-modes';

/** All possible views in the application */
export type AppView = 
  | "menu" 
  | "command_center" 
  | "quiz" 
  | "integrations" 
  | "photo_drill" 
  | "ecg_drill" 
  | "derm_drill" 
  | "imaging_drill" 
  | "rapid_recall" 
  | "ddx_compare" 
  | "mini_lab" 
  | "pharmacology" 
  | "first_line_treatment" 
  | "condition_drill" 
  | "system_drill" 
  | "subcategory_drill" 
  | "guideline_drill" 
  | "fluid_electrolyte" 
  | "antibiotic_mode" 
  | "patient_encounter" 
  | "panre_la" 
  | "code_blue_speed" 
  | "grand_rounds" 
  | "ventilator_hero" 
  | "physiology_drill" 
  | "anatomy_review" 
  | "admin_media" 
  | "social_dashboard" 
  | "toolkit" 
  | "gap_analysis" 
  | "clinical_profile" 
  | "training_menu" 
  | "simulation_page" 
  | "command_center_page" 
  | "reference_library";

/** Drill mode IDs that have dedicated view implementations */
const DRILL_MODE_PHOTO: TrainingModeId = 'photo_drill';
const DRILL_MODE_ECG: TrainingModeId = 'ecg_drill';
const DRILL_MODE_DERM: TrainingModeId = 'derm_drill';
const DRILL_MODE_IMAGING: TrainingModeId = 'imaging_drill';
const DRILL_MODE_RAPID_RECALL: TrainingModeId = 'rapid_recall';
const DRILL_MODE_DDX_COMPARE: TrainingModeId = 'ddx_compare';
const DRILL_MODE_MINI_LAB: TrainingModeId = 'mini_lab';
const DRILL_MODE_PHARMACOLOGY: TrainingModeId = 'pharmacology';
const DRILL_MODE_FIRST_LINE: TrainingModeId = 'first_line_treatment';
const DRILL_MODE_CONDITION: TrainingModeId = 'condition_drill';
const DRILL_MODE_SYSTEM: TrainingModeId = 'system_drill';
const DRILL_MODE_SUBCATEGORY: TrainingModeId = 'subcategory_drill';
const DRILL_MODE_GUIDELINE: TrainingModeId = 'guideline_drill';
const DRILL_MODE_FLUID_ELECTROLYTE: TrainingModeId = 'fluid_electrolyte';
const DRILL_MODE_ANTIBIOTIC: TrainingModeId = 'antibiotic_mode';
const DRILL_MODE_PATIENT_ENCOUNTER: TrainingModeId = 'patient_encounter';
const DRILL_MODE_CODE_BLUE: TrainingModeId = 'code_blue_speed';
const DRILL_MODE_GRAND_ROUNDS: TrainingModeId = 'grand_rounds';
const DRILL_MODE_VENTILATOR: TrainingModeId = 'ventilator_hero';
const DRILL_MODE_PHYSIOLOGY: TrainingModeId = 'physiology_drill';
const DRILL_MODE_ANATOMY: TrainingModeId = 'anatomy_review';

/** Mapping from mode IDs to view names */
const MODE_VIEW_MAP: Record<string, AppView> = {
  [DRILL_MODE_PHOTO]: 'photo_drill',
  [DRILL_MODE_ECG]: 'ecg_drill',
  [DRILL_MODE_DERM]: 'derm_drill',
  [DRILL_MODE_IMAGING]: 'imaging_drill',
  [DRILL_MODE_RAPID_RECALL]: 'rapid_recall',
  [DRILL_MODE_DDX_COMPARE]: 'ddx_compare',
  [DRILL_MODE_MINI_LAB]: 'mini_lab',
  [DRILL_MODE_PHARMACOLOGY]: 'pharmacology',
  [DRILL_MODE_FIRST_LINE]: 'first_line_treatment',
  [DRILL_MODE_CONDITION]: 'condition_drill',
  [DRILL_MODE_SYSTEM]: 'system_drill',
  [DRILL_MODE_SUBCATEGORY]: 'subcategory_drill',
  [DRILL_MODE_GUIDELINE]: 'guideline_drill',
  [DRILL_MODE_FLUID_ELECTROLYTE]: 'fluid_electrolyte',
  [DRILL_MODE_ANTIBIOTIC]: 'antibiotic_mode',
  [DRILL_MODE_PATIENT_ENCOUNTER]: 'patient_encounter',
  [DRILL_MODE_CODE_BLUE]: 'code_blue_speed',
  [DRILL_MODE_GRAND_ROUNDS]: 'grand_rounds',
  'panre_la': 'panre_la',
  [DRILL_MODE_VENTILATOR]: 'ventilator_hero',
  [DRILL_MODE_PHYSIOLOGY]: 'physiology_drill',
  [DRILL_MODE_ANATOMY]: 'anatomy_review',
  'admin_media': 'admin_media',
  'toolkit': 'toolkit',
};

interface AppNavigationContextValue {
  /** Current active view */
  view: AppView;
  /** Set the current view */
  setView: React.Dispatch<React.SetStateAction<AppView>>;
  /** Navigate to a drill mode by its ID */
  navigateToDrillMode: (modeId: string) => void;
  /** Navigate to command center */
  navigateToCommandCenter: () => void;
  /** Navigate to simulation page */
  navigateToSimulation: () => void;
  /** Navigate to toolkit */
  navigateToToolkit: () => void;
  /** Navigate to gap analysis */
  navigateToGapAnalysis: () => void;
  /** Navigate to clinical profile */
  navigateToClinicalProfile: () => void;
  /** Navigate to integrations */
  navigateToIntegrations: () => void;
  /** Navigate to reference library */
  navigateToReferenceLibrary: () => void;
  /** Navigate to quiz */
  navigateToQuiz: () => void;
  /** Navigate to menu */
  navigateToMenu: () => void;
}

const AppNavigationContext = createContext<AppNavigationContextValue | null>(null);

interface AppNavigationProviderProps {
  children: ReactNode;
  initialView?: AppView;
}

export function AppNavigationProvider({ 
  children, 
  initialView = 'command_center' 
}: AppNavigationProviderProps) {
  const [view, setView] = useState<AppView>(initialView);

  const navigateToDrillMode = useCallback((modeId: string) => {
    const targetView = MODE_VIEW_MAP[modeId];
    if (targetView) {
      setView(targetView);
    }
  }, []);

  const navigateToCommandCenter = useCallback(() => {
    setView('command_center');
  }, []);

  const navigateToSimulation = useCallback(() => {
    setView('simulation_page');
  }, []);

  const navigateToToolkit = useCallback(() => {
    setView('toolkit');
  }, []);

  const navigateToGapAnalysis = useCallback(() => {
    setView('gap_analysis');
  }, []);

  const navigateToClinicalProfile = useCallback(() => {
    setView('clinical_profile');
  }, []);

  const navigateToIntegrations = useCallback(() => {
    setView('integrations');
  }, []);

  const navigateToReferenceLibrary = useCallback(() => {
    setView('reference_library');
  }, []);

  const navigateToQuiz = useCallback(() => {
    setView('quiz');
  }, []);

  const navigateToMenu = useCallback(() => {
    setView('menu');
  }, []);

  const value: AppNavigationContextValue = {
    view,
    setView,
    navigateToDrillMode,
    navigateToCommandCenter,
    navigateToSimulation,
    navigateToToolkit,
    navigateToGapAnalysis,
    navigateToClinicalProfile,
    navigateToIntegrations,
    navigateToReferenceLibrary,
    navigateToQuiz,
    navigateToMenu,
  };

  return (
    <AppNavigationContext.Provider value={value}>
      {children}
    </AppNavigationContext.Provider>
  );
}

export function useAppNavigation(): AppNavigationContextValue {
  const context = useContext(AppNavigationContext);
  if (!context) {
    throw new Error('useAppNavigation must be used within AppNavigationProvider');
  }
  return context;
}

export default AppNavigationContext;
