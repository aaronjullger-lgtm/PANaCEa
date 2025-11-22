import { buildConditionDefinition, findConditionMeta } from "../conditionRegistry.ts";
import type { Question } from "../types";

const afibMeta = findConditionMeta("Atrial Fibrillation");
const afibId = afibMeta ? buildConditionDefinition(afibMeta).id : "CV__ecg__atrial_fibrillation";

export const QUESTION_BANK: Question[] = [
  {
    question:
      "A 72-year-old with a history of hypertension presents with palpitations and an irregularly irregular pulse. What is the most appropriate initial rate-control medication?",
    options: ["Adenosine", "Metoprolol", "Lidocaine", "Procainamide"],
    correctAnswerIndex: 1,
    rationale:
      "Beta-blockers such as metoprolol are preferred first-line agents for ventricular rate control in hemodynamically stable atrial fibrillation without pre-excitation.",
    topic: "CV",
    system: "CV",
    subcategory: "ECG",
    conditionId: afibId,
    condition: "Atrial Fibrillation",
    pearls: [
      "Atrial fibrillation produces an irregularly irregular rhythm without discernible P waves.",
      "Rate control improves symptoms and prevents tachycardia-induced cardiomyopathy.",
      "Assess for anticoagulation needs using CHA2DS2-VASc scoring.",
    ],
  },
];
