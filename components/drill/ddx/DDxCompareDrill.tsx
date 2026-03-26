import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  RotateCcw,
  Trophy,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  GitCompare,
  Target,
  Brain,
  ArrowRight,
  Sparkles,
  Zap,
} from 'lucide-react';
import { QuestionSkeleton } from '@/components/loading';

// ============================================================================
// Types
// ============================================================================

interface SymptomCard {
  id: string;
  symptom: string;
  correctAnswer: 'A' | 'B';
  explanation: string;
}

interface DDxPair {
  id: string;
  conditionA: string;
  conditionB: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  cards: SymptomCard[];
}

// ============================================================================
// DDx Pair Data
// ============================================================================

const DDX_PAIRS: DDxPair[] = [
  {
    id: 'crohns-uc',
    conditionA: "Crohn's Disease",
    conditionB: 'Ulcerative Colitis',
    category: 'GI',
    difficulty: 'intermediate',
    cards: [
      {
        id: '1',
        symptom: 'Transmural inflammation',
        correctAnswer: 'A',
        explanation:
          "Transmural inflammation (full thickness) is characteristic of Crohn's. UC only affects the mucosa.",
      },
      {
        id: '2',
        symptom: 'Mucosal inflammation only',
        correctAnswer: 'B',
        explanation: "UC is limited to the mucosa and submucosa. Crohn's affects all layers.",
      },
      {
        id: '3',
        symptom: 'Skip lesions',
        correctAnswer: 'A',
        explanation:
          "Skip lesions (patchy involvement with normal bowel in between) are typical of Crohn's disease.",
      },
      {
        id: '4',
        symptom: 'Continuous inflammation from rectum',
        correctAnswer: 'B',
        explanation:
          'UC always involves the rectum and spreads proximally in a continuous pattern.',
      },
      {
        id: '5',
        symptom: 'Cobblestone appearance',
        correctAnswer: 'A',
        explanation: "The cobblestone mucosa pattern is classic for Crohn's disease.",
      },
      {
        id: '6',
        symptom: 'Pseudopolyps',
        correctAnswer: 'B',
        explanation: 'Pseudopolyps (inflammatory polyps) are more characteristic of UC.',
      },
      {
        id: '7',
        symptom: 'Perianal fistulas and abscesses',
        correctAnswer: 'A',
        explanation:
          "Perianal complications like fistulas and abscesses are common in Crohn's, rare in UC.",
      },
      {
        id: '8',
        symptom: 'Toxic megacolon risk',
        correctAnswer: 'B',
        explanation: 'Toxic megacolon is a serious complication more associated with UC.',
      },
      {
        id: '9',
        symptom: 'Non-caseating granulomas on biopsy',
        correctAnswer: 'A',
        explanation: "Non-caseating granulomas are pathognomonic for Crohn's disease.",
      },
      {
        id: '10',
        symptom: 'Crypt abscesses',
        correctAnswer: 'B',
        explanation: 'Crypt abscesses are more commonly seen in UC, though not specific.',
      },
      {
        id: '11',
        symptom: 'Terminal ileum involvement',
        correctAnswer: 'A',
        explanation:
          "Terminal ileitis is very common in Crohn's disease. UC does not typically affect the ileum.",
      },
      {
        id: '12',
        symptom: 'Bloody diarrhea as hallmark',
        correctAnswer: 'B',
        explanation:
          "Bloody diarrhea is the hallmark of UC. Crohn's may have diarrhea but less commonly bloody.",
      },
      {
        id: '13',
        symptom: 'String sign on imaging',
        correctAnswer: 'A',
        explanation: 'The "string sign" (narrow terminal ileum) is seen in Crohn\'s disease.',
      },
      {
        id: '14',
        symptom: 'Lead pipe colon on imaging',
        correctAnswer: 'B',
        explanation:
          'The "lead pipe" appearance (loss of haustra) is characteristic of chronic UC.',
      },
    ],
  },
  {
    id: 'type1-type2-dm',
    conditionA: 'Type 1 Diabetes',
    conditionB: 'Type 2 Diabetes',
    category: 'Endocrine',
    difficulty: 'beginner',
    cards: [
      {
        id: '1',
        symptom: 'Autoimmune destruction of beta cells',
        correctAnswer: 'A',
        explanation: 'Type 1 DM is caused by autoimmune destruction of pancreatic beta cells.',
      },
      {
        id: '2',
        symptom: 'Insulin resistance',
        correctAnswer: 'B',
        explanation:
          'Type 2 DM is primarily characterized by insulin resistance and relative insulin deficiency.',
      },
      {
        id: '3',
        symptom: 'Typically presents in childhood',
        correctAnswer: 'A',
        explanation:
          'Type 1 DM typically presents in childhood or adolescence, though can occur at any age.',
      },
      {
        id: '4',
        symptom: 'Associated with obesity',
        correctAnswer: 'B',
        explanation: 'Type 2 DM is strongly associated with obesity and metabolic syndrome.',
      },
      {
        id: '5',
        symptom: 'Positive GAD65 antibodies',
        correctAnswer: 'A',
        explanation: 'GAD65 and other islet cell antibodies are markers of autoimmune Type 1 DM.',
      },
      {
        id: '6',
        symptom: 'Family history often present',
        correctAnswer: 'B',
        explanation: 'Type 2 DM has a strong genetic component with frequent family history.',
      },
      {
        id: '7',
        symptom: 'Requires insulin from diagnosis',
        correctAnswer: 'A',
        explanation: 'Type 1 DM requires exogenous insulin from the time of diagnosis.',
      },
      {
        id: '8',
        symptom: 'May be managed with oral agents initially',
        correctAnswer: 'B',
        explanation:
          'Type 2 DM can often be managed with lifestyle changes and oral medications initially.',
      },
      {
        id: '9',
        symptom: 'DKA as initial presentation',
        correctAnswer: 'A',
        explanation: 'Diabetic ketoacidosis (DKA) is often the initial presentation of Type 1 DM.',
      },
      {
        id: '10',
        symptom: 'Acanthosis nigricans',
        correctAnswer: 'B',
        explanation: 'Acanthosis nigricans is associated with insulin resistance in Type 2 DM.',
      },
    ],
  },
  {
    id: 'hyperthyroid-hypothyroid',
    conditionA: 'Hyperthyroidism',
    conditionB: 'Hypothyroidism',
    category: 'Endocrine',
    difficulty: 'beginner',
    cards: [
      {
        id: '1',
        symptom: 'Heat intolerance',
        correctAnswer: 'A',
        explanation: 'Heat intolerance occurs due to increased metabolic rate in hyperthyroidism.',
      },
      {
        id: '2',
        symptom: 'Cold intolerance',
        correctAnswer: 'B',
        explanation: 'Cold intolerance occurs due to decreased metabolic rate in hypothyroidism.',
      },
      {
        id: '3',
        symptom: 'Weight loss despite increased appetite',
        correctAnswer: 'A',
        explanation:
          'Hyperthyroidism causes increased metabolism leading to weight loss despite eating more.',
      },
      {
        id: '4',
        symptom: 'Weight gain and fatigue',
        correctAnswer: 'B',
        explanation: 'Hypothyroidism slows metabolism causing weight gain, fatigue, and lethargy.',
      },
      {
        id: '5',
        symptom: 'Tachycardia and palpitations',
        correctAnswer: 'A',
        explanation:
          'Excess thyroid hormone causes tachycardia, palpitations, and atrial fibrillation risk.',
      },
      {
        id: '6',
        symptom: 'Bradycardia',
        correctAnswer: 'B',
        explanation: 'Low thyroid hormone causes bradycardia and decreased cardiac output.',
      },
      {
        id: '7',
        symptom: 'Tremor and anxiety',
        correctAnswer: 'A',
        explanation: 'Fine tremor and anxiety/nervousness are common in hyperthyroidism.',
      },
      {
        id: '8',
        symptom: 'Depression and mental slowing',
        correctAnswer: 'B',
        explanation:
          'Hypothyroidism commonly causes depression, cognitive slowing, and poor concentration.',
      },
      {
        id: '9',
        symptom: 'Exophthalmos (Graves disease)',
        correctAnswer: 'A',
        explanation:
          'Exophthalmos is specific to Graves disease, the most common cause of hyperthyroidism.',
      },
      {
        id: '10',
        symptom: 'Myxedema',
        correctAnswer: 'B',
        explanation: 'Myxedema (non-pitting edema) is seen in severe hypothyroidism.',
      },
      {
        id: '11',
        symptom: 'Low TSH, high T4',
        correctAnswer: 'A',
        explanation: 'Primary hyperthyroidism shows suppressed TSH with elevated T4/T3.',
      },
      {
        id: '12',
        symptom: 'High TSH, low T4',
        correctAnswer: 'B',
        explanation: 'Primary hypothyroidism shows elevated TSH with low T4.',
      },
    ],
  },
  {
    id: 'ra-oa',
    conditionA: 'Rheumatoid Arthritis',
    conditionB: 'Osteoarthritis',
    category: 'MSK',
    difficulty: 'intermediate',
    cards: [
      {
        id: '1',
        symptom: 'Morning stiffness > 1 hour',
        correctAnswer: 'A',
        explanation:
          'RA causes prolonged morning stiffness (>1 hour) due to inflammation. OA stiffness is brief (<30 min).',
      },
      {
        id: '2',
        symptom: 'Worse with activity, better with rest',
        correctAnswer: 'B',
        explanation:
          'OA is a "wear and tear" disease - symptoms worsen with use and improve with rest.',
      },
      {
        id: '3',
        symptom: 'Symmetric joint involvement',
        correctAnswer: 'A',
        explanation:
          'RA typically presents with symmetric polyarthritis, affecting both sides equally.',
      },
      {
        id: '4',
        symptom: 'DIP joint involvement',
        correctAnswer: 'B',
        explanation: 'OA commonly affects DIP joints. RA typically spares DIP joints.',
      },
      {
        id: '5',
        symptom: 'Positive RF and anti-CCP',
        correctAnswer: 'A',
        explanation: 'Rheumatoid factor and anti-CCP antibodies are markers of RA.',
      },
      {
        id: '6',
        symptom: 'Joint space narrowing and osteophytes',
        correctAnswer: 'B',
        explanation: 'OA shows joint space narrowing, osteophytes, subchondral sclerosis on X-ray.',
      },
      {
        id: '7',
        symptom: 'Periarticular erosions on X-ray',
        correctAnswer: 'A',
        explanation: 'RA causes characteristic periarticular erosions and osteopenia on X-ray.',
      },
      {
        id: '8',
        symptom: 'Heberden and Bouchard nodes',
        correctAnswer: 'B',
        explanation: 'Heberden (DIP) and Bouchard (PIP) nodes are bony enlargements seen in OA.',
      },
      {
        id: '9',
        symptom: 'Systemic symptoms (fatigue, fever)',
        correctAnswer: 'A',
        explanation: 'RA is a systemic inflammatory disease with constitutional symptoms.',
      },
      {
        id: '10',
        symptom: 'Weight-bearing joints most affected',
        correctAnswer: 'B',
        explanation: 'OA primarily affects weight-bearing joints (knees, hips) and hands.',
      },
      {
        id: '11',
        symptom: 'Swan neck and boutonniere deformities',
        correctAnswer: 'A',
        explanation: 'These hand deformities are characteristic of advanced RA.',
      },
      {
        id: '12',
        symptom: 'Crepitus on joint movement',
        correctAnswer: 'B',
        explanation: 'Crepitus (grinding sensation) is common in OA due to cartilage loss.',
      },
    ],
  },
  {
    id: 'heart-failure-types',
    conditionA: 'HFrEF (Systolic)',
    conditionB: 'HFpEF (Diastolic)',
    category: 'Cardiology',
    difficulty: 'advanced',
    cards: [
      {
        id: '1',
        symptom: 'EF < 40%',
        correctAnswer: 'A',
        explanation: 'HFrEF is defined by reduced ejection fraction (<40%).',
      },
      {
        id: '2',
        symptom: 'EF ≥ 50% with diastolic dysfunction',
        correctAnswer: 'B',
        explanation: 'HFpEF has preserved EF (≥50%) but impaired ventricular relaxation.',
      },
      {
        id: '3',
        symptom: 'Dilated LV on echo',
        correctAnswer: 'A',
        explanation: 'HFrEF typically shows LV dilation with thin walls and poor contractility.',
      },
      {
        id: '4',
        symptom: 'LV hypertrophy with normal size',
        correctAnswer: 'B',
        explanation: 'HFpEF often shows concentric LV hypertrophy with normal or small cavity.',
      },
      {
        id: '5',
        symptom: 'S3 gallop on auscultation',
        correctAnswer: 'A',
        explanation: 'S3 (ventricular gallop) indicates volume overload seen in HFrEF.',
      },
      {
        id: '6',
        symptom: 'S4 gallop on auscultation',
        correctAnswer: 'B',
        explanation: 'S4 (atrial gallop) indicates stiff ventricle with impaired filling (HFpEF).',
      },
      {
        id: '7',
        symptom: 'Post-MI cardiomyopathy',
        correctAnswer: 'A',
        explanation: 'Ischemic cardiomyopathy after MI is a common cause of HFrEF.',
      },
      {
        id: '8',
        symptom: 'Hypertension as primary cause',
        correctAnswer: 'B',
        explanation: 'Chronic hypertension causing LVH is the most common cause of HFpEF.',
      },
      {
        id: '9',
        symptom: 'ACE inhibitors and beta-blockers proven beneficial',
        correctAnswer: 'A',
        explanation: 'These medications have clear mortality benefit in HFrEF.',
      },
      {
        id: '10',
        symptom: 'Treatment focuses on underlying conditions',
        correctAnswer: 'B',
        explanation: 'HFpEF treatment focuses on controlling HTN, rate control, and diuretics.',
      },
    ],
  },
  {
    id: 'copd-asthma',
    conditionA: 'COPD',
    conditionB: 'Asthma',
    category: 'Pulmonology',
    difficulty: 'intermediate',
    cards: [
      {
        id: '1',
        symptom: 'Fixed airflow obstruction',
        correctAnswer: 'A',
        explanation:
          'COPD has fixed, irreversible airflow obstruction. FEV1/FVC ratio remains low.',
      },
      {
        id: '2',
        symptom: 'Reversible airflow obstruction',
        correctAnswer: 'B',
        explanation:
          'Asthma shows reversible obstruction with ≥12% improvement post-bronchodilator.',
      },
      {
        id: '3',
        symptom: 'Strong association with smoking',
        correctAnswer: 'A',
        explanation: 'Smoking is the primary cause of COPD (>90% of cases).',
      },
      {
        id: '4',
        symptom: 'Atopy and allergies common',
        correctAnswer: 'B',
        explanation: 'Asthma is often associated with atopy, allergies, and eczema.',
      },
      {
        id: '5',
        symptom: 'Onset typically after age 40',
        correctAnswer: 'A',
        explanation: 'COPD typically presents in middle age or later after years of exposure.',
      },
      {
        id: '6',
        symptom: 'Often begins in childhood',
        correctAnswer: 'B',
        explanation: 'Asthma commonly begins in childhood, though can occur at any age.',
      },
      {
        id: '7',
        symptom: 'Chronic productive cough',
        correctAnswer: 'A',
        explanation: 'Chronic bronchitis component of COPD causes persistent productive cough.',
      },
      {
        id: '8',
        symptom: 'Episodic wheezing and dyspnea',
        correctAnswer: 'B',
        explanation: 'Asthma presents with episodic symptoms often triggered by specific factors.',
      },
      {
        id: '9',
        symptom: 'Hyperinflation on chest X-ray',
        correctAnswer: 'A',
        explanation: 'COPD shows hyperinflation, flattened diaphragms, and increased AP diameter.',
      },
      {
        id: '10',
        symptom: 'Normal chest X-ray between attacks',
        correctAnswer: 'B',
        explanation: 'Asthma patients typically have normal CXR between exacerbations.',
      },
      {
        id: '11',
        symptom: 'Elevated eosinophils in sputum',
        correctAnswer: 'B',
        explanation: 'Eosinophilic airway inflammation is characteristic of asthma.',
      },
      {
        id: '12',
        symptom: 'Neutrophilic airway inflammation',
        correctAnswer: 'A',
        explanation: 'COPD shows predominantly neutrophilic inflammation.',
      },
    ],
  },
];

// ============================================================================
// Landing Page Component
// ============================================================================

interface LandingPageProps {
  onSelectPair: (pair: DDxPair) => void;
  onExit: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onSelectPair, onExit }) => {
  const categories = useMemo(() => {
    const cats = new Map<string, DDxPair[]>();
    DDX_PAIRS.forEach((pair) => {
      const existing = cats.get(pair.category) || [];
      cats.set(pair.category, [...existing, pair]);
    });
    return cats;
  }, []);

  const getDifficultyColor = (difficulty: DDxPair['difficulty']) => {
    switch (difficulty) {
      case 'beginner':
        return 'text-data-pass bg-data-pass/20';
      case 'intermediate':
        return 'text-data-provisional bg-data-provisional/20';
      case 'advanced':
        return 'text-data-fail bg-data-fail/20';
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[var(--color-bg-primary)]/95 backdrop-blur-sm border-b border-[var(--color-border)]">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={onExit}
            className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <X className="w-5 h-5" />
            <span className="text-sm font-medium">Exit</span>
          </button>
          <div className="flex items-center gap-2">
            <GitCompare className="w-6 h-6 text-[var(--color-category-practice)]" />
            <h1 className="text-xl font-bold text-[var(--color-text-primary)]">DDx Compare</h1>
          </div>
          <div className="w-16" />
        </div>
      </header>

      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[color-mix(in_srgb,var(--color-category-practice)_10%,transparent)] border border-[color-mix(in_srgb,var(--color-category-practice)_20%,transparent)] mb-6">
            <Brain className="w-4 h-4 text-[var(--color-category-practice)]" />
            <span className="text-sm font-medium text-[var(--color-category-practice)]">Pattern Recognition Training</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-[var(--color-text-primary)] mb-4">
            Master Differential Diagnosis
          </h2>
          <p className="text-lg text-[var(--color-text-muted)] max-w-2xl mx-auto">
            Swipe symptoms left or right to sort them between two conditions. Build muscle memory
            for the distinguishing features that matter most on exam day.
          </p>
        </div>

        {/* How It Works */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="p-6 rounded-2xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
            <div className="w-12 h-12 rounded-xl bg-[color-mix(in_srgb,var(--color-category-practice)_20%,transparent)] flex items-center justify-center mb-4">
              <Target className="w-6 h-6 text-[var(--color-category-practice)]" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
              Choose a DDx Pair
            </h3>
            <p className="text-sm text-[var(--color-text-muted)]">
              Select two commonly confused conditions to practice differentiating.
            </p>
          </div>
          <div className="p-6 rounded-2xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
            <div className="w-12 h-12 rounded-xl bg-data-pass/20 flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-data-pass" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
              Sort Symptoms
            </h3>
            <p className="text-sm text-[var(--color-text-muted)]">
              Symptoms appear one at a time. Tap left or right to assign each to the correct
              condition.
            </p>
          </div>
          <div className="p-6 rounded-2xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
            <div className="w-12 h-12 rounded-xl bg-data-provisional/20 flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-data-provisional" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
              Learn from Feedback
            </h3>
            <p className="text-sm text-[var(--color-text-muted)]">
              Get instant explanations for each answer to reinforce your understanding.
            </p>
          </div>
        </div>

        {/* DDx Pairs by Category */}
        <div className="space-y-8">
          {Array.from(categories.entries()).map(([category, pairs]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">
                {category}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pairs.map((pair) => (
                  <motion.button
                    key={pair.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onSelectPair(pair)}
                    className="text-left p-5 rounded-2xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:border-[color-mix(in_srgb,var(--color-category-practice)_50%,transparent)] transition-all group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <GitCompare className="w-5 h-5 text-[var(--color-category-practice)]" />
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${getDifficultyColor(pair.difficulty)}`}
                      >
                        {pair.difficulty}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-[var(--color-text-primary)]">
                        {pair.conditionA}
                      </span>
                      <span className="text-[var(--color-text-muted)]">vs</span>
                      <span className="font-semibold text-[var(--color-text-primary)]">
                        {pair.conditionB}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[var(--color-text-muted)]">
                        {pair.cards.length} symptoms
                      </span>
                      <ArrowRight className="w-4 h-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-category-practice)] transition-colors" />
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Drill Session Component
// ============================================================================

interface DrillSessionProps {
  pair: DDxPair;
  onExit: () => void;
  onBack: () => void;
}

const DrillSession: React.FC<DrillSessionProps> = ({ pair, onExit, onBack }) => {
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [status, setStatus] = useState<'playing' | 'feedback'>('playing');
  const [isCorrect, setIsCorrect] = useState(false);
  const [userChoice, setUserChoice] = useState<'A' | 'B' | null>(null);
  const [score, setScore] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [shuffledCards, setShuffledCards] = useState<SymptomCard[]>([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    const shuffled = [...pair.cards].sort(() => Math.random() - 0.5);
    setShuffledCards(shuffled);
  }, [pair.cards]);

  const currentCard = useMemo(() => {
    return shuffledCards[currentCardIndex] || null;
  }, [shuffledCards, currentCardIndex]);

  const handleChoice = useCallback(
    (choice: 'A' | 'B') => {
      if (!currentCard || status === 'feedback') return;
      const correct = choice === currentCard.correctAnswer;
      setUserChoice(choice);
      setIsCorrect(correct);
      setStatus('feedback');
      setTotalAttempts((prev) => prev + 1);
      if (correct) setScore((prev) => prev + 1);
    },
    [currentCard, status]
  );

  const handleNext = useCallback(() => {
    if (currentCardIndex < shuffledCards.length - 1) {
      setCurrentCardIndex((prev) => prev + 1);
      setStatus('playing');
      setUserChoice(null);
    } else {
      setShowResults(true);
    }
  }, [currentCardIndex, shuffledCards.length]);

  const handleReset = useCallback(() => {
    const reshuffled = [...pair.cards].sort(() => Math.random() - 0.5);
    setShuffledCards(reshuffled);
    setCurrentCardIndex(0);
    setScore(0);
    setTotalAttempts(0);
    setStatus('playing');
    setUserChoice(null);
    setShowResults(false);
  }, [pair.cards]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showResults) return;
      if (status === 'playing') {
        if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') {
          e.preventDefault();
          handleChoice('A');
        } else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'b') {
          e.preventDefault();
          handleChoice('B');
        }
      } else if (status === 'feedback') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleNext();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [status, handleChoice, handleNext, showResults]);

  if (showResults) {
    const percentage = Math.round((score / totalAttempts) * 100);
    return (
      <div className="fixed inset-0 z-50 bg-[var(--color-bg-primary)] flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          className="max-w-md w-full p-8 rounded-3xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-center"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <Trophy className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
            Session Complete!
          </h2>
          <p className="text-[var(--color-text-muted)] mb-6">
            {pair.conditionA} vs {pair.conditionB}
          </p>
          <div className="text-5xl font-bold text-[var(--color-text-primary)] mb-2">
            {percentage}%
          </div>
          <p className="text-[var(--color-text-muted)] mb-8">
            {score} of {totalAttempts} correct
          </p>
          <div className="space-y-3">
            <button
              onClick={handleReset}
              className="w-full py-3 px-6 rounded-xl bg-[var(--color-category-practice)] hover:bg-[var(--color-category-practice)] text-white font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              Try Again
            </button>
            <button
              onClick={onBack}
              className="w-full py-3 px-6 rounded-xl bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-tertiary)]/80 text-[var(--color-text-primary)] font-semibold transition-colors"
            >
              Choose Another Pair
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Loading state - Use skeleton loader for zero CLS
  if (shuffledCards.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-[var(--color-bg-primary)] flex items-center justify-center p-4">
        <div className="max-w-3xl w-full">
          <QuestionSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-bg-primary)] flex flex-col overflow-hidden">
      <header className="relative z-20 flex items-center justify-between px-4 py-3 bg-[var(--color-bg-primary)] border-b border-[var(--color-border)]">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium hidden sm:inline">Back</span>
        </button>
        <div className="text-center">
          <h1 className="text-sm font-semibold text-[var(--color-text-primary)]">DDx Compare</h1>
          <p className="text-xs text-[var(--color-text-muted)]">
            {currentCardIndex + 1} of {shuffledCards.length}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Trophy className="w-4 h-4 text-data-provisional" />
          <span className="text-sm font-bold text-data-provisional">
            {score}/{totalAttempts}
          </span>
        </div>
      </header>

      <div className="w-full h-1 bg-[var(--color-bg-tertiary)]">
        <motion.div
          className="h-full bg-[var(--color-category-practice)]"
          initial={{ width: 0 }}
          animate={{ width: `${((currentCardIndex + 1) / shuffledCards.length) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <div className="flex-1 flex flex-col">
        <div className="grid grid-cols-2 border-b border-[var(--color-border)]">
          <div className="p-4 text-center bg-[color-mix(in_srgb,var(--color-category-practice)_5%,transparent)] border-r border-[var(--color-border)]">
            <h2 className="text-lg font-bold text-[var(--color-category-practice)]">{pair.conditionA}</h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-1 hidden sm:block">← or A</p>
          </div>
          <div className="p-4 text-center bg-[var(--color-data-fail)]/5">
            <h2 className="text-lg font-bold text-[var(--color-data-fail)]">{pair.conditionB}</h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-1 hidden sm:block">→ or B</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <AnimatePresence mode="wait">
            {currentCard && (
              <motion.div
                key={currentCard.id}
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{
                  opacity: 0,
                  x: userChoice === 'A' ? -100 : userChoice === 'B' ? 100 : 0,
                  scale: 0.95,
                }}
                transition={{ duration: 0.25 }}
                className="w-full max-w-lg"
              >
                <div
                  className={`p-6 rounded-2xl border-2 transition-colors ${status === 'playing' ? 'bg-[var(--color-bg-secondary)] border-[var(--color-border)]' : isCorrect ? 'bg-[var(--color-data-pass)]/10 border-[var(--color-data-pass)]' : 'bg-[var(--color-data-fail)]/10 border-[var(--color-data-fail)]'}`}
                >
                  <p className="text-xl sm:text-2xl font-semibold text-center text-[var(--color-text-primary)] mb-4">
                    {currentCard.symptom}
                  </p>
                  {status === 'feedback' && (
                    <motion.div
                      initial={{ y: 10 }}
                      animate={{ y: 0 }}
                      className="pt-4 border-t border-[var(--color-border)]"
                    >
                      <div className="flex items-center justify-center gap-2 mb-3">
                        {isCorrect ? (
                          <CheckCircle className="w-6 h-6 text-data-pass" />
                        ) : (
                          <XCircle className="w-6 h-6 text-data-fail" />
                        )}
                        <span
                          className={`font-bold ${isCorrect ? 'text-[var(--color-data-pass)]' : 'text-[var(--color-data-fail)]'}`}
                        >
                          {isCorrect
                            ? 'Correct!'
                            : `Incorrect - ${currentCard.correctAnswer === 'A' ? pair.conditionA : pair.conditionB}`}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--color-text-muted)] text-center mb-4">
                        {currentCard.explanation}
                      </p>
                      <button
                        onClick={handleNext}
                        className="w-full py-3 bg-[var(--color-category-practice)] hover:bg-[var(--color-category-practice)] text-white rounded-xl font-semibold transition-colors"
                      >
                        {currentCardIndex < shuffledCards.length - 1 ? 'Next' : 'See Results'}
                      </button>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {status === 'playing' && (
            <div className="grid grid-cols-2 gap-4 w-full max-w-lg mt-6">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleChoice('A')}
                className="py-4 px-6 rounded-xl bg-[color-mix(in_srgb,var(--color-category-practice)_10%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-category-practice)_20%,transparent)] border-2 border-[color-mix(in_srgb,var(--color-category-practice)_30%,transparent)] hover:border-[var(--color-category-practice)] text-[var(--color-category-practice)] font-semibold transition-all flex items-center justify-center gap-2"
              >
                <ChevronLeft className="w-5 h-5" />
                {pair.conditionA.split(' ')[0]}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleChoice('B')}
                className="py-4 px-6 rounded-xl bg-[var(--color-data-fail)]/10 hover:bg-[var(--color-data-fail)]/20 border-2 border-[var(--color-data-fail)]/30 hover:border-[var(--color-data-fail)] text-[var(--color-data-fail)] font-semibold transition-all flex items-center justify-center gap-2"
              >
                {pair.conditionB.split(' ')[0]}
                <ChevronRight className="w-5 h-5" />
              </motion.button>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={handleReset}
        className="fixed bottom-4 right-4 p-3 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors shadow-lg z-20 border border-[var(--color-border)]"
        title="Reset session"
      >
        <RotateCcw className="w-5 h-5" />
      </button>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

interface DDxCompareDrillProps {
  onExit?: () => void;
}

const DDxCompareDrill: React.FC<DDxCompareDrillProps> = ({ onExit }) => {
  const [selectedPair, setSelectedPair] = useState<DDxPair | null>(null);

  const handleExit = () => {
    if (onExit) onExit();
  };

  if (selectedPair) {
    return (
      <DrillSession pair={selectedPair} onExit={handleExit} onBack={() => setSelectedPair(null)} />
    );
  }

  return <LandingPage onSelectPair={setSelectedPair} onExit={handleExit} />;
};

export default DDxCompareDrill;
