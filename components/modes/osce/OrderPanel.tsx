// components/modes/osce/OrderPanel.tsx
// EMR-style Quick Order Panel with Clinical Decision Support

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  X,
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  FlaskConical,
  Scan,
  Syringe,
  Pill,
  Package,
  Zap,
  Info,
  ChevronRight,
  Plus,
  Minus,
  AlertCircle,
} from 'lucide-react';
import type {
  OrderableItem,
  OrderBundle,
  PlacedOrder,
  OrderAlert,
  PatientAllergy,
  OrderCategory,
} from '@/types/osce-enhanced';

interface OrderPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderPlace: (orders: PlacedOrder[]) => void;
  placedOrders: PlacedOrder[];
  patientAllergies?: PatientAllergy[];
  chiefComplaint?: string;
}

interface OrderableItemWithMeta extends OrderableItem {
  isHighYield?: boolean;
  panceYield?: number | null;
  indications?: string[];
}

const CATEGORY_ICONS: Record<OrderCategory, React.ReactNode> = {
  labs: <FlaskConical className="w-4 h-4" />,
  imaging: <Scan className="w-4 h-4" />,
  procedures: <Syringe className="w-4 h-4" />,
  medications: <Pill className="w-4 h-4" />,
};

const CATEGORY_LABELS: Record<OrderCategory, string> = {
  labs: 'Labs',
  imaging: 'Imaging',
  procedures: 'Procedures',
  medications: 'Medications',
};

const COST_COLORS: Record<string, string> = {
  $: 'text-green-600 dark:text-green-400',
  $$: 'text-yellow-600 dark:text-yellow-400',
  $$$: 'text-orange-600 dark:text-orange-400',
  $$$$: 'text-red-600 dark:text-red-400',
};

export const OrderPanel: React.FC<OrderPanelProps> = ({
  isOpen,
  onClose,
  onOrderPlace,
  placedOrders,
  patientAllergies = [],
  chiefComplaint = '',
}) => {
  const [activeTab, setActiveTab] = useState<OrderCategory>('labs');
  const [searchQuery, setSearchQuery] = useState('');
  const [orderableItems, setOrderableItems] = useState<OrderableItemWithMeta[]>([]);
  const [bundles, setBundles] = useState<OrderBundle[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [showBundles, setShowBundles] = useState(true);
  const [alerts, setAlerts] = useState<OrderAlert[]>([]);

  // Fetch orderable items from API
  useEffect(() => {
    if (!isOpen) return;

    const fetchItems = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/osce/orderable-items?category=${activeTab}&search=${searchQuery}`
        );
        if (response.ok) {
          const data = await response.json();
          setOrderableItems(data.items || []);
          setBundles(data.bundles || []);
        }
      } catch (error) {
        console.error('Failed to fetch orderable items:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchItems, 300);
    return () => clearTimeout(debounceTimer);
  }, [isOpen, activeTab, searchQuery]);

  // Filter bundles by chief complaint
  const relevantBundles = useMemo(() => {
    if (!chiefComplaint) return bundles;
    const lowerCC = chiefComplaint.toLowerCase();
    return bundles.filter((bundle) =>
      bundle.relatedChiefComplaints.some(
        (cc) => lowerCC.includes(cc.toLowerCase()) || cc.toLowerCase().includes(lowerCC)
      )
    );
  }, [bundles, chiefComplaint]);

  // Check for clinical decision support alerts
  const checkAlerts = useCallback(
    (itemId: string, itemName: string, contraindications: string[] = []): OrderAlert[] => {
      const newAlerts: OrderAlert[] = [];

      // Check for duplicate orders
      if (placedOrders.some((order) => order.itemId === itemId && order.status !== 'cancelled')) {
        newAlerts.push({
          type: 'duplicate',
          severity: 'warning',
          message: `${itemName} has already been ordered`,
          recommendation: 'Consider if repeat order is necessary',
        });
      }

      // Check for allergy alerts
      for (const allergy of patientAllergies) {
        const allergenLower = allergy.allergen.toLowerCase();
        const itemNameLower = itemName.toLowerCase();

        // Check direct matches
        if (itemNameLower.includes(allergenLower) || allergenLower.includes(itemNameLower)) {
          newAlerts.push({
            type: 'allergy',
            severity: allergy.severity === 'severe' ? 'critical' : 'warning',
            message: `Patient allergic to ${allergy.allergen} (${allergy.reaction})`,
            recommendation: 'Consider alternative or verify with patient',
          });
        }

        // Check contrast allergy for imaging
        if (
          allergy.allergen.toLowerCase().includes('contrast') ||
          allergy.allergen.toLowerCase().includes('iodine')
        ) {
          if (itemNameLower.includes('ct') || itemNameLower.includes('contrast')) {
            newAlerts.push({
              type: 'allergy',
              severity: 'critical',
              message: `Contrast allergy: ${allergy.reaction}`,
              recommendation: 'Use non-contrast study or pre-medicate',
            });
          }
        }
      }

      // Check contraindications
      for (const contra of contraindications) {
        if (chiefComplaint.toLowerCase().includes(contra.toLowerCase())) {
          newAlerts.push({
            type: 'contraindication',
            severity: 'warning',
            message: `Potential contraindication: ${contra}`,
          });
        }
      }

      return newAlerts;
    },
    [placedOrders, patientAllergies, chiefComplaint]
  );

  // Toggle item selection
  const toggleItemSelection = (item: OrderableItemWithMeta) => {
    const itemAlerts = checkAlerts(item.id, item.name, item.contraindications);
    setAlerts(itemAlerts);

    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(item.id)) {
        newSet.delete(item.id);
      } else {
        newSet.add(item.id);
      }
      return newSet;
    });
  };

  // Select bundle items
  const selectBundle = (bundle: OrderBundle) => {
    const bundleItemIds = new Set(bundle.items);
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      bundleItemIds.forEach((id) => newSet.add(id));
      return newSet;
    });
    setShowBundles(false);
  };

  // Place selected orders
  const handlePlaceOrders = () => {
    const newOrders: PlacedOrder[] = [];

    for (const itemId of selectedItems) {
      const item = orderableItems.find((i) => i.id === itemId);
      if (item) {
        newOrders.push({
          id: `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          itemId: item.id,
          itemName: item.name,
          category: item.category,
          orderedAt: Date.now(),
          status: 'pending',
          isStat: false,
          alerts: checkAlerts(item.id, item.name, item.contraindications),
        });
      }
    }

    onOrderPlace(newOrders);
    setSelectedItems(new Set());
    onClose();
  };

  // Format turnaround time
  const formatTurnaround = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    if (minutes < 1440) return `${Math.round(minutes / 60)} hr`;
    return `${Math.round(minutes / 1440)} days`;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-[var(--color-bg-primary)] rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border border-[var(--color-border)]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between bg-[var(--color-bg-secondary)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center">
                <Package className="w-5 h-5 text-[var(--color-accent)]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Order Entry</h2>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors"
            >
              <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            {(Object.keys(CATEGORY_LABELS) as OrderCategory[]).map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveTab(cat)}
                className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 text-sm font-medium transition-colors relative
                  ${
                    activeTab === cat
                      ? 'text-[var(--color-accent)] bg-[var(--color-bg-primary)]'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
                  }`}
              >
                {CATEGORY_ICONS[cat]}
                <span className="hidden sm:inline">{CATEGORY_LABELS[cat]}</span>
                {activeTab === cat && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-accent)]"
                  />
                )}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="p-4 border-b border-[var(--color-border)]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${CATEGORY_LABELS[activeTab].toLowerCase()}...`}
                className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg
                         text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)]
                         focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
              />
            </div>
          </div>

          {/* Alerts Banner */}
          {alerts.length > 0 && (
            <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
              {alerts.map((alert, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-2 text-sm ${
                    alert.severity === 'critical'
                      ? 'text-red-700 dark:text-red-300'
                      : 'text-amber-700 dark:text-amber-300'
                  }`}
                >
                  {alert.severity === 'critical' ? (
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-medium">{alert.message}</span>
                    {alert.recommendation && (
                      <span className="ml-1 opacity-75">— {alert.recommendation}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Bundles Section */}
            {showBundles && relevantBundles.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    Quick Order Sets
                  </h3>
                  <button
                    onClick={() => setShowBundles(false)}
                    className="text-xs text-[var(--color-text-muted)] hover:underline"
                  >
                    Hide
                  </button>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {relevantBundles.slice(0, 6).map((bundle) => (
                    <button
                      key={bundle.id}
                      onClick={() => selectBundle(bundle)}
                      className="p-3 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20
                               border border-amber-200 dark:border-amber-800 rounded-lg text-left
                               hover:shadow-md transition-all group"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{bundle.icon}</span>
                        <span className="font-semibold text-[var(--color-text-primary)] text-sm">
                          {bundle.name}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--color-text-secondary)] line-clamp-1">
                        {bundle.description}
                      </p>
                      <div className="mt-2 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                        <span>{bundle.items.length} items</span>
                        <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Items List */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-[var(--color-accent)]/30 border-t-[var(--color-accent)] rounded-full animate-spin" />
              </div>
            ) : orderableItems.length === 0 ? (
              <div className="text-center py-12 text-[var(--color-text-muted)]">
                <FlaskConical className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No {CATEGORY_LABELS[activeTab].toLowerCase()} found</p>
                {searchQuery && <p className="text-sm mt-1">Try a different search term</p>}
              </div>
            ) : (
              <div className="space-y-1">
                {orderableItems.map((item) => {
                  const isSelected = selectedItems.has(item.id);
                  const isAlreadyOrdered = placedOrders.some(
                    (o) => o.itemId === item.id && o.status !== 'cancelled'
                  );

                  return (
                    <button
                      key={item.id}
                      onClick={() => toggleItemSelection(item)}
                      className={`w-full p-3 rounded-lg border transition-all text-left flex items-center gap-3
                        ${
                          isSelected
                            ? 'bg-[var(--color-accent)]/10 border-[var(--color-accent)] shadow-sm'
                            : isAlreadyOrdered
                              ? 'bg-[var(--color-bg-tertiary)] border-[var(--color-border)] opacity-60'
                              : 'bg-[var(--color-bg-secondary)] border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:shadow-sm'
                        }`}
                    >
                      {/* Selection indicator */}
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
                        ${
                          isSelected
                            ? 'bg-[var(--color-accent)] border-[var(--color-accent)]'
                            : 'border-[var(--color-border)]'
                        }`}
                      >
                        {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                      </div>

                      {/* Item info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[var(--color-text-primary)] truncate">
                            {item.name}
                          </span>
                          {item.isHighYield && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded">
                              HY
                            </span>
                          )}
                          {isAlreadyOrdered && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                              ORDERED
                            </span>
                          )}
                        </div>
                        {item.subcategory && (
                          <p className="text-xs text-[var(--color-text-muted)] truncate">
                            {item.subcategory}
                          </p>
                        )}
                      </div>

                      {/* Metadata */}
                      <div className="flex items-center gap-3 text-xs flex-shrink-0">
                        <div className="flex items-center gap-1 text-[var(--color-text-muted)]">
                          <Clock className="w-3 h-3" />
                          <span>{formatTurnaround(item.turnaroundMinutes)}</span>
                        </div>
                        <span
                          className={`font-bold ${COST_COLORS[item.costTier] || 'text-[var(--color-text-muted)]'}`}
                        >
                          {item.costTier}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex items-center justify-between">
            <div className="text-sm text-[var(--color-text-secondary)]">
              {selectedItems.size > 0 && (
                <span>
                  {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedItems(new Set())}
                disabled={selectedItems.size === 0}
                className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]
                         disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                Clear
              </button>
              <button
                onClick={handlePlaceOrders}
                disabled={selectedItems.size === 0}
                className="px-6 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white
                         font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center gap-2 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Place Orders
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default OrderPanel;
