/**
 * Golden Master Questions – Triple-Jump Template
 *
 * One exemplar per major category (Cardio, Pulm, GI) for content writers and AI generator.
 * Structure: Vignette → Diagnosis → Complication/next step → Answer (third-order).
 * Use these as the template for all PANCE-style question generation.
 *
 * @see docs/AUDIT_KAPLAN_QUESTION_MODEL.md
 * @see docs/IMMEDIATE_CONTENT_ACTION_PLAN.md
 */

export interface GoldenMasterRationale {
  bottomLine: string;
  whyCorrect: string;
  whyIncorrectA?: string;
  whyIncorrectB?: string;
  whyIncorrectC?: string;
  whyIncorrectD?: string;
  clinicalPearl: string;
  highYieldImageOrTable?: string;
}

export interface GoldenMasterQuestion {
  id: string;
  category: 'Cardio' | 'Pulm' | 'GI';
  vignette: string;
  question: string;
  options: [string, string, string, string];
  correctAnswerIndex: number;
  rationale: GoldenMasterRationale;
  pearls: string[];
  /** Triple-jump chain for template reference */
  tripleJump: {
    step1: string;
    step2: string;
    step3: string;
  };
}

export const GOLDEN_MASTER_QUESTIONS: GoldenMasterQuestion[] = [
  // ========== CARDIO ==========
  {
    id: 'golden-cardio-1',
    category: 'Cardio',
    vignette: `A 58-year-old man with hypertension (usually 160/90 on lisinopril) and type 2 diabetes presents to the ED with 2 hours of crushing substernal chest pain radiating to his left arm. He is diaphoretic and anxious. No tenderness to palpation over the sternum or costochondral junctions. No pain with deep inspiration. Vital signs: BP 110/70, HR 108, RR 22. ECG shows ST-segment elevation in leads V2–V4.`,
    question:
      'What is the mechanism of action of the first-line antiplatelet agent you would give this patient in addition to aspirin?',
    options: [
      'Irreversibly inhibits COX-1, reducing thromboxane A2',
      'Blocks P2Y12 ADP receptor on platelets, preventing activation',
      'Binds GP IIb/IIIa and prevents fibrinogen cross-linking',
      'Inhibits factor Xa and thrombin generation',
    ],
    correctAnswerIndex: 1,
    rationale: {
      bottomLine:
        'The diagnosis is acute STEMI (anterior), and the antiplatelet of choice in addition to aspirin is a P2Y12 inhibitor (e.g. clopidogrel); its mechanism is blocking the P2Y12 ADP receptor on platelets.',
      whyCorrect:
        'This patient has an acute anterior STEMI (crushing pain, diaphoresis, ST-elevation V2–V4). His BP 110/70 is relative hypotension given his usual hypertension—supporting acuity. Dual antiplatelet therapy (DAPT) with aspirin plus a P2Y12 inhibitor is standard. Option B describes the mechanism of P2Y12 inhibitors (clopidogrel, ticagrelor, prasugrel): they block the P2Y12 ADP receptor on platelets, preventing platelet activation and aggregation.',
      whyIncorrectA:
        'Aspirin irreversibly inhibits COX-1 and reduces thromboxane A2; the question asks for the agent given in addition to aspirin, so this is aspirin’s mechanism, not the add-on.',
      whyIncorrectC:
        'GP IIb/IIIa inhibitors (e.g. abciximab) are used in specific PCI settings, not as the routine first-line oral add-on to aspirin in STEMI.',
      whyIncorrectD:
        'Factor Xa inhibitors are anticoagulants (e.g. rivaroxaban), not the standard first-line antiplatelet add-on for STEMI.',
      clinicalPearl:
        'In STEMI, DAPT = aspirin + P2Y12 inhibitor. P2Y12 inhibitors (clopidogrel, ticagrelor, prasugrel) work by blocking the P2Y12 ADP receptor on platelets.',
      highYieldImageOrTable: 'N/A',
    },
    pearls: [
      'STEMI: DAPT = aspirin + P2Y12 inhibitor; mechanism of P2Y12 drugs = block ADP receptor.',
      'Relative hypotension: BP 110/70 in a usually hypertensive patient signals acuity.',
      'Pertinent negatives (no tenderness, no pleuritic pain) help rule out costochondritis and pleuritis.',
    ],
    tripleJump: {
      step1:
        'Vignette → STEMI (anterior): crushing pain, ST-elevation V2–V4, relative hypotension.',
      step2: 'First-line add-on to aspirin = P2Y12 inhibitor (e.g. clopidogrel).',
      step3: 'Answer = mechanism of P2Y12 inhibitor: blocks P2Y12 ADP receptor on platelets.',
    },
  },

  // ========== PULM ==========
  {
    id: 'golden-pulm-1',
    category: 'Pulm',
    vignette: `A 72-year-old woman with COPD on home oxygen presents with 5 days of increased dyspnea, productive cough, and fever. No chest pain with breathing. No leg swelling or recent travel. Vital signs: T 38.5°C, HR 98, BP 128/78, RR 24, SpO2 88% on 2 L NC. Chest exam: diffuse wheezes, right lower lobe crackles. CXR shows a new right lower lobe consolidation with air bronchograms.`,
    question:
      'What is the most likely mechanism of resistance you must consider when choosing empiric therapy for this patient’s infection?',
    options: [
      'Beta-lactamase production that hydrolyzes penicillins and cephalosporins',
      'Altered penicillin-binding proteins (PRSP)',
      'Fluoroquinolone efflux pumps and topoisomerase mutations',
      'Vancomycin resistance (VRSA)',
    ],
    correctAnswerIndex: 0,
    rationale: {
      bottomLine:
        'The diagnosis is COPD exacerbation with community-acquired pneumonia (CAP); empiric therapy must cover beta-lactamase-producing organisms (e.g. H. influenzae), so the mechanism of resistance to consider is beta-lactamase production.',
      whyCorrect:
        'The vignette describes CAP in a COPD patient (new consolidation, fever, crackles, air bronchograms). In COPD, common pathogens include H. influenzae and M. catarrhalis, which often produce beta-lactamase and confer resistance to penicillins and some cephalosporins. Empiric choice (e.g. respiratory fluoroquinolone or beta-lactam/beta-lactamase inhibitor) accounts for this mechanism. Option A correctly identifies beta-lactamase production as the key resistance mechanism to consider.',
      whyIncorrectB:
        'Altered PBPs (e.g. PRSP) are relevant for S. pneumoniae resistance to penicillins, not the primary “must consider” mechanism in a COPD-focused empiric choice where beta-lactamase is central.',
      whyIncorrectC:
        'Fluoroquinolone resistance is a consideration in some regions but the question is framed around empiric therapy choice where beta-lactamase is the classic mechanism to cover in COPD.',
      whyIncorrectD:
        'VRSA is rare and not the routine resistance mechanism to consider for CAP/COPD empiric therapy.',
      clinicalPearl:
        'In COPD exacerbation with CAP, cover beta-lactamase producers (H. influenzae, M. catarrhalis); use respiratory FQ or beta-lactam/BLI.',
      highYieldImageOrTable: 'N/A',
    },
    pearls: [
      'COPD + CAP: empiric coverage for beta-lactamase-producing H. influenzae and M. catarrhalis.',
      'Air bronchograms on CXR suggest parenchymal consolidation (e.g. bacterial pneumonia).',
      'Pertinent negatives (no pleuritic pain, no DVT/travel) help narrow differential.',
    ],
    tripleJump: {
      step1:
        'Vignette → COPD exacerbation + CAP (consolidation, fever, crackles, air bronchograms).',
      step2: 'Empiric therapy must cover beta-lactamase-producing pathogens in COPD.',
      step3:
        'Answer = resistance mechanism: beta-lactamase production hydrolyzing penicillins/cephalosporins.',
    },
  },

  // ========== GI ==========
  {
    id: 'golden-gi-1',
    category: 'GI',
    vignette: `A 45-year-old woman presents with 2 days of severe, constant epigastric pain radiating to the back. She has a history of gallstones. No relief with food or positioning. No jaundice or fever. Vital signs: T 37.2°C, HR 92, BP 118/76. Abdomen: epigastric tenderness, no guarding or rebound. Lipase is 1,200 U/L. Ultrasound shows cholelithiasis and a normal common bile duct.`,
    question:
      'What is the mechanism by which the first-line analgesic you would use for this condition provides pain relief?',
    options: [
      'Inhibition of cyclooxygenase (COX), reducing prostaglandin-mediated pain and inflammation',
      'Agonism at mu-opioid receptors in the CNS',
      'Antagonism at NMDA receptors, reducing central sensitization',
      'Stimulation of descending inhibitory pathways via serotonin/norepinephrine reuptake inhibition',
    ],
    correctAnswerIndex: 0,
    rationale: {
      bottomLine:
        'The diagnosis is acute pancreatitis (elevated lipase, epigastric pain radiating to back, gallstones); first-line analgesic is a non-opioid (e.g. NSAID), and its mechanism is inhibition of cyclooxygenase (COX), reducing prostaglandin-mediated pain and inflammation.',
      whyCorrect:
        'The vignette supports acute pancreatitis (elevated lipase, epigastric pain radiating to back, gallstones, no jaundice/fever suggesting uncomplicated biliary pancreatitis). Guidelines recommend non-opioids (e.g. NSAIDs) as first-line for pain. NSAIDs work by inhibiting COX and reducing prostaglandin synthesis, which mediates pain and inflammation. Option A correctly describes this mechanism.',
      whyIncorrectB:
        'Opioids act at mu-opioid receptors but are second-line; the question asks for first-line analgesic mechanism.',
      whyIncorrectC:
        'NMDA antagonism (e.g. ketamine) is not the first-line analgesic for pancreatitis.',
      whyIncorrectD:
        'SNRIs are used for chronic pain/neuropathy, not as the first-line analgesic in acute pancreatitis.',
      clinicalPearl:
        'Acute pancreatitis: first-line analgesic = NSAIDs (COX inhibition); use opioids as add-on if needed.',
      highYieldImageOrTable: 'N/A',
    },
    pearls: [
      'Acute pancreatitis: lipase >3× ULN + epigastric pain radiating to back; first-line pain = NSAID (COX inhibition).',
      'Gallstones + normal CBD on US suggest biliary pancreatitis without choledocholithiasis.',
      'Pertinent negatives (no jaundice, no fever) help assess severity and complications.',
    ],
    tripleJump: {
      step1: 'Vignette → Acute pancreatitis (lipase elevated, pain, gallstones, normal CBD).',
      step2: 'First-line analgesic = NSAID (non-opioid).',
      step3:
        'Answer = mechanism of NSAID: inhibition of COX, reducing prostaglandin-mediated pain and inflammation.',
    },
  },
];
