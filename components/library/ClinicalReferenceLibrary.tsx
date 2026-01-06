/**
 * Clinical Reference Library - Master Reference Hub
 * 
 * Unified interface to browse and search all clinical reference data:
 * - Anatomy Structures (300+ entries)
 * - Lab Tests (200+ entries)
 * - Drugs (1000+ entries)
 * - ECG Patterns (50+ entries)
 * - Procedures (30+ entries)
 * - Physiology Concepts (50+ entries)
 * - Special Tests (100+ entries)
 * - Physical Exam Findings (50+ entries)
 * - Scoring Systems (50+ entries)
 * - Imaging Studies (50+ entries)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  ChevronRight,
  Bone,
  TestTube,
  Pill,
  Activity,
  Stethoscope,
  Brain,
  Heart,
  X,
  Star,
  Bookmark,
  Clock,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { useReferenceService } from '@/services/referenceDataService';

// Reference category configuration
const REFERENCE_CATEGORIES = [
  { 
    id: 'anatomy', 
    label: 'Anatomy', 
    icon: Bone, 
    color: 'slate',
    description: '300+ anatomical structures with clinical correlates',
    endpoint: 'anatomy'
  },
  { 
    id: 'labs', 
    label: 'Lab Tests', 
    icon: TestTube, 
    color: 'emerald',
    description: '200+ lab tests with normal ranges & interpretation',
    endpoint: 'labs'
  },
  { 
    id: 'drugs', 
    label: 'Pharmacology', 
    icon: Pill, 
    color: 'violet',
    description: '1000+ drugs with mechanisms & interactions',
    endpoint: 'drugs'
  },
  { 
    id: 'ecg', 
    label: 'ECG Patterns', 
    icon: Activity, 
    color: 'rose',
    description: '50+ ECG patterns with diagnostic criteria',
    endpoint: 'ecg'
  },
  { 
    id: 'procedures', 
    label: 'Procedures', 
    icon: Stethoscope, 
    color: 'blue',
    description: '30+ procedures with technique & complications',
    endpoint: 'procedures'
  },
  { 
    id: 'physiology', 
    label: 'Physiology', 
    icon: Brain, 
    color: 'amber',
    description: '50+ physiology concepts with mechanisms',
    endpoint: 'physiology'
  },
];

interface ReferenceItem {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  category?: string;
  system?: string;
  isHighYield?: boolean;
  panceYield?: number;
  clinicalPearls?: string[];
  mnemonics?: string[];
  [key: string]: any;
}

interface ClinicalReferenceLibraryProps {
  onExit?: () => void;
  initialCategory?: string;
  initialSearch?: string;
}

export const ClinicalReferenceLibrary: React.FC<ClinicalReferenceLibraryProps> = ({
  onExit,
  initialCategory,
  initialSearch = '',
}) => {
  const { getToken, isSignedIn } = useAuth();
  const refService = useReferenceService();
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialCategory || null);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [items, setItems] = useState<ReferenceItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<ReferenceItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ReferenceItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHighYieldOnly, setShowHighYieldOnly] = useState(false);

  // Fetch items when category changes
  useEffect(() => {
    if (!selectedCategory || !isSignedIn) {
      setItems([]);
      return;
    }

    const fetchItems = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        let data: ReferenceItem[] = [];
        
        switch (selectedCategory) {
          case 'anatomy':
            data = await refService.anatomy.getAll();
            break;
          case 'labs':
            data = await refService.labs.getAll();
            break;
          case 'ecg':
            data = await refService.ecg.getAll();
            break;
          case 'procedures':
            data = await refService.procedures.getAll();
            break;
          case 'physiology':
            data = await refService.physiology.getAll();
            break;
          case 'drugs':
            // Drugs endpoint - fetch from /api/drugs
            const response = await fetch('/api/drugs', {
              headers: {
                'Authorization': `Bearer ${await getToken()}`,
              }
            });
            if (response.ok) {
              const result = await response.json();
              data = result.data || result || [];
            }
            break;
          default:
            data = [];
        }
        
        setItems(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(`Error fetching ${selectedCategory}:`, err);
        setError(`Failed to load ${selectedCategory}. Please try again.`);
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchItems();
  }, [selectedCategory, refService, getToken, isSignedIn]);

  // Filter items based on search and high-yield filter
  useEffect(() => {
    let filtered = items;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.name?.toLowerCase().includes(query) ||
        item.displayName?.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query) ||
        item.category?.toLowerCase().includes(query) ||
        item.system?.toLowerCase().includes(query)
      );
    }
    
    if (showHighYieldOnly) {
      filtered = filtered.filter(item => item.isHighYield || (item.panceYield && item.panceYield >= 3));
    }
    
    setFilteredItems(filtered);
  }, [items, searchQuery, showHighYieldOnly]);

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setSelectedItem(null);
    setSearchQuery('');
  };

  const handleBack = () => {
    if (selectedItem) {
      setSelectedItem(null);
    } else if (selectedCategory) {
      setSelectedCategory(null);
    } else if (onExit) {
      onExit();
    }
  };

  const categoryConfig = REFERENCE_CATEGORIES.find(c => c.id === selectedCategory);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBack}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  {selectedItem 
                    ? (selectedItem.displayName || selectedItem.name)
                    : selectedCategory 
                      ? categoryConfig?.label 
                      : 'Clinical Reference Library'}
                </h1>
                {!selectedItem && selectedCategory && (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {filteredItems.length} {filteredItems.length === 1 ? 'entry' : 'entries'}
                  </p>
                )}
              </div>
            </div>
            
            {onExit && !selectedCategory && (
              <button
                onClick={onExit}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
            )}
          </div>

          {/* Search & Filters (when category selected) */}
          {selectedCategory && !selectedItem && (
            <div className="mt-4 flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search ${categoryConfig?.label.toLowerCase()}...`}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={() => setShowHighYieldOnly(!showHighYieldOnly)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-colors ${
                  showHighYieldOnly
                    ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Star className="w-4 h-4" />
                <span className="hidden sm:inline">High-Yield</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {/* Category Selection */}
          {!selectedCategory && (
            <motion.div
              key="categories"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {REFERENCE_CATEGORIES.map((category) => {
                const Icon = category.icon;
                return (
                  <motion.button
                    key={category.id}
                    onClick={() => handleCategorySelect(category.id)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 transition-all text-left group"
                  >
                    <div className={`w-12 h-12 rounded-xl bg-${category.color}-100 dark:bg-${category.color}-900/30 flex items-center justify-center mb-4`}>
                      <Icon className={`w-6 h-6 text-${category.color}-600 dark:text-${category.color}-400`} />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2 flex items-center justify-between">
                      {category.label}
                      <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {category.description}
                    </p>
                  </motion.button>
                );
              })}
            </motion.div>
          )}

          {/* Item List */}
          {selectedCategory && !selectedItem && (
            <motion.div
              key="items"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
              ) : error ? (
                <div className="text-center py-20">
                  <p className="text-red-500 dark:text-red-400">{error}</p>
                  <button
                    onClick={() => setSelectedCategory(selectedCategory)}
                    className="mt-4 px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-slate-500 dark:text-slate-400">
                    {searchQuery ? 'No results found' : 'No items available'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredItems.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      onClick={() => setSelectedItem(item)}
                      categoryConfig={categoryConfig}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Item Detail */}
          {selectedItem && (
            <motion.div
              key="detail"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <ItemDetail item={selectedItem} category={selectedCategory} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

// Item Card Component
interface ItemCardProps {
  item: ReferenceItem;
  onClick: () => void;
  categoryConfig?: typeof REFERENCE_CATEGORIES[0];
}

const ItemCard: React.FC<ItemCardProps> = ({ item, onClick, categoryConfig }) => {
  const isHighYield = item.isHighYield || (item.panceYield && item.panceYield >= 3);
  
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ x: 4 }}
      className="w-full p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 transition-all text-left flex items-center gap-4"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-slate-900 dark:text-white truncate">
            {item.displayName || item.name}
          </h3>
          {isHighYield && (
            <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-medium">
              High-Yield
            </span>
          )}
        </div>
        {(item.category || item.system) && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {item.category || item.system}
          </p>
        )}
        {item.description && (
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 line-clamp-1">
            {item.description}
          </p>
        )}
      </div>
      <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
    </motion.button>
  );
};

// Item Detail Component
interface ItemDetailProps {
  item: ReferenceItem;
  category: string | null;
}

const ItemDetail: React.FC<ItemDetailProps> = ({ item, category }) => {
  // Render different detail views based on category
  const renderCategorySpecificContent = () => {
    switch (category) {
      case 'anatomy':
        return <AnatomyDetail item={item} />;
      case 'labs':
        return <LabDetail item={item} />;
      case 'ecg':
        return <ECGDetail item={item} />;
      case 'procedures':
        return <ProcedureDetail item={item} />;
      case 'physiology':
        return <PhysiologyDetail item={item} />;
      case 'drugs':
        return <DrugDetail item={item} />;
      default:
        return <GenericDetail item={item} />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              {item.displayName || item.name}
            </h2>
            {item.aliases && item.aliases.length > 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Also known as: {item.aliases.slice(0, 3).join(', ')}
              </p>
            )}
          </div>
          {(item.isHighYield || (item.panceYield && item.panceYield >= 3)) && (
            <span className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-sm font-medium flex items-center gap-1">
              <Star className="w-4 h-4" />
              High-Yield
            </span>
          )}
        </div>
        
        {/* Category/System badges */}
        <div className="flex flex-wrap gap-2 mb-4">
          {item.category && (
            <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm">
              {item.category}
            </span>
          )}
          {item.system && (
            <span className="px-2 py-1 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 text-sm">
              {item.system}
            </span>
          )}
        </div>

        {item.description && (
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            {item.description}
          </p>
        )}
      </div>

      {/* Category-specific content */}
      {renderCategorySpecificContent()}

      {/* Clinical Pearls & Mnemonics */}
      {(item.clinicalPearls?.length > 0 || item.mnemonics?.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {item.clinicalPearls?.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
              <h4 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-500" />
                Clinical Pearls
              </h4>
              <ul className="space-y-2">
                {item.clinicalPearls.map((pearl, idx) => (
                  <li key={idx} className="text-sm text-slate-600 dark:text-slate-300 flex items-start gap-2">
                    <span className="text-rose-500 mt-1">•</span>
                    {pearl}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {item.mnemonics?.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
              <h4 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Brain className="w-4 h-4 text-violet-500" />
                Mnemonics
              </h4>
              <ul className="space-y-2">
                {item.mnemonics.map((mnemonic, idx) => (
                  <li key={idx} className="text-sm text-slate-600 dark:text-slate-300 flex items-start gap-2">
                    <span className="text-violet-500 mt-1">•</span>
                    {mnemonic}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Category-specific detail components
const AnatomyDetail: React.FC<{ item: ReferenceItem }> = ({ item }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {item.function && (
      <DetailSection title="Function" content={item.function} />
    )}
    {item.innervation && (
      <DetailSection title="Innervation" content={item.innervation} />
    )}
    {item.bloodSupply && (
      <DetailSection title="Blood Supply" content={item.bloodSupply} />
    )}
    {item.clinicalSignificance && (
      <DetailSection title="Clinical Significance" content={item.clinicalSignificance} />
    )}
    {item.commonPathology?.length > 0 && (
      <DetailSection title="Common Pathology" list={item.commonPathology} />
    )}
    {item.examFindings?.length > 0 && (
      <DetailSection title="Exam Findings" list={item.examFindings} />
    )}
  </div>
);

const LabDetail: React.FC<{ item: ReferenceItem }> = ({ item }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {item.normalRange && (
      <DetailSection title="Normal Range" content={`${item.normalRange}${item.units ? ` ${item.units}` : ''}`} />
    )}
    {item.specimenType && (
      <DetailSection title="Specimen Type" content={item.specimenType} />
    )}
    {item.clinicalSignificance && (
      <DetailSection title="Clinical Significance" content={item.clinicalSignificance} />
    )}
    {item.interpretation && typeof item.interpretation === 'object' && (
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
        <h4 className="font-semibold text-slate-900 dark:text-white mb-3">Interpretation</h4>
        <dl className="space-y-2">
          {Object.entries(item.interpretation).map(([key, value]) => (
            <div key={key}>
              <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">{key}</dt>
              <dd className="text-sm text-slate-700 dark:text-slate-300">{value as string}</dd>
            </div>
          ))}
        </dl>
      </div>
    )}
  </div>
);

const ECGDetail: React.FC<{ item: ReferenceItem }> = ({ item }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {item.rate && (
      <DetailSection title="Rate" content={item.rate} />
    )}
    {item.rhythm && (
      <DetailSection title="Rhythm" content={item.rhythm} />
    )}
    {item.pWave && (
      <DetailSection title="P Wave" content={item.pWave} />
    )}
    {item.qrsComplex && (
      <DetailSection title="QRS Complex" content={item.qrsComplex} />
    )}
    {item.causes?.length > 0 && (
      <DetailSection title="Causes" list={item.causes} />
    )}
    {item.acuteManagement && (
      <DetailSection title="Acute Management" content={item.acuteManagement} />
    )}
  </div>
);

const ProcedureDetail: React.FC<{ item: ReferenceItem }> = ({ item }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {item.type && (
      <DetailSection title="Type" content={item.type} />
    )}
    {item.positioning && (
      <DetailSection title="Positioning" content={item.positioning} />
    )}
    {item.anesthesia && (
      <DetailSection title="Anesthesia" content={item.anesthesia} />
    )}
    {item.duration && (
      <DetailSection title="Duration" content={item.duration} />
    )}
    {item.preparation && (
      <DetailSection title="Preparation" content={item.preparation} />
    )}
    {item.indications?.length > 0 && (
      <DetailSection title="Indications" list={item.indications} />
    )}
    {item.complications?.length > 0 && (
      <DetailSection title="Complications" list={item.complications} />
    )}
    {item.technique && (
      <DetailSection title="Technique" content={item.technique} />
    )}
  </div>
);

const PhysiologyDetail: React.FC<{ item: ReferenceItem }> = ({ item }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {item.mechanism && (
      <DetailSection title="Mechanism" content={item.mechanism} />
    )}
    {item.molecularBasis && (
      <DetailSection title="Molecular Basis" content={item.molecularBasis} />
    )}
    {item.signalTransduction && (
      <DetailSection title="Signal Transduction" content={item.signalTransduction} />
    )}
    {item.feedbackLoops && (
      <DetailSection title="Feedback Loops" content={item.feedbackLoops} />
    )}
    {item.regulatoryFactors?.length > 0 && (
      <DetailSection title="Regulatory Factors" list={item.regulatoryFactors} />
    )}
    {item.drugTargets?.length > 0 && (
      <DetailSection title="Drug Targets" list={item.drugTargets} />
    )}
  </div>
);

const DrugDetail: React.FC<{ item: ReferenceItem }> = ({ item }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {item.genericName && (
      <DetailSection title="Generic Name" content={item.genericName} />
    )}
    {item.drugClass?.length > 0 && (
      <DetailSection title="Drug Class" list={item.drugClass} />
    )}
    {item.mechanism && (
      <DetailSection title="Mechanism" content={item.mechanism} />
    )}
    {item.indications?.length > 0 && (
      <DetailSection title="Indications" list={item.indications} />
    )}
    {item.contraindications?.length > 0 && (
      <DetailSection title="Contraindications" list={item.contraindications} />
    )}
    {item.sideEffects?.length > 0 && (
      <DetailSection title="Side Effects" list={item.sideEffects} />
    )}
    {item.interactions?.length > 0 && (
      <DetailSection title="Interactions" list={item.interactions} />
    )}
  </div>
);

const GenericDetail: React.FC<{ item: ReferenceItem }> = ({ item }) => {
  // Render all non-null fields
  const excludeKeys = ['id', 'createdAt', 'updatedAt', 'name', 'displayName', 'description', 'clinicalPearls', 'mnemonics', 'isHighYield', 'panceYield', 'category', 'system', 'aliases'];
  
  const fields = Object.entries(item).filter(([key, value]) => 
    !excludeKeys.includes(key) && value != null && value !== ''
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {fields.map(([key, value]) => {
        const title = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        
        if (Array.isArray(value) && value.length > 0) {
          return <DetailSection key={key} title={title} list={value as string[]} />;
        } else if (typeof value === 'string') {
          return <DetailSection key={key} title={title} content={value} />;
        }
        return null;
      })}
    </div>
  );
};

// Reusable detail section
interface DetailSectionProps {
  title: string;
  content?: string;
  list?: string[];
}

const DetailSection: React.FC<DetailSectionProps> = ({ title, content, list }) => (
  <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
    <h4 className="font-semibold text-slate-900 dark:text-white mb-2">{title}</h4>
    {content && (
      <p className="text-sm text-slate-600 dark:text-slate-300">{content}</p>
    )}
    {list && list.length > 0 && (
      <ul className="space-y-1">
        {list.slice(0, 10).map((item, idx) => (
          <li key={idx} className="text-sm text-slate-600 dark:text-slate-300 flex items-start gap-2">
            <span className="text-blue-500 mt-1">•</span>
            {item}
          </li>
        ))}
        {list.length > 10 && (
          <li className="text-sm text-slate-400 dark:text-slate-500 italic">
            +{list.length - 10} more...
          </li>
        )}
      </ul>
    )}
  </div>
);

export default ClinicalReferenceLibrary;
