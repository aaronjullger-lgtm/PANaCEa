/**
 * Triage Tent (Mass Casualty Event) Data
 * START triage protocol implementation
 */

import type { TriageVictim, TriageCategory, TriageSession } from '@/types/drill-modes';

/**
 * Mass Casualty Scenarios
 */
export const TRIAGE_SCENARIOS = [
  {
    id: 'bus-crash',
    name: 'Bus Crash on Highway',
    description: 'School bus collided with semi-truck. 20 victims on scene.',
    setting: 'rural_highway',
  },
  {
    id: 'building-collapse',
    name: 'Building Collapse',
    description: 'Apartment building partial collapse. Multiple trapped victims.',
    setting: 'urban',
  },
  {
    id: 'train-derailment',
    name: 'Train Derailment',
    description: 'Passenger train derailed. Mass casualties across multiple cars.',
    setting: 'suburban',
  },
  {
    id: 'explosion',
    name: 'Industrial Explosion',
    description: 'Chemical plant explosion with blast injuries and potential toxic exposure.',
    setting: 'industrial',
  },
];

/**
 * Sample victims for triage training
 */
export const TRIAGE_VICTIMS: TriageVictim[] = [
  // IMMEDIATE (Red) - Life-threatening but salvageable
  {
    id: 'victim-001',
    age: 28,
    sex: 'M',
    presentation: 'Uncontrolled bleeding from femoral artery, pale, diaphoretic',
    vitalSigns: {
      conscious: true,
      breathing: true,
      respiratoryRate: 28,
      pulse: 130,
      canFollowCommands: true,
    },
    injuries: ['Femoral artery laceration', 'Multiple contusions'],
    correctCategory: 'immediate',
    explanation: 'RR >30 initially (now 28 after initial intervention) and tachycardic with active hemorrhage. Needs immediate intervention to survive.',
  },
  {
    id: 'victim-002',
    age: 45,
    sex: 'F',
    presentation: 'Obvious tension pneumothorax, severe dyspnea, tracheal deviation',
    vitalSigns: {
      conscious: true,
      breathing: true,
      respiratoryRate: 35,
      pulse: 125,
      canFollowCommands: false,
    },
    injuries: ['Tension pneumothorax', 'Rib fractures'],
    correctCategory: 'immediate',
    explanation: 'RR >30, altered mental status, life-threatening tension pneumothorax requiring immediate needle decompression.',
  },
  {
    id: 'victim-003',
    age: 32,
    sex: 'M',
    presentation: 'Open skull fracture, brain matter visible, unconscious but breathing',
    vitalSigns: {
      conscious: false,
      breathing: true,
      respiratoryRate: 8,
      pulse: 50,
      canFollowCommands: false,
    },
    injuries: ['Severe traumatic brain injury', 'Open skull fracture'],
    correctCategory: 'immediate',
    explanation: 'RR <10, severe head injury but salvageable with immediate neurosurgical intervention.',
  },
  
  // DELAYED (Yellow) - Serious but stable
  {
    id: 'victim-004',
    age: 38,
    sex: 'F',
    presentation: 'Closed femur fracture, in pain but stable vitals',
    vitalSigns: {
      conscious: true,
      breathing: true,
      respiratoryRate: 20,
      pulse: 95,
      canFollowCommands: true,
    },
    injuries: ['Closed femur fracture', 'Minor lacerations'],
    correctCategory: 'delayed',
    explanation: 'Stable vital signs, conscious and alert. Significant injury but can wait for treatment after immediate cases.',
  },
  {
    id: 'victim-005',
    age: 55,
    sex: 'M',
    presentation: 'Multiple rib fractures, moderate pain with breathing',
    vitalSigns: {
      conscious: true,
      breathing: true,
      respiratoryRate: 22,
      pulse: 88,
      canFollowCommands: true,
    },
    injuries: ['Multiple rib fractures', 'Moderate pneumothorax'],
    correctCategory: 'delayed',
    explanation: 'Breathing adequately despite rib fractures. RR <30, stable hemodynamics. Delayed category appropriate.',
  },
  {
    id: 'victim-006',
    age: 42,
    sex: 'F',
    presentation: 'Deep laceration to forearm, controlled bleeding, alert',
    vitalSigns: {
      conscious: true,
      breathing: true,
      respiratoryRate: 18,
      pulse: 92,
      canFollowCommands: true,
    },
    injuries: ['Deep forearm laceration (controlled)', 'Minor abrasions'],
    correctCategory: 'delayed',
    explanation: 'Bleeding controlled, stable vitals, can wait for definitive care. Not life-threatening.',
  },
  
  // MINOR (Green) - Walking wounded
  {
    id: 'victim-007',
    age: 25,
    sex: 'M',
    presentation: 'Walking, minor cuts and bruises, anxious but stable',
    vitalSigns: {
      conscious: true,
      breathing: true,
      respiratoryRate: 16,
      pulse: 85,
      canFollowCommands: true,
    },
    injuries: ['Minor lacerations', 'Contusions', 'Anxiety'],
    correctCategory: 'minor',
    explanation: 'Walking wounded. Can be directed to self-treatment area. No immediate care needed.',
  },
  {
    id: 'victim-008',
    age: 19,
    sex: 'F',
    presentation: 'Walking, complained of neck pain, full range of motion',
    vitalSigns: {
      conscious: true,
      breathing: true,
      respiratoryRate: 14,
      pulse: 78,
      canFollowCommands: true,
    },
    injuries: ['Cervical strain', 'Minor contusions'],
    correctCategory: 'minor',
    explanation: 'Ambulatory, stable. Cervical strain is not immediately life-threatening. Minor category.',
  },
  
  // EXPECTANT (Black) - Unsurvivable or minimal chance
  {
    id: 'victim-009',
    age: 67,
    sex: 'M',
    presentation: 'Apneic, pulseless, massive head trauma, not breathing after airway opened',
    vitalSigns: {
      conscious: false,
      breathing: false,
      canFollowCommands: false,
    },
    injuries: ['Massive head trauma', 'Cardiac arrest'],
    correctCategory: 'expectant',
    explanation: 'Not breathing even after airway positioning. In mass casualty, CPR not initiated - resources to salvageable victims.',
  },
  {
    id: 'victim-010',
    age: 52,
    sex: 'F',
    presentation: 'Full-thickness burns over 80% BSA, unconscious, labored breathing',
    vitalSigns: {
      conscious: false,
      breathing: true,
      respiratoryRate: 6,
      pulse: 40,
      canFollowCommands: false,
    },
    injuries: ['80% TBSA burns', 'Inhalation injury', 'Shock'],
    correctCategory: 'expectant',
    explanation: 'Unsurvivable injuries (80% burns). In mass casualty, expectant category to prioritize salvageable victims.',
  },
  
  // Additional victims with teaching scenarios
  {
    id: 'victim-011',
    age: 8,
    sex: 'M',
    presentation: 'Child crying, obvious tibial fracture, vitals stable',
    vitalSigns: {
      conscious: true,
      breathing: true,
      respiratoryRate: 24,
      pulse: 110,
      canFollowCommands: true,
    },
    injuries: ['Closed tibial fracture'],
    correctCategory: 'delayed',
    explanation: 'Pediatric patient - HR/RR slightly elevated but normal for age and pain. Stable, can be delayed.',
  },
  {
    id: 'victim-012',
    age: 28,
    sex: 'F',
    presentation: 'Pregnant (30 weeks), abdominal pain, contractions, stable BP',
    vitalSigns: {
      conscious: true,
      breathing: true,
      respiratoryRate: 20,
      pulse: 95,
      canFollowCommands: true,
    },
    injuries: ['Possible placental abruption', 'Minor contusions'],
    correctCategory: 'immediate',
    explanation: 'Pregnant patient with potential placental abruption - two lives at risk. Immediate category.',
  },
  {
    id: 'victim-013',
    age: 35,
    sex: 'M',
    presentation: 'Agitated, combative, strong odor of alcohol, minor injuries visible',
    vitalSigns: {
      conscious: true,
      breathing: true,
      respiratoryRate: 16,
      pulse: 88,
      canFollowCommands: false,
    },
    injuries: ['Minor lacerations', 'Possible concussion', 'Intoxication'],
    correctCategory: 'delayed',
    explanation: 'Altered mental status could be from concussion or intoxication. Stable vitals. Delayed for further eval.',
  },
  {
    id: 'victim-014',
    age: 16,
    sex: 'F',
    presentation: 'Unconscious, but breathing spontaneously, RR 18, radial pulse present',
    vitalSigns: {
      conscious: false,
      breathing: true,
      respiratoryRate: 18,
      pulse: 90,
      canFollowCommands: false,
    },
    injuries: ['Closed head injury', 'Possible C-spine injury'],
    correctCategory: 'immediate',
    explanation: 'Unconscious but breathing with good RR. Cannot follow commands = immediate category per START.',
  },
];

/**
 * Generate a triage session with random victims
 */
export function generateTriageSession(scenarioId: string, victimCount: number = 10): Omit<TriageSession, 'decisions' | 'endTime' | 'score'> {
  // Shuffle and select random victims
  const shuffled = [...TRIAGE_VICTIMS].sort(() => Math.random() - 0.5);
  const selectedVictims = shuffled.slice(0, Math.min(victimCount, shuffled.length));
  
  return {
    scenarioId,
    victims: selectedVictims,
    startTime: Date.now(),
  };
}

/**
 * Calculate triage score
 */
export function calculateTriageScore(session: TriageSession): TriageSession['score'] {
  const totalVictims = session.victims.length;
  const decisions = session.decisions;
  
  if (decisions.length === 0) {
    return { accuracy: 0, speed: 0, overall: 0 };
  }
  
  // Accuracy: percentage correct
  const correctCount = decisions.filter(d => d.correct).length;
  const accuracy = (correctCount / decisions.length) * 100;
  
  // Speed: average time per decision (target: 30 seconds per victim)
  const avgTimeMs = decisions.reduce((sum, d) => sum + d.timeSpent, 0) / decisions.length;
  const avgTimeSec = avgTimeMs / 1000;
  const targetTime = 30; // seconds
  const speed = Math.max(0, Math.min(100, (targetTime / avgTimeSec) * 100));
  
  // Overall: weighted combination
  const overall = (accuracy * 0.7) + (speed * 0.3);
  
  return {
    accuracy: Math.round(accuracy),
    speed: Math.round(speed),
    overall: Math.round(overall),
  };
}

/**
 * Get feedback for a triage decision
 */
export function getTriageFeedback(victim: TriageVictim, assignedCategory: TriageCategory): string {
  if (assignedCategory === victim.correctCategory) {
    return `✓ Correct! ${victim.explanation}`;
  }
  
  return `✗ Incorrect. Should be ${victim.correctCategory.toUpperCase()}. ${victim.explanation}`;
}

/**
 * START Triage Algorithm Summary
 */
export const START_TRIAGE_ALGORITHM = {
  step1: {
    label: 'Can walk?',
    yes: 'MINOR (Green)',
    no: 'Continue to Step 2',
  },
  step2: {
    label: 'Breathing?',
    no: 'Open airway. Still not breathing? → EXPECTANT (Black)',
    yes: 'Continue to Step 3',
  },
  step3: {
    label: 'Respiratory Rate',
    over30: 'IMMEDIATE (Red)',
    under10: 'IMMEDIATE (Red)',
    between: 'Continue to Step 4',
  },
  step4: {
    label: 'Perfusion (Radial pulse or Capillary refill)',
    absent: 'IMMEDIATE (Red)',
    present: 'Continue to Step 5',
  },
  step5: {
    label: 'Mental Status',
    cannotFollowCommands: 'IMMEDIATE (Red)',
    canFollowCommands: 'DELAYED (Yellow)',
  },
};
