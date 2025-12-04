/**
 * Lab Cases Data
 * 
 * Placeholder for future lab case data expansion.
 * Currently, lab cases are defined in hooks/game/use-mini-lab-drill.ts
 * 
 * This file exists to provide a centralized location for lab case data
 * when the codebase is refactored to separate data from business logic.
 */

import type { LabCase } from '@/hooks/game/use-mini-lab-drill';

/**
 * Additional lab cases can be added here for expansion
 */
export const ADDITIONAL_LAB_CASES: LabCase[] = [];

/**
 * Utility functions for lab case management
 */
export const labCaseHelpers = {
  filterByCategory(cases: LabCase[], category: string) {
    if (category === 'random') return cases;
    return cases.filter(c => c.category === category);
  },
  
  getRandomCase(cases: LabCase[]) {
    return cases[Math.floor(Math.random() * cases.length)];
  },
};
