import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Pill, 
  AlertTriangle,
  Lightbulb, 
  Beaker,
  Clock,
  Users,
  Shield,
  TrendingUp,
  FileText,
  Link as LinkIcon,
  Baby,
  Heart,
  Droplet,
  Zap,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Drug {
  id: string;
  genericName: string;
  brandName?: string | null;
  displayName?: string | null;
  drugClass: string[];
  mechanismOfAction?: string | null;
  indications: string[];
  contraindications: string[];
  dosing?: string | null;
  isHighYield: boolean;
  isFirstLine: boolean;
  panceYield?: number | null;
  // Pharmacology
  absorption?: string | null;
  distribution?: string | null;
  metabolism?: string | null;
  elimination?: string | null;
  halfLife?: string | null;
  onsetOfAction?: string | null;
  peakEffect?: string | null;
  duration?: string | null;
  bioavailability?: string | null;
  pharmacokinetics?: any;
  cyp450Effects?: any;
  // Clinical Use
  clinicalNotes?: string | null;
  clinicalPearls: string[];
  boardYieldFacts: string[];
  mnemonics: string[];
  commonMistakes: string[];
  testQuestionTips: string[];
  administrationTips?: string | null;
  monitoringParams: string[];
  routesOfAdmin: string[];
  formulations: string[];
  // Safety
  sideEffects: string[];
  interactions: string[];
  majorInteractions?: any;
  blackBoxWarnings: string[];
  foodInteractions: string[];
  antidote?: string | null;
  reversalAgent?: string | null;
  toxicity?: string | null;
  riskStrategies: string[];
  // Special Populations
  pregnancyCategory?: string | null;
  pregnancyNotes?: string | null;
  lactationSafety?: string | null;
  lactationNotes?: string | null;
  pediatricDosing?: string | null;
  pediatricNotes?: string | null;
  geriatricDosing?: string | null;
  geriatricNotes?: string | null;
  renalDosing?: string | null;
  hepaticDosing?: string | null;
  // Metadata
  genericAvailable: boolean;
  typicalCost?: string | null;
  insuranceTier?: number | null;
  storageRequirements?: string | null;
  aliases: string[];
  tags: string[];
  // Relations
  DrugConditionLink?: Array<{
    relationshipType: string;
    evidenceLevel?: string | null;
    isFirstLine: boolean;
    Condition: {
      id: string;
      condition: string;
      system: string;
    };
  }>;
}

interface DrugMasterProps {
  drug: Drug | null;
  onClose: () => void;
}

// Helper component for labeled text fields
const TextField: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => {
  if (!value) return null;
  return (
    <div className="space-y-1">
      <h5 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">{label}</h5>
      <p className="text-sm text-[var(--color-text-primary)] leading-relaxed whitespace-pre-line">{value}</p>
    </div>
  );
};

// Helper component for markdown fields
const MarkdownField: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => {
  if (!value) return null;
  return (
    <div className="space-y-1">
      <h5 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">{label}</h5>
      <div className="text-sm text-[var(--color-text-primary)] prose prose-invert prose-sm max-w-none">
        <ReactMarkdown>{value}</ReactMarkdown>
      </div>
    </div>
  );
};

// Helper component for list fields
const ListField: React.FC<{ label: string; value: string[]; color?: string }> = ({ 
  label, 
  value, 
  color = 'blue' 
}) => {
  if (!value || value.length === 0) return null;
  
  const colorClasses = {
    blue: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    rose: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    purple: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  };
  
  return (
    <div className="space-y-2">
      <h5 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">{label}</h5>
      <div className="flex flex-wrap gap-2">
        {value.map((item, idx) => (
          <span
            key={idx}
            className={`px-3 py-1.5 rounded-lg ${colorClasses[color as keyof typeof colorClasses]} border text-xs font-medium`}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
};

// Collapsible section component
const Section: React.FC<{
  title: string;
  icon: React.ElementType;
  accentColor: string;
  children: React.ReactNode;
}> = ({ title, icon: Icon, accentColor, children }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  // Check if section has any content
  const hasContent = React.Children.toArray(children).some(child => child !== null);
  if (!hasContent) return null;

  return (
    <div className="rounded-xl bg-[var(--color-bg-secondary)]/50 border border-[var(--color-border)] overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-[var(--color-bg-secondary)] transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className={`w-5 h-5 ${accentColor}`} />
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{title}</h3>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <svg className="w-5 h-5 text-[var(--color-text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 space-y-4 border-t border-[var(--color-border)]">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const DrugMaster: React.FC<DrugMasterProps> = ({ drug, onClose }) => {
  if (!drug) return null;

  const displayName = drug.displayName || drug.genericName;
  const brandText = drug.brandName ? ` (${drug.brandName})` : '';

  // Process related conditions by relationship type
  const firstLineConditions = drug.DrugConditionLink?.filter(link => link.isFirstLine) || [];
  const alternativeConditions = drug.DrugConditionLink?.filter(link => !link.isFirstLine) || [];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-5xl max-h-[90vh] mx-4 bg-[var(--color-bg-primary)] rounded-2xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 bg-gradient-to-r from-[var(--color-bg-secondary)] to-[var(--color-bg-primary)] border-b border-[var(--color-border)] p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-3 mb-2">
                  <Pill className="w-7 h-7 text-[var(--color-accent)] flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-2xl font-bold text-[var(--color-text-primary)] truncate">
                      {displayName}
                      <span className="text-lg font-normal text-[var(--color-text-secondary)]">{brandText}</span>
                    </h2>
                  </div>
                </div>
                
                {/* Drug classes */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {drug.drugClass.map((cls, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 rounded-full bg-[var(--color-accent)]/20 text-[var(--color-accent)] text-xs font-semibold border border-[var(--color-accent)]/30"
                    >
                      {cls}
                    </span>
                  ))}
                </div>

                {/* High yield / First line badges */}
                <div className="flex gap-2 mt-3">
                  {drug.isHighYield && (
                    <span className="px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-300 text-xs font-semibold border border-yellow-500/30">
                      ⭐ High Yield
                    </span>
                  )}
                  {drug.isFirstLine && (
                    <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30">
                      🥇 First-Line
                    </span>
                  )}
                  {drug.panceYield && drug.panceYield >= 3 && (
                    <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold border border-blue-500/30">
                      PANCE: {drug.panceYield}/5
                    </span>
                  )}
                </div>
              </div>
              
              {/* Close button */}
              <button
                onClick={onClose}
                className="flex-shrink-0 p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors group"
                aria-label="Close"
              >
                <X className="w-6 h-6 text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]" />
              </button>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="overflow-y-auto max-h-[calc(90vh-140px)] p-6 space-y-6">
            
            {/* Quick Facts Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {drug.mechanismOfAction && (
                <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Beaker className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Mechanism</span>
                  </div>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">{drug.mechanismOfAction}</p>
                </div>
              )}
              {drug.dosing && (
                <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Droplet className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">Dosing</span>
                  </div>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">{drug.dosing}</p>
                </div>
              )}
            </div>

            {/* Indications */}
            {drug.indications.length > 0 && (
              <ListField label="Indications" value={drug.indications} color="blue" />
            )}

            {/* Related Conditions */}
            {firstLineConditions.length > 0 && (
              <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)]/50 border border-[var(--color-border)]">
                <h5 className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-3">First-Line for Conditions</h5>
                <div className="flex flex-wrap gap-2">
                  {firstLineConditions.map((link) => (
                    <span
                      key={link.Condition.id}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-medium"
                    >
                      {link.Condition.condition}
                      <span className="text-emerald-400/60 ml-1">({link.Condition.system})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Clinical Pearls */}
            {drug.clinicalPearls.length > 0 && (
              <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)]/50 border border-[var(--color-border)]">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-5 h-5 text-[var(--color-accent)]" />
                  <h4 className="text-sm font-semibold text-[var(--color-accent)] uppercase tracking-wide">Clinical Pearls</h4>
                </div>
                <ul className="space-y-2">
                  {drug.clinicalPearls.map((pearl, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-[var(--color-text-primary)]">
                      <span className="text-[var(--color-accent)] mt-1">•</span>
                      <span>{pearl}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Board Yield Facts */}
            {drug.boardYieldFacts.length > 0 && (
              <div className="p-4 rounded-xl bg-gradient-to-br from-yellow-500/15 to-yellow-600/10 border border-yellow-500/30">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-5 h-5 text-yellow-400" />
                  <h4 className="text-sm font-semibold text-yellow-400 uppercase tracking-wide">Board Yield Facts</h4>
                </div>
                <ul className="space-y-2">
                  {drug.boardYieldFacts.map((fact, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-[var(--color-text-primary)]">
                      <span className="text-yellow-400 mt-1">★</span>
                      <span>{fact}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Mnemonics */}
            {drug.mnemonics.length > 0 && (
              <div className="p-4 rounded-xl bg-gradient-to-br from-violet-500/15 to-purple-500/10 border border-violet-500/30">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-5 h-5 text-violet-400" />
                  <h4 className="text-sm font-semibold text-violet-400 uppercase tracking-wide">Memory Aids</h4>
                </div>
                {drug.mnemonics.map((mnemonic, idx) => (
                  <p key={idx} className="text-base font-bold text-[var(--color-text-primary)] font-mono tracking-wide mb-2">
                    {mnemonic}
                  </p>
                ))}
              </div>
            )}

            {/* Black Box Warnings */}
            {drug.blackBoxWarnings.length > 0 && (
              <div className="p-4 rounded-xl bg-gradient-to-r from-rose-500/20 to-red-600/15 border-2 border-rose-500/50">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-rose-300" />
                  <h4 className="text-sm font-semibold text-rose-300 uppercase tracking-wide">⚠️ Black Box Warnings</h4>
                </div>
                <ul className="space-y-2">
                  {drug.blackBoxWarnings.map((warning, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-rose-100 font-medium">
                      <span className="text-rose-400 mt-1">⚠</span>
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Expandable Sections */}
            <div className="space-y-4 pt-2">
              
              {/* Section 1: Pharmacology */}
              <Section title="Pharmacology & Pharmacokinetics" icon={Beaker} accentColor="text-blue-400">
                <TextField label="Absorption" value={drug.absorption} />
                <TextField label="Distribution" value={drug.distribution} />
                <TextField label="Metabolism" value={drug.metabolism} />
                <TextField label="Elimination" value={drug.elimination} />
                <TextField label="Half-Life" value={drug.halfLife} />
                <TextField label="Onset of Action" value={drug.onsetOfAction} />
                <TextField label="Peak Effect" value={drug.peakEffect} />
                <TextField label="Duration" value={drug.duration} />
                <TextField label="Bioavailability" value={drug.bioavailability} />
              </Section>

              {/* Section 2: Administration */}
              <Section title="Administration & Dosing" icon={Droplet} accentColor="text-emerald-400">
                <ListField label="Routes of Administration" value={drug.routesOfAdmin} color="emerald" />
                <ListField label="Available Formulations" value={drug.formulations} color="blue" />
                <TextField label="Administration Tips" value={drug.administrationTips} />
                <ListField label="Monitoring Parameters" value={drug.monitoringParams} color="amber" />
              </Section>

              {/* Section 3: Safety & Adverse Effects */}
              <Section title="Safety & Adverse Effects" icon={Shield} accentColor="text-rose-400">
                <ListField label="Common Side Effects" value={drug.sideEffects} color="rose" />
                <ListField label="Drug Interactions" value={drug.interactions} color="amber" />
                <ListField label="Food Interactions" value={drug.foodInteractions} color="purple" />
                <ListField label="Contraindications" value={drug.contraindications} color="rose" />
                <TextField label="Toxicity" value={drug.toxicity} />
                <TextField label="Antidote / Reversal Agent" value={drug.antidote || drug.reversalAgent} />
                <ListField label="Risk Mitigation Strategies" value={drug.riskStrategies} color="blue" />
              </Section>

              {/* Section 4: Special Populations */}
              <Section title="Special Populations" icon={Users} accentColor="text-purple-400">
                <div className="space-y-4">
                  {/* Pregnancy */}
                  {(drug.pregnancyCategory || drug.pregnancyNotes) && (
                    <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30">
                      <div className="flex items-center gap-2 mb-2">
                        <Heart className="w-4 h-4 text-purple-400" />
                        <h5 className="text-xs font-semibold text-purple-400 uppercase">Pregnancy</h5>
                      </div>
                      {drug.pregnancyCategory && (
                        <p className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
                          Category: {drug.pregnancyCategory}
                        </p>
                      )}
                      {drug.pregnancyNotes && (
                        <p className="text-sm text-[var(--color-text-primary)]">{drug.pregnancyNotes}</p>
                      )}
                    </div>
                  )}
                  
                  {/* Lactation */}
                  {(drug.lactationSafety || drug.lactationNotes) && (
                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                      <div className="flex items-center gap-2 mb-2">
                        <Droplet className="w-4 h-4 text-blue-400" />
                        <h5 className="text-xs font-semibold text-blue-400 uppercase">Lactation</h5>
                      </div>
                      {drug.lactationSafety && (
                        <p className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
                          {drug.lactationSafety}
                        </p>
                      )}
                      {drug.lactationNotes && (
                        <p className="text-sm text-[var(--color-text-primary)]">{drug.lactationNotes}</p>
                      )}
                    </div>
                  )}
                  
                  {/* Pediatric */}
                  {(drug.pediatricDosing || drug.pediatricNotes) && (
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                      <div className="flex items-center gap-2 mb-2">
                        <Baby className="w-4 h-4 text-emerald-400" />
                        <h5 className="text-xs font-semibold text-emerald-400 uppercase">Pediatric</h5>
                      </div>
                      <TextField label="Dosing" value={drug.pediatricDosing} />
                      <TextField label="Notes" value={drug.pediatricNotes} />
                    </div>
                  )}
                  
                  {/* Geriatric */}
                  {(drug.geriatricDosing || drug.geriatricNotes) && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-amber-400" />
                        <h5 className="text-xs font-semibold text-amber-400 uppercase">Geriatric</h5>
                      </div>
                      <TextField label="Dosing" value={drug.geriatricDosing} />
                      <TextField label="Notes" value={drug.geriatricNotes} />
                    </div>
                  )}
                  
                  {/* Renal / Hepatic */}
                  <TextField label="Renal Dosing Adjustments" value={drug.renalDosing} />
                  <TextField label="Hepatic Dosing Adjustments" value={drug.hepaticDosing} />
                </div>
              </Section>

              {/* Section 5: Test-Taking Tips */}
              {(drug.testQuestionTips.length > 0 || drug.commonMistakes.length > 0) && (
                <Section title="Test-Taking Strategy" icon={FileText} accentColor="text-yellow-400">
                  {drug.testQuestionTips.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-xs font-semibold text-yellow-400 uppercase tracking-wide">Question Tips</h5>
                      <ul className="space-y-2">
                        {drug.testQuestionTips.map((tip, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-[var(--color-text-primary)]">
                            <span className="text-yellow-400 mt-1">💡</span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {drug.commonMistakes.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-xs font-semibold text-rose-400 uppercase tracking-wide">Common Mistakes to Avoid</h5>
                      <ul className="space-y-2">
                        {drug.commonMistakes.map((mistake, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-[var(--color-text-primary)]">
                            <span className="text-rose-400 mt-1">⚠</span>
                            <span>{mistake}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Section>
              )}

              {/* Section 6: Additional Information */}
              <Section title="Additional Information" icon={FileText} accentColor="text-slate-400">
                <TextField label="Clinical Notes" value={drug.clinicalNotes} />
                <ListField label="Alternative Names / Aliases" value={drug.aliases} color="blue" />
                {drug.genericAvailable && (
                  <p className="text-sm text-emerald-400">✓ Generic available</p>
                )}
                <TextField label="Typical Cost" value={drug.typicalCost} />
                <TextField label="Storage Requirements" value={drug.storageRequirements} />
              </Section>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DrugMaster;
