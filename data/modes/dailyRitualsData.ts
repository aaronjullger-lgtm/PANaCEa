/**
 * Daily Rituals Data
 * Medical Wordle, This Day in Medicine, Streak Freezes
 */

import type { MedicalWordleGame, HistoricalMedicalEvent } from '@/types';

// Medical Wordle word bank
export const MEDICAL_WORDLE_WORDS = {
  drugs: [
    { word: 'ASPIRIN', class: 'NSAID', generation: 'Classic', hint: 'Antiplatelet, COX inhibitor' },
    {
      word: 'WARFARIN',
      class: 'Anticoagulant',
      generation: 'Vitamin K antagonist',
      hint: 'Monitor INR',
    },
    { word: 'HEPARIN', class: 'Anticoagulant', generation: 'Injectable', hint: 'Monitor aPTT' },
    { word: 'INSULIN', class: 'Antidiabetic', generation: 'Hormone', hint: 'Lowers blood glucose' },
    {
      word: 'DIGOXIN',
      class: 'Cardiac Glycoside',
      generation: 'Classic',
      hint: 'Narrow therapeutic index',
    },
    {
      word: 'ATORVA',
      class: 'Statin',
      generation: 'HMG-CoA reductase inhibitor',
      hint: 'Lowers cholesterol',
    },
    {
      word: 'LOSART',
      class: 'ARB',
      generation: 'Angiotensin receptor blocker',
      hint: 'Treats hypertension',
    },
    {
      word: 'AMOXIC',
      class: 'Antibiotic',
      generation: 'Beta-lactam',
      hint: 'Penicillin derivative',
    },
    {
      word: 'CIPROF',
      class: 'Antibiotic',
      generation: 'Fluoroquinolone',
      hint: 'DNA gyrase inhibitor',
    },
    {
      word: 'CEFTRI',
      class: 'Antibiotic',
      generation: '3rd Gen Cephalosporin',
      hint: 'Broad spectrum',
    },
    { word: 'METFOR', class: 'Antidiabetic', generation: 'Biguanide', hint: 'First-line for T2DM' },
    {
      word: 'LISINOP',
      class: 'ACE Inhibitor',
      generation: 'First-line HTN',
      hint: 'Ends in -pril',
    },
    {
      word: 'AMLODIP',
      class: 'CCB',
      generation: 'Dihydropyridine',
      hint: 'Causes peripheral edema',
    },
    { word: 'PREDNISO', class: 'Steroid', generation: 'Glucocorticoid', hint: 'Anti-inflammatory' },
    {
      word: 'LEVOTHY',
      class: 'Thyroid Hormone',
      generation: 'T4 replacement',
      hint: 'For hypothyroidism',
    },
  ],
  conditions: [
    { word: 'ASTHMA', class: 'Pulmonary', system: 'PULM', hint: 'Reversible airway obstruction' },
    { word: 'DIABETES', class: 'Endocrine', system: 'ENDO', hint: 'Hyperglycemia disorder' },
    { word: 'STROKE', class: 'Neurologic', system: 'NEURO', hint: 'Cerebrovascular accident' },
    { word: 'PNEUMON', class: 'Infectious', system: 'ID', hint: 'Lung infection' },
    { word: 'SEPSIS', class: 'Critical Care', system: 'ID', hint: 'Systemic infection response' },
    { word: 'ANGINA', class: 'Cardiac', system: 'CV', hint: 'Chest pain from ischemia' },
    { word: 'CIRRHOSI', class: 'Hepatic', system: 'GI', hint: 'End-stage liver disease' },
    { word: 'NEPHRIT', class: 'Renal', system: 'RENAL', hint: 'Kidney inflammation' },
    { word: 'MELANOMA', class: 'Oncology', system: 'DERM', hint: 'Malignant skin cancer' },
    { word: 'ECZEMA', class: 'Dermatologic', system: 'DERM', hint: 'Atopic dermatitis' },
  ],
  anatomy: [
    { word: 'AORTA', class: 'Cardiovascular', system: 'CV', hint: 'Largest artery' },
    { word: 'FEMUR', class: 'Skeletal', system: 'MSK', hint: 'Longest bone' },
    { word: 'LIVER', class: 'Digestive', system: 'GI', hint: 'Largest solid organ' },
    { word: 'NEURON', class: 'Nervous', system: 'NEURO', hint: 'Nerve cell' },
    { word: 'ALVEOLI', class: 'Respiratory', system: 'PULM', hint: 'Gas exchange units' },
  ],
};

/**
 * Generate today's Medical Wordle game
 */
export function getTodaysMedicalWordle(): MedicalWordleGame {
  const today = new Date().toISOString().split('T')[0];

  // Use date as seed for consistent daily word
  const seed = new Date(today).getTime();
  const categories = ['drugs', 'conditions', 'anatomy'] as const;
  const categoryIndex = seed % categories.length;
  const category = categories[categoryIndex];

  const wordBank = MEDICAL_WORDLE_WORDS[category];
  const wordIndex = Math.floor(seed / categories.length) % wordBank.length;
  const selectedWord = wordBank[wordIndex];

  return {
    id: `wordle-${today}`,
    date: today,
    targetWord: selectedWord.word,
    category,
    hints: {
      class: selectedWord.class,
      system: 'system' in selectedWord ? selectedWord.system : undefined,
    },
  };
}

/**
 * This Day in Medicine historical events
 */
export const MEDICAL_HISTORY_EVENTS: HistoricalMedicalEvent[] = [
  {
    id: 'penicillin-discovery',
    date: '09-28',
    year: 1928,
    title: 'Alexander Fleming Discovers Penicillin',
    description:
      'Fleming noticed that a mold contaminating his bacterial cultures killed the bacteria. This serendipitous discovery revolutionized medicine and ushered in the antibiotic era.',
    relatedQuestions: [], // Would link to penicillin/antibiotic questions
  },
  {
    id: 'insulin-discovery',
    date: '01-11',
    year: 1922,
    title: 'First Successful Insulin Treatment',
    description:
      'Leonard Thompson, a 14-year-old diabetic, received the first injection of insulin. His condition improved dramatically, proving insulin as a life-saving treatment for diabetes.',
    relatedQuestions: [],
  },
  {
    id: 'smallpox-eradication',
    date: '05-08',
    year: 1980,
    title: 'WHO Declares Smallpox Eradicated',
    description:
      'The World Health Organization declared smallpox eradicated worldwide - the first and only human disease to be completely eliminated through vaccination.',
    relatedQuestions: [],
  },
  {
    id: 'dna-structure',
    date: '04-25',
    year: 1953,
    title: 'DNA Double Helix Structure Published',
    description:
      "Watson and Crick published their paper describing DNA's double helix structure in Nature, revolutionizing biology and medicine.",
    relatedQuestions: [],
  },
  {
    id: 'first-heart-transplant',
    date: '12-03',
    year: 1967,
    title: 'First Human Heart Transplant',
    description:
      'Dr. Christiaan Barnard performed the first successful human heart transplant in Cape Town, South Africa, opening new possibilities for organ transplantation.',
    relatedQuestions: [],
  },
  {
    id: 'polio-vaccine',
    date: '03-26',
    year: 1953,
    title: 'Salk Announces Polio Vaccine',
    description:
      'Jonas Salk announced the successful testing of his polio vaccine, leading to near-eradication of this devastating disease.',
    relatedQuestions: [],
  },
  {
    id: 'x-ray-discovery',
    date: '11-08',
    year: 1895,
    title: 'Wilhelm Röntgen Discovers X-rays',
    description:
      'Röntgen discovered X-rays accidentally while experimenting with cathode rays, revolutionizing diagnostic medicine.',
    relatedQuestions: [],
  },
  {
    id: 'ether-anesthesia',
    date: '10-16',
    year: 1846,
    title: 'First Public Demonstration of Ether Anesthesia',
    description:
      'William Morton demonstrated ether anesthesia at Massachusetts General Hospital, making painless surgery possible.',
    relatedQuestions: [],
  },
];

/**
 * Get "This Day in Medicine" event for today
 */
export function getTodayInMedicine(): HistoricalMedicalEvent | null {
  const today = new Date();
  const monthDay = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const event = MEDICAL_HISTORY_EVENTS.find((e) => e.date === monthDay);
  return event || null;
}

/**
 * Streak Freeze System
 * Virtual currency: earn coins from studying, spend on streak protection
 */
export const STREAK_FREEZE_CONFIG = {
  costPerFreeze: 50, // coins
  coinsPerQuestion: 1, // earned by answering questions
  coinsPerCorrectAnswer: 2, // bonus for correct answers
  dailyBonusCoins: 10, // bonus for maintaining streak
  maxFreezes: 5, // maximum freezes a user can hold
};

/**
 * Calculate coins earned from a study session
 */
export function calculateCoinsEarned(
  questionsAnswered: number,
  correctAnswers: number,
  hadActiveStreak: boolean
): number {
  let coins = questionsAnswered * STREAK_FREEZE_CONFIG.coinsPerQuestion;
  coins += correctAnswers * STREAK_FREEZE_CONFIG.coinsPerCorrectAnswer;

  if (hadActiveStreak) {
    coins += STREAK_FREEZE_CONFIG.dailyBonusCoins;
  }

  return coins;
}

/**
 * Check if user can purchase a streak freeze
 */
export function canPurchaseStreakFreeze(userCoins: number, currentFreezes: number): boolean {
  return (
    userCoins >= STREAK_FREEZE_CONFIG.costPerFreeze &&
    currentFreezes < STREAK_FREEZE_CONFIG.maxFreezes
  );
}
