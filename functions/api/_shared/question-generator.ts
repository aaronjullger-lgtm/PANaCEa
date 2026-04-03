import { GoogleGenerativeAI } from '@google/generative-ai';
import { QUESTION_RESPONSE_SCHEMA, GeneratedQuestionStrict } from './question-schema';
import { validateGeneratedQuestion } from './question-validator';
import { enrichWithPubMed, formatCitationsForPrompt, type PubMedCitation } from '../../../lib/services/question/pubmedEnricher';

export interface ConditionData {
  condition: string;
  sections: {
    overview: string;
    etiology: string;
    clinicalPresentation: string;
    diagnostics: string;
    treatment: string;
  };
}

export interface GroundingSource {
  uri: string;
  title: string;
}

export interface GeneratedQuestion {
  type: string;
  question: string;
  options?: string[];
  correctAnswer?: string;
  explanation?: {
    rationale: string;
    incorrect?: Record<string, string>;
  };
  difficulty: number;
  sourceSections?: string[];
  system?: string;
  generatedAt?: string;
  metadata?: any;
  id?: string;
  text?: string; // Fallback for some interfaces
  groundingSources?: GroundingSource[];
  pubmedCitations?: PubMedCitation[];
}

// Re-export strict interface for type-safe usage
export { GeneratedQuestionStrict };

/**
 * Fetch current clinical evidence for a condition via Google Search grounding.
 * Returns grounding context text and source citations to inject into generation prompts.
 * This is a separate call because structured output (responseMimeType: 'application/json')
 * is incompatible with Google Search tool in the Gemini API.
 */
async function fetchGroundingContext(
  apiKey: string,
  condition: string
): Promise<{ context: string; sources: GroundingSource[] }> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [{ googleSearch: {} } as any],
    });

    const result = await model.generateContent(
      `Summarize the current clinical guidelines for ${condition}, including diagnostic criteria, first-line treatment, and any recent guideline updates (AHA, ACC, ATS, IDSA, etc.). Focus on evidence-based recommendations. Be concise (under 300 words).`
    );

    const response = result.response;
    const text = response.text();

    // Extract grounding sources
    const sources: GroundingSource[] = [];
    const seen = new Set<string>();
    try {
      const candidates = (response as any)?.candidates || [];
      const chunks = candidates[0]?.groundingMetadata?.groundingChunks || [];
      for (const chunk of chunks) {
        const uri = chunk?.web?.uri;
        const title = chunk?.web?.title;
        if (uri && title && !seen.has(uri)) {
          seen.add(uri);
          sources.push({ uri, title });
        }
      }
    } catch { /* grounding metadata extraction is best-effort */ }

    return { context: text, sources: sources.slice(0, 5) };
  } catch (error) {
    console.warn('[question-generator] Grounding context fetch failed, proceeding without:', error);
    return { context: '', sources: [] };
  }
}

/**
 * Few-shot examples demonstrating clinical reasoning (via <thinking> tags)
 * and high-quality structured output format.
 * These examples model the thought process and distractor engineering.
 */
const GENERATION_FEW_SHOT = `
## Example 1: Cardiology — Atrial Fibrillation Rate Control (Third-Order)

<thinking>
Patient profile: 68-year-old male with new-onset AF, hemodynamically stable (BP 145/92, HR 110).
Key findings: No prior MI, normal ejection fraction, HTN on lisinopril, hyperlipidemia on statin.
Differential for AF: paroxysmal AF triggered by alcohol use (patient admits to 3 cocktails nightly), possible thyroid (TSH normal in vignette).
First-order question would be "What is the diagnosis?" — too obvious.
Third-order chain: Diagnose AF → Recognize rate control is needed (not rhythm control for paroxysmal) → Select appropriate agent for this patient (avoid beta-blockers if COPD, avoid diltiazem if HF).
Distractor engineering:
- Amiodarone: correct for rhythm control or severe HF, not first-line rate control in stable patient
- Metoprolol: correct for many scenarios, but patient has asthma (contraindicated) — must be in vignette as pertinent finding
- Flecainide: antiarrhythmic for rhythm control, wrong step
- Digoxin: outdated, only for HF + AF now
Gold standard: Diltiazem or beta-blocker for rate control. For this patient (asthma), diltiazem is best.
Pertinent negatives: No hyperthyroidism, no structural heart disease, no HF.
</thinking>

{
  "type": "vignette",
  "question": "A 68-year-old male with newly diagnosed atrial fibrillation is hemodynamically stable (blood pressure 145/92 mmHg, heart rate 112 bpm). He has a history of asthma (well-controlled on albuterol inhaler), hypertension (on lisinopril), and hyperlipidemia. Physical examination reveals an irregular heart rate and clear lung fields. ECG confirms atrial fibrillation with a rapid ventricular response. Transthoracic echocardiography shows preserved ejection fraction (55%), normal chamber size, and no valvular disease. TSH is normal. Which agent should be initiated for rate control in this patient?",
  "options": [
    "Diltiazem",
    "Metoprolol",
    "Amiodarone",
    "Digoxin"
  ],
  "correctAnswer": "Diltiazem",
  "explanation": {
    "rationale": "In hemodynamically stable atrial fibrillation with a rapid ventricular response, rate control is the priority. Diltiazem (a non-dihydropyridine calcium-channel blocker) is effective for rate control and is preferred in patients with asthma or COPD because it does not cause bronchospasm (unlike beta-blockers). The patient's preserved ejection fraction and absence of structural disease support first-line rate control (rather than rhythm control). Diltiazem targets AV nodal conduction and is well-tolerated.",
    "incorrect": {
      "A": "Metoprolol is an excellent rate-control agent in many AF patients; however, it is contraindicated in this patient due to a history of asthma. Beta-blockade can trigger bronchospasm and worsen asthma control.",
      "C": "Amiodarone is a broad-spectrum antiarrhythmic typically reserved for rhythm control (not rate control alone) or for AF in patients with concomitant heart failure. It is not first-line for simple rate control in stable paroxysmal AF and carries significant toxicity risk with long-term use.",
      "D": "Digoxin has a role only in AF patients with concurrent left ventricular systolic dysfunction or heart failure. The vignette specifies preserved ejection fraction with no HF, making digoxin inappropriate. Additionally, its narrow therapeutic window and slower onset make it less desirable for acute rate control."
    }
  },
  "difficulty": 0.65,
  "questionOrder": "third",
  "taskCategory": "management",
  "sourceSections": ["treatment", "clinicalPresentation"]
}

## Example 2: Pulmonary — Community-Acquired Pneumonia Empiric Treatment (Third-Order)

<thinking>
Patient profile: 34-year-old previously healthy woman, fever + cough × 5 days, no dyspnea at rest, outpatient presentation.
Key findings: Consolidation on CXR (likely CAP), WBC 12K, mild hypoxia (O2 sat 94%), BP stable, HR 98.
Clinical severity: Mild-to-moderate (outpatient-eligible per CURB-65 score 0-1).
Differential: Bacterial CAP (strep pneumoniae, haemophilus) vs. viral (less likely with CXR infiltrate) vs. atypical (mycoplasma, chlamydia).
First-order: "What is the diagnosis?" — Already established as CAP.
Third-order chain: Recognize CAP → Assess severity (CURB-65, PSI) → Apply ATS/IDSA guideline for empiric therapy at appropriate site of care → Consider risk factors (smoking, age, immunosuppression).
Distractor engineering:
- Amoxicillin: first-line for outpatient CAP without risk factors per ATS/IDSA (correct for her scenario)
- Respiratory fluoroquinolone (e.g., levofloxacin): also acceptable per guidelines, especially if atypical coverage desired; could be correct
- Azithromycin monotherapy: insufficient for pneumococcal coverage (incomplete)
- Vancomycin: overkill for outpatient CAP without risk factors; reserved for hospitalized, severe, or resistant cases
Gold standard: Amoxicillin (covers strep pneumoniae) or respiratory FQ (covers atypical). For uncomplicated outpatient CAP, amoxicillin is first-line.
Pertinent negatives: No immunosuppression, no recent antibiotics (no resistance risk), no risk for Pseudomonas or resistant gram-negatives, normotensive, good oxygenation at rest.
</thinking>

{
  "type": "vignette",
  "question": "A 34-year-old previously healthy woman presents to the outpatient clinic with a 5-day history of fever, productive cough, and malaise. She denies dyspnea at rest and has an oxygen saturation of 94% on room air. Blood pressure is 128/80 mmHg, heart rate 98 bpm, and respiratory rate 18/min. Physical examination reveals right lower lobe crackles. Chest X-ray shows a right lower lobe consolidation. CBC reveals WBC 12,500/μL, and renal function is normal. There is no prior antibiotic use in the last 3 months. Which agent is most appropriate for empiric therapy?",
  "options": [
    "Amoxicillin",
    "Azithromycin monotherapy",
    "Levofloxacin",
    "Vancomycin"
  ],
  "correctAnswer": "Amoxicillin",
  "explanation": {
    "rationale": "This patient has community-acquired pneumonia (CAP) of mild-to-moderate severity eligible for outpatient management (CURB-65 score 0, no risk factors for resistant pathogens, preserved oxygenation). Per ATS/IDSA guidelines, empiric therapy for outpatient CAP in previously healthy patients without comorbidities or recent antibiotic exposure is amoxicillin, which covers Streptococcus pneumoniae. No atypical coverage is required in this low-risk scenario. Amoxicillin is cost-effective, well-tolerated, and meets all guideline criteria.",
    "incorrect": {
      "B": "Azithromycin monotherapy is insufficient for outpatient CAP because it does not reliably cover Streptococcus pneumoniae. While azithromycin covers atypical organisms (Mycoplasma, Chlamydia), the presence of a consolidate infiltrate on CXR and leukocytosis make bacterial CAP (particularly pneumococcal) more likely; combination therapy (azithromycin + beta-lactam) would be needed if atypical coverage were desired, but monotherapy with azithromycin alone is inadequate.",
      "C": "Levofloxacin (a respiratory fluoroquinolone) is an acceptable alternative per ATS/IDSA guidelines, especially if atypical coverage is desired. However, in this low-risk, previously healthy patient with uncomplicated CAP, fluoroquinolones are reserved as second-line due to concerns about resistance development and adverse effects (tendinopathy, QT prolongation). First-line amoxicillin is preferred.",
      "D": "Vancomycin is reserved for hospitalized patients with severe CAP, risk factors for resistant pneumococci (recent hospitalization, antibiotics, immunosuppression), or empiric therapy in ICU settings. This outpatient with mild-to-moderate CAP and no risk factors for resistant organisms does not warrant vancomycin. Escalation to vancomycin would be inappropriate and would unnecessarily increase costs and toxicity risk."
    }
  },
  "difficulty": 0.65,
  "questionOrder": "third",
  "taskCategory": "pharmaceutical",
  "sourceSections": ["treatment", "clinicalPresentation"]
}
`;

export async function generateSingleQuestion(
  apiKey: string,
  condition: ConditionData,
  type: string,
  textbookContext?: { title: string; excerpts: string[] } | null
): Promise<GeneratedQuestion | null> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  // Phase 1a: Fetch current clinical evidence via Google Search grounding
  // This is a separate call because structured output is incompatible with search tools
  const grounding = await fetchGroundingContext(apiKey, condition.condition);

  // Phase 1b: Fetch PubMed citations for peer-reviewed evidence
  const pubmedCitations = await enrichWithPubMed(condition.condition);
  const pubmedBlock = formatCitationsForPrompt(pubmedCitations);

  const textbookBlock =
    textbookContext && textbookContext.excerpts.length > 0
      ? `
    TEXTBOOK CONTEXT (use ONLY as supporting evidence):
    Source: ${textbookContext.title}
    Excerpts:
    ${textbookContext.excerpts.map((excerpt, idx) => `${idx + 1}. ${excerpt}`).join('\n')}
    `
      : '';

  // Pass findings-only for vignette-building; withhold condition/overview from vignette text
  const sections = condition.sections || {};
  const findingsContext = [
    sections.clinicalPresentation
      ? `Clinical Presentation: ${String(sections.clinicalPresentation).slice(0, 500)}`
      : '',
    sections.diagnostics
      ? `Lab/Imaging Patterns: ${String(sections.diagnostics).slice(0, 400)}`
      : '',
    sections.treatment ? `Treatment (for answer accuracy only): ${String(sections.treatment).slice(0, 300)}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const groundingBlock = grounding.context
    ? `
    CURRENT CLINICAL EVIDENCE (from Google Search — use to verify accuracy):
    ${grounding.context}
    `
    : '';

  const prompt = `
    CONTEXT - Use these clinical findings to build the vignette. Do NOT include condition name or diagnosis in the vignette.
    ${findingsContext}
    ${textbookBlock}
    ${groundingBlock}
    ${pubmedBlock}

    CRITICAL - RAW PATIENT DATA: NEVER state the diagnosis or condition name in the vignette. Provide raw patient data only (demographics, symptoms, labs, vitals).

    KAPLAN-LEVEL RULES:
    - Third-order / "Double Jump" (STRICT): Prefer stems that require a chain (Vignette → Diagnosis → Complication/next step → Answer). Example: circular rash → Lyme → first-line for complication → mechanism of doxycycline (30S). Avoid first-order "What is the diagnosis?" when a third-order stem is feasible.
    - Kaplan-level distractors: Every wrong answer must be correct for a slightly different patient. No obviously wrong options.
    - Gold standard vs. initial: For "best initial step" or "next test" questions, include the gold standard as a distractor; rationale must clarify why it is wrong for this step.
    - Next best step: For "next step in management," state what has already been done first, then ask for the immediate next action.
    - Pertinent negatives: Include at least 2 pertinent negatives that rule out top differentials. Pharmacological contraindications: For therapeutics, include comorbidity that contraindicates first-line (e.g. HTN + gout; otitis + penicillin allergy).

    QUESTION ORDER TAXONOMY (REQUIRED — set "questionOrder" field):
    - "first" = Remember/Understand (Bloom's 1-2). Single-step recall: "What is the mechanism of X?" or "Which lab confirms Y?" Difficulty 0.2–0.4.
    - "second" = Apply/Analyze (Bloom's 3-4). One intermediate reasoning step: "Patient presents with X findings → What is the diagnosis?" or "Given diagnosis Y → What is first-line treatment?" Difficulty 0.4–0.6.
    - "third" = Evaluate/Create (Bloom's 5-6). Multi-step vignette with confounders: "Vignette → Diagnosis → Complication/contraindication → Best next step." Difficulty 0.6–0.9. This is preferred for PANCE-level questions.

    TASK CATEGORY (REQUIRED — set "taskCategory" field):
    Assign ONE of: history_pe, diagnostics, diagnosis, management, health_maintenance, pharmaceutical, basic_science, professional.
    Match the primary cognitive task the question tests (e.g., "Which test to order?" = diagnostics, "What is the next step in management?" = management).

    FEW-SHOT EXAMPLES:
    Below are two examples showing clinical reasoning (in <thinking> tags) and high-quality JSON output.
    ${GENERATION_FEW_SHOT}

    TASK:
    Generate one high-quality '${type}' question strictly based on the data above.
    If textbook context is present, ensure the question aligns with those excerpts.
    Follow the format and reasoning pattern shown in the examples above.
    Output ONLY valid JSON matching the schema.
  `;

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: QUESTION_RESPONSE_SCHEMA,
        temperature: 0.7
      }
    });

    const response = await result.response;
    const text = response.text();

    // Parse JSON directly from Gemini's structured output
    const question = JSON.parse(text) as GeneratedQuestionStrict;

    // Validate the generated question
    const validation = validateGeneratedQuestion(question);
    if (!validation.valid) {
      console.error('Question validation failed:', validation.errors);
      return null;
    }

    // Attach grounding sources for evidence citations in the UI
    if (grounding.sources.length > 0) {
      (question as any).groundingSources = grounding.sources;
    }

    // Attach PubMed citations for peer-reviewed references
    if (pubmedCitations.length > 0) {
      (question as any).pubmedCitations = pubmedCitations;
    }

    return question;
  } catch (error) {
    console.error('Error generating question:', error);
    return null;
  }
}
