export interface PharmacologyEntry {
  id: string;
  term: string;
  type: "drug";
  class: string;
  subclass?: string;
  overview?: string;
  MOA?: string;
  ADEs?: string;
  contraindications?: string;
  interactions?: string;
  pharmacokinetics?: string;
  clinicalNotes?: string;
  antidote?: string;
}

export type PharmacologyRegistry = PharmacologyEntry[];
