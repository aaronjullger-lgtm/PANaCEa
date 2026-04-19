/**
 * PANaCEa Relevance Benchmark
 *
 * Curated PA-student query set for measuring clinical-library retrieval
 * quality. Each query specifies its intent type and the *condition names* that
 * should appear in the top-K results. Names are resolved to MedicalContent IDs
 * at benchmark time (see scripts/run-relevance-benchmark.ts), so this file
 * stays stable across content regenerations.
 *
 * NCCPA blueprint coverage: CV, PULM, ID, GI, Neuro, GU, Endo, MSK, Derm,
 * Heme/Onc, EENT, Psych, Repro, Renal — 30 queries spread across systems and
 * intent types (lookup / management / diagnostics / differential / safety).
 *
 * Relevance model: a condition is "relevant" for a query if its canonical
 * name (or listed synonym) is semantically the answer a PA student would
 * expect from a reference search — NOT every tangentially related condition.
 * Keeps the metric tight; reranker/embedding regressions surface cleanly.
 *
 * Metrics computed: Hit@1, Hit@5, Hit@10, MRR, plus per-intent breakdown.
 */

export type IntentType =
  | 'lookup'          // "What is X"
  | 'management'      // "Treatment of X"
  | 'diagnostics'     // "Best initial test for X"
  | 'differential'   // "X vs Y", "causes of Z"
  | 'safety';         // "Contraindications to X", "side effects of Y"

export interface RelevanceQuery {
  id: string;
  query: string;
  intent: IntentType;
  system: string;                 // NCCPA body system
  /** Canonical condition names (match case-insensitive, exact). */
  relevantConditions: string[];
  /** Condition synonyms that should also be accepted. */
  relevantSynonyms?: string[];
}

export const PANACEA_RELEVANCE_QUERIES: RelevanceQuery[] = [
  // ── Cardiovascular ────────────────────────────────────────────────────────
  {
    id: 'cv-01',
    query: 'crushing substernal chest pain radiating to left arm in a 58-year-old',
    intent: 'lookup',
    system: 'Cardiovascular',
    relevantConditions: ['Acute myocardial infarction', 'STEMI'],
    relevantSynonyms: ['Myocardial infarction', 'Heart attack', 'MI'],
  },
  {
    id: 'cv-02',
    query: 'first line treatment for new onset atrial fibrillation with rapid ventricular response',
    intent: 'management',
    system: 'Cardiovascular',
    relevantConditions: ['Atrial fibrillation'],
    relevantSynonyms: ['AFib', 'A-fib'],
  },
  {
    id: 'cv-03',
    query: 'best initial test for suspected pulmonary embolism with high Wells score',
    intent: 'diagnostics',
    system: 'Cardiovascular',
    relevantConditions: ['Pulmonary embolism'],
    relevantSynonyms: ['PE'],
  },
  {
    id: 'cv-04',
    query: 'tearing chest pain radiating to back in hypertensive patient',
    intent: 'differential',
    system: 'Cardiovascular',
    relevantConditions: ['Aortic dissection'],
  },

  // ── Pulmonary ─────────────────────────────────────────────────────────────
  {
    id: 'pulm-01',
    query: 'management of community acquired pneumonia outpatient',
    intent: 'management',
    system: 'Pulmonary',
    relevantConditions: ['Community-acquired pneumonia', 'Pneumonia'],
    relevantSynonyms: ['CAP'],
  },
  {
    id: 'pulm-02',
    query: 'COPD exacerbation first line therapy',
    intent: 'management',
    system: 'Pulmonary',
    relevantConditions: ['Chronic obstructive pulmonary disease', 'COPD exacerbation'],
    relevantSynonyms: ['COPD'],
  },
  {
    id: 'pulm-03',
    query: 'wheezing child age 4 with peanut exposure',
    intent: 'differential',
    system: 'Pulmonary',
    relevantConditions: ['Foreign body aspiration', 'Asthma'],
  },
  {
    id: 'pulm-04',
    query: 'tension pneumothorax diagnosis',
    intent: 'diagnostics',
    system: 'Pulmonary',
    relevantConditions: ['Tension pneumothorax', 'Pneumothorax'],
  },

  // ── Infectious Disease ────────────────────────────────────────────────────
  {
    id: 'id-01',
    query: 'empiric antibiotics for suspected bacterial meningitis adult',
    intent: 'management',
    system: 'Infectious Disease',
    relevantConditions: ['Bacterial meningitis', 'Meningitis'],
  },
  {
    id: 'id-02',
    query: 'uncomplicated UTI first line antibiotic',
    intent: 'management',
    system: 'Infectious Disease',
    relevantConditions: ['Urinary tract infection', 'Cystitis'],
    relevantSynonyms: ['UTI'],
  },
  {
    id: 'id-03',
    query: 'ring enhancing lesion on brain imaging in HIV patient',
    intent: 'differential',
    system: 'Infectious Disease',
    relevantConditions: ['Toxoplasmosis', 'CNS toxoplasmosis'],
  },

  // ── Gastrointestinal ──────────────────────────────────────────────────────
  {
    id: 'gi-01',
    query: 'acute appendicitis imaging study of choice',
    intent: 'diagnostics',
    system: 'Gastrointestinal',
    relevantConditions: ['Appendicitis', 'Acute appendicitis'],
  },
  {
    id: 'gi-02',
    query: 'coffee ground emesis management',
    intent: 'management',
    system: 'Gastrointestinal',
    relevantConditions: ['Upper GI bleed', 'Peptic ulcer disease'],
    relevantSynonyms: ['UGIB'],
  },
  {
    id: 'gi-03',
    query: 'charcot triad',
    intent: 'lookup',
    system: 'Gastrointestinal',
    relevantConditions: ['Ascending cholangitis', 'Cholangitis'],
  },

  // ── Neurology ─────────────────────────────────────────────────────────────
  {
    id: 'neuro-01',
    query: 'sudden thunderclap headache worst of life',
    intent: 'differential',
    system: 'Neurology',
    relevantConditions: ['Subarachnoid hemorrhage'],
    relevantSynonyms: ['SAH'],
  },
  {
    id: 'neuro-02',
    query: 'acute ischemic stroke window for tPA',
    intent: 'management',
    system: 'Neurology',
    relevantConditions: ['Ischemic stroke', 'Acute ischemic stroke'],
    relevantSynonyms: ['CVA', 'Stroke'],
  },
  {
    id: 'neuro-03',
    query: 'ascending paralysis after GI illness',
    intent: 'differential',
    system: 'Neurology',
    relevantConditions: ['Guillain-Barré syndrome', 'Guillain Barre syndrome'],
    relevantSynonyms: ['GBS'],
  },

  // ── Genitourinary ─────────────────────────────────────────────────────────
  {
    id: 'gu-01',
    query: 'sudden testicular pain with absent cremasteric reflex',
    intent: 'differential',
    system: 'Genitourinary',
    relevantConditions: ['Testicular torsion'],
  },

  // ── Endocrine ─────────────────────────────────────────────────────────────
  {
    id: 'endo-01',
    query: 'diabetic ketoacidosis management protocol',
    intent: 'management',
    system: 'Endocrine',
    relevantConditions: ['Diabetic ketoacidosis'],
    relevantSynonyms: ['DKA'],
  },
  {
    id: 'endo-02',
    query: 'hyperthyroidism first line treatment',
    intent: 'management',
    system: 'Endocrine',
    relevantConditions: ["Graves' disease", 'Hyperthyroidism', 'Graves disease'],
  },

  // ── Musculoskeletal ───────────────────────────────────────────────────────
  {
    id: 'msk-01',
    query: 'red swollen painful knee with crystals on arthrocentesis',
    intent: 'differential',
    system: 'Musculoskeletal',
    relevantConditions: ['Gout', 'Acute gout'],
  },
  {
    id: 'msk-02',
    query: 'cauda equina syndrome red flags',
    intent: 'safety',
    system: 'Musculoskeletal',
    relevantConditions: ['Cauda equina syndrome'],
  },

  // ── Dermatology ───────────────────────────────────────────────────────────
  {
    id: 'derm-01',
    query: 'target lesions after sulfa drug use',
    intent: 'differential',
    system: 'Dermatology',
    relevantConditions: ['Stevens-Johnson syndrome', 'Erythema multiforme'],
    relevantSynonyms: ['SJS'],
  },

  // ── Heme / Onc ────────────────────────────────────────────────────────────
  {
    id: 'heme-01',
    query: 'warfarin INR target for atrial fibrillation',
    intent: 'safety',
    system: 'Hematology',
    relevantConditions: ['Warfarin', 'Atrial fibrillation'],
  },
  {
    id: 'heme-02',
    query: 'schistocytes thrombocytopenia fever',
    intent: 'differential',
    system: 'Hematology',
    relevantConditions: ['Thrombotic thrombocytopenic purpura'],
    relevantSynonyms: ['TTP'],
  },

  // ── EENT ──────────────────────────────────────────────────────────────────
  {
    id: 'eent-01',
    query: 'sudden painful unilateral vision loss with halos',
    intent: 'differential',
    system: 'EENT',
    relevantConditions: ['Acute angle-closure glaucoma'],
  },

  // ── Psychiatry ────────────────────────────────────────────────────────────
  {
    id: 'psych-01',
    query: 'SSRI contraindication with MAOI',
    intent: 'safety',
    system: 'Psychiatry',
    relevantConditions: ['Serotonin syndrome'],
  },

  // ── Reproductive / OB-GYN ─────────────────────────────────────────────────
  {
    id: 'repro-01',
    query: 'first trimester vaginal bleeding with positive pregnancy test',
    intent: 'differential',
    system: 'Reproductive',
    relevantConditions: ['Ectopic pregnancy', 'Threatened abortion'],
  },

  // ── Renal ─────────────────────────────────────────────────────────────────
  {
    id: 'renal-01',
    query: 'nephrotic syndrome triad',
    intent: 'lookup',
    system: 'Renal',
    relevantConditions: ['Nephrotic syndrome'],
  },
  {
    id: 'renal-02',
    query: 'hyperkalemia EKG changes management',
    intent: 'management',
    system: 'Renal',
    relevantConditions: ['Hyperkalemia'],
  },
];

// ─── Scoring ────────────────────────────────────────────────────────────────

/**
 * Normalize a condition name for matching — lowercases, strips punctuation,
 * collapses whitespace. Accepts synonyms as equivalents.
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildAcceptSet(q: RelevanceQuery): Set<string> {
  const set = new Set<string>();
  for (const n of q.relevantConditions) set.add(normalizeName(n));
  for (const n of q.relevantSynonyms ?? []) set.add(normalizeName(n));
  return set;
}

export interface RankedHit {
  id: string;
  condition: string;
}

export interface QueryScore {
  queryId: string;
  intent: IntentType;
  system: string;
  hitAt1: boolean;
  hitAt5: boolean;
  hitAt10: boolean;
  firstHitRank: number | null; // 1-based; null if not found in top 10
}

export interface BenchmarkSummary {
  hitAt1: number;
  hitAt5: number;
  hitAt10: number;
  mrr: number;
  perIntent: Record<IntentType, { hitAt5: number; mrr: number; n: number }>;
  perSystem: Record<string, { hitAt5: number; mrr: number; n: number }>;
  perQuery: QueryScore[];
}

/**
 * Given a list of ranked search hits for one query, return the score.
 * Matches on condition name (case/punctuation-insensitive) against the
 * query's relevantConditions + synonyms.
 */
export function scoreSingleQuery(q: RelevanceQuery, ranked: RankedHit[]): QueryScore {
  const accept = buildAcceptSet(q);
  const top10 = ranked.slice(0, 10);

  let firstHitRank: number | null = null;
  for (let i = 0; i < top10.length; i++) {
    const name = normalizeName(top10[i].condition ?? '');
    if (accept.has(name)) {
      firstHitRank = i + 1;
      break;
    }
  }

  return {
    queryId: q.id,
    intent: q.intent,
    system: q.system,
    hitAt1: firstHitRank === 1,
    hitAt5: firstHitRank !== null && firstHitRank <= 5,
    hitAt10: firstHitRank !== null && firstHitRank <= 10,
    firstHitRank,
  };
}

export function summarize(perQuery: QueryScore[]): BenchmarkSummary {
  const n = perQuery.length || 1;
  const hit = (pred: (s: QueryScore) => boolean) =>
    perQuery.filter(pred).length / n;
  const mrr =
    perQuery.reduce((acc, s) => acc + (s.firstHitRank ? 1 / s.firstHitRank : 0), 0) / n;

  const perIntent = {} as BenchmarkSummary['perIntent'];
  const perSystem: BenchmarkSummary['perSystem'] = {};

  const groupBy = <K extends string>(key: (s: QueryScore) => K) => {
    const map = new Map<K, QueryScore[]>();
    for (const s of perQuery) {
      const k = key(s);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    return map;
  };

  for (const [intent, list] of groupBy((s) => s.intent).entries()) {
    const m = list.length || 1;
    perIntent[intent] = {
      hitAt5: list.filter((s) => s.hitAt5).length / m,
      mrr: list.reduce((a, s) => a + (s.firstHitRank ? 1 / s.firstHitRank : 0), 0) / m,
      n: list.length,
    };
  }
  for (const [system, list] of groupBy((s) => s.system).entries()) {
    const m = list.length || 1;
    perSystem[system] = {
      hitAt5: list.filter((s) => s.hitAt5).length / m,
      mrr: list.reduce((a, s) => a + (s.firstHitRank ? 1 / s.firstHitRank : 0), 0) / m,
      n: list.length,
    };
  }

  return {
    hitAt1: hit((s) => s.hitAt1),
    hitAt5: hit((s) => s.hitAt5),
    hitAt10: hit((s) => s.hitAt10),
    mrr,
    perIntent,
    perSystem,
    perQuery,
  };
}

export function formatSummary(s: BenchmarkSummary): string {
  const pct = (x: number) => (x * 100).toFixed(1) + '%';
  const lines: string[] = [];
  lines.push('PANaCEa Relevance Benchmark');
  lines.push('='.repeat(52));
  lines.push(`Queries scored : ${s.perQuery.length}`);
  lines.push(`Hit@1          : ${pct(s.hitAt1)}`);
  lines.push(`Hit@5          : ${pct(s.hitAt5)}   ← primary metric`);
  lines.push(`Hit@10         : ${pct(s.hitAt10)}`);
  lines.push(`MRR            : ${s.mrr.toFixed(3)}`);
  lines.push('');
  lines.push('By intent:');
  for (const [intent, v] of Object.entries(s.perIntent)) {
    lines.push(`  ${intent.padEnd(14)} Hit@5=${pct(v.hitAt5)}  MRR=${v.mrr.toFixed(3)}  (n=${v.n})`);
  }
  lines.push('');
  lines.push('By system:');
  for (const [system, v] of Object.entries(s.perSystem)) {
    lines.push(`  ${system.padEnd(20)} Hit@5=${pct(v.hitAt5)}  MRR=${v.mrr.toFixed(3)}  (n=${v.n})`);
  }
  lines.push('');
  const misses = s.perQuery.filter((q) => !q.hitAt5);
  if (misses.length > 0) {
    lines.push(`Misses (not in top 5, n=${misses.length}):`);
    for (const m of misses) {
      lines.push(`  ${m.queryId.padEnd(10)}  rank=${m.firstHitRank ?? '—'}`);
    }
  }
  return lines.join('\n');
}
