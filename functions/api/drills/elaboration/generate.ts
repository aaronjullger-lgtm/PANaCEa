/**
 * Elaboration Drill — Fact Generation Endpoint
 * POST /api/drills/elaboration/generate
 *
 * Generates a clinical fact + hidden mechanism for elaborative interrogation.
 * Student must explain WHY the fact is true before seeing the mechanism.
 *
 * Research: Pressley et al. (1987), Dunlosky et al. (2013) — elaborative
 * interrogation produces 2-3x better retention than passive review.
 */

import { authenticatedEndpoint } from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { z } from 'zod';

const generateSchema = z.object({
  system: z.string().optional(),
});

/** Pre-built high-yield facts for offline/fast generation */
const CLINICAL_FACTS = [
  { fact: 'Furosemide causes hypokalemia', mechanism: 'Furosemide inhibits the Na-K-2Cl cotransporter in the thick ascending limb of the loop of Henle, preventing sodium and potassium reabsorption. Increased sodium delivery to the distal tubule enhances K+ secretion via the ROMK channel and Na/K exchange.', system: 'Nephrology', rubric: ['Loop of Henle target', 'Na-K-2Cl cotransporter', 'Distal K+ secretion'] },
  { fact: 'ACE inhibitors cause a dry cough', mechanism: 'ACE inhibitors block the degradation of bradykinin (ACE normally breaks down bradykinin). Accumulated bradykinin stimulates sensory C-fibers in the lungs, triggering the cough reflex. This is why ARBs (which don\'t affect bradykinin) are used as alternatives.', system: 'Cardiovascular', rubric: ['Bradykinin accumulation', 'ACE degrades bradykinin', 'C-fiber stimulation'] },
  { fact: 'Type 1 diabetes presents with polyuria, polydipsia, and weight loss', mechanism: 'Autoimmune destruction of pancreatic beta cells causes absolute insulin deficiency. Without insulin, glucose cannot enter cells, leading to hyperglycemia. Osmotic diuresis from glucosuria causes polyuria and dehydration (polydipsia). Cells switch to lipolysis for energy, causing weight loss and ketogenesis.', system: 'Endocrine', rubric: ['Beta cell destruction', 'Osmotic diuresis/glucosuria', 'Lipolysis/ketogenesis'] },
  { fact: 'Cirrhosis causes esophageal varices', mechanism: 'Hepatic fibrosis increases resistance to portal blood flow, causing portal hypertension (portal pressure >10mmHg). Blood seeks alternative routes through portosystemic anastomoses, including the left gastric → esophageal veins, causing varices. Rupture risk increases when HVPG >12mmHg.', system: 'Gastrointestinal', rubric: ['Portal hypertension', 'Portosystemic anastomoses', 'Left gastric vein pathway'] },
  { fact: 'Untreated strep pharyngitis can cause rheumatic fever', mechanism: 'Group A Streptococcus (GAS) M protein shares molecular homology with cardiac myosin (molecular mimicry). The immune response against GAS cross-reacts with heart tissue, causing pancarditis. Jones criteria: major (carditis, polyarthritis, chorea, erythema marginatum, subcutaneous nodules) + evidence of prior GAS infection.', system: 'Infectious Disease', rubric: ['Molecular mimicry', 'M protein/cardiac myosin', 'Jones criteria'] },
  { fact: 'Tension pneumothorax causes tracheal deviation away from the affected side', mechanism: 'Air enters the pleural space through a one-way valve mechanism during inspiration but cannot escape during expiration. Progressive air accumulation increases intrapleural pressure, collapsing the ipsilateral lung and pushing the mediastinum (including the trachea) toward the contralateral side. This compresses the contralateral lung and great vessels, reducing venous return and causing obstructive shock.', system: 'Pulmonary', rubric: ['One-way valve mechanism', 'Increased intrapleural pressure', 'Mediastinal shift'] },
  { fact: 'Osteoarthritis preferentially affects the DIP joints, while rheumatoid arthritis affects the MCP and PIP joints', mechanism: 'OA is a degenerative disease driven by mechanical wear on weight-bearing and high-use joints (DIPs bear significant grip force). RA is a systemic autoimmune disease where synovial inflammation (pannus) preferentially targets the synovium-rich MCP and PIP joints. The DIP joints have less synovium and are relatively spared in RA. Heberden nodes (DIP) vs Bouchard nodes (PIP) help distinguish OA.', system: 'Musculoskeletal', rubric: ['Mechanical wear vs synovial inflammation', 'Synovium distribution', 'Heberden vs Bouchard nodes'] },
  { fact: 'Beta-blockers are contraindicated in cocaine-induced chest pain', mechanism: 'Cocaine blocks norepinephrine reuptake, causing excess sympathetic stimulation of both alpha and beta receptors. Beta-blockers remove beta-2-mediated vasodilation, leaving alpha-1-mediated vasoconstriction unopposed. This paradoxically worsens coronary vasospasm and hypertension. Benzodiazepines (reduce sympathetic drive) and nitroglycerin are preferred.', system: 'Emergency Medicine', rubric: ['Unopposed alpha stimulation', 'NE reuptake blockade', 'Coronary vasospasm worsening'] },
  { fact: 'Warfarin is teratogenic but heparin is not', mechanism: 'Warfarin is a small lipophilic molecule that crosses the placenta, inhibiting vitamin K-dependent carboxylation in the fetus. This causes nasal hypoplasia, stippled epiphyses (chondrodysplasia punctata), and CNS abnormalities. Heparin is a large, negatively charged polysaccharide that cannot cross the placental barrier due to its size and charge, making it safe in pregnancy.', system: 'Reproductive', rubric: ['Placental crossing (size/lipophilicity)', 'Vitamin K inhibition in fetus', 'Heparin size/charge barrier'] },
  { fact: 'Benign Paroxysmal Positional Vertigo (BPPV) is triggered by head position changes', mechanism: 'Otoconia (calcium carbonate crystals) become dislodged from the utricle and migrate into the semicircular canals (usually posterior). Head position changes cause the free-floating otoconia to move within the canal, creating endolymph flow that deflects the cupula, generating a false sense of rotation. The Dix-Hallpike test provokes this by positioning the posterior canal vertically. The Epley maneuver repositions the otoconia back to the utricle.', system: 'HEENT', rubric: ['Otoconia displacement', 'Semicircular canal involvement', 'Cupula deflection/false rotation signal'] },
  { fact: 'SSRIs take 4-6 weeks to reach full therapeutic effect for depression', mechanism: 'SSRIs immediately block serotonin reuptake, but the therapeutic delay is due to 5-HT1A autoreceptor desensitization. Initially, increased serotonin activates presynaptic 5-HT1A autoreceptors, which reduce serotonin firing (negative feedback). Over weeks, these autoreceptors downregulate, allowing sustained serotonin neurotransmission. Downstream neuroplasticity changes (BDNF upregulation, hippocampal neurogenesis) also require time.', system: 'Psychiatry', rubric: ['5-HT1A autoreceptor desensitization', 'Negative feedback initially', 'BDNF/neuroplasticity changes'] },
  { fact: 'Psoriasis is characterized by well-demarcated erythematous plaques with silvery scales', mechanism: 'Psoriasis is a T-cell-mediated autoimmune disease where IL-17 and IL-23 drive hyperproliferation of keratinocytes (cell cycle reduced from 28 days to 3-4 days). The rapid turnover prevents normal maturation, producing parakeratotic scale (retained nuclei). The Auspitz sign (pinpoint bleeding when scale is removed) occurs because elongated rete ridges bring dermal capillaries close to the surface.', system: 'Dermatology', rubric: ['T-cell/IL-17/IL-23 pathway', 'Keratinocyte hyperproliferation', 'Auspitz sign mechanism'] },
];

export const onRequestPost = authenticatedEndpoint(generateSchema, async (context) => {
  const system = context.validated?.system;

  // Filter facts by system if specified
  const pool = system
    ? CLINICAL_FACTS.filter((f) => f.system.toLowerCase() === system.toLowerCase())
    : CLINICAL_FACTS;

  if (pool.length === 0) {
    return {
      status: 200,
      data: { fact: null, message: 'No facts available for this system' },
    };
  }

  // Pick random fact
  const entry = pool[Math.floor(Math.random() * pool.length)];
  if (!entry) {
    return {
      status: 500,
      error: 'Failed to select elaboration drill fact',
    };
  }

  return {
    status: 200,
    data: {
      id: `elab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fact: entry.fact,
      system: entry.system,
      gradingRubric: entry.rubric,
      // Hidden mechanism — only revealed after grading
      _mechanism: entry.mechanism,
    },
  };
});
