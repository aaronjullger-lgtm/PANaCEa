// types/pharm.ts
// Type definitions for pharmacological data

export interface DrugPharmacokinetics {
  metabolism: string;
  elimination: string;
}

export interface DrugInteraction {
  drug?: string;
  category?: string;
  examples?: string;
  effect?: string;
}

export interface DrugEntry {
  term: string;
  type: string;
  class: string;
  subclass: string;
  MOA: string;
  ADEs: string[];
  contraindications: string[];
  interactions: (string | DrugInteraction)[];
  pharmacokinetics: DrugPharmacokinetics;
  clinicalNotes: string;
  antidote: string;
  ingredients: string[];
}

export interface DrugSearchResult {
  id: string;
  drugName: string;
  genericName?: string;
  drugClass: string;
  subclass: string;
  type: string;
  aliases: string[];
  score: number;
}

export interface DrugSearchFilters {
  drugClass?: string;
  type?: string;
}
