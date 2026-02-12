/**
 * Animation Demo Component
 * Shows examples of all available animation patterns and utilities
 * Can be used for reference and testing
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ANIMATION_VARIANTS, 
  TRANSITIONS, 
  CSS_TRANSITIONS,
  createAnimationProps,
  createHoverAnimation,
  getStaggerChildren,
  ANIMATION_DURATIONS,
  EASING,
  PAGE_TRANSITION,
  MODAL_TRANSITION,
  TOAST_TRANSITION,
  LIST_ITEM_TRANSITION,
} from '@/lib/utils/animations';
import { StandardButton } from './StandardButton';
import { ChevronDown, ChevronUp, Play, Square, RefreshCw } from 'lucide-react';

interface AnimationDemoProps {
  className?: string;
}

export const AnimationDemo: React.FC<AnimationDemoProps> = ({ className = '' }) => {
  const [activeTab, setActiveTab] = useState<'variants' | 'transitions' | 'examples' | 'utilities'>('variants');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isToastVisible, setIsToastVisible] = useState(false);
  const [showList, setShowList] = useState(true);
  const [triggerKey, setTriggerKey] = useState(0);

  const tabs = [
    { id: 'variants', label: 'Animation Variants' },
    { id: 'transitions', label: 'Transitions' },
    { id: 'examples', label: 'Live Examples' },
    { id: 'utilities', label: 'Utilities' },
  ];

  const listItems = [
    'Cardiovascular System',
    'Pulmonary System',
    'Gastrointestinal System',
    'Musculoskeletal System',
    'Neurological System',
    'Renal System',
  ];

  const triggerAnimation = () => {
    setTriggerKey(prev => prev + 1);
  };

  const showToast = () => {
    setIsToastVisible(true);
    setTimeout(() => setIsToastVisible(false), 3000);
  };

  return (
    <div className={`bg-[var(--color-bg-secondary)] rounded-2xl border border-[var(--color-border)] p-6 ${className}`}>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Animation System</h2>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              Standardized animations for consistent, smooth transitions
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <StandardButton
              variant="outline"
              size="sm"
              onClick={triggerAnimation}
              icon={<RefreshCw className="w-4 h-4" />}
            >
              Trigger All
            </StandardButton>
            <StandardButton
              variant="primary"
              size="sm"
              onClick={showToast}
              icon={<Play className="w-4 h-4" />}
            >
              Show Toast
            </StandardButton>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-[var(--color-border)] pb-4" role="tablist" aria-label="Animation demo tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                  : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]/80'
              }`}
              role="tab"
              aria-selected={activeTab === tab.id ? 'true' : 'false'}
              aria-controls={`${tab.id}-panel`}
              id={`${tab.id}-tab`}
              title={`Switch to ${tab.label} tab`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="min-h-[400px]">
          <AnimatePresence mode="wait">
            {activeTab === 'variants' && (
              <motion.div
                key="variants"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={TRANSITIONS.normal}
                className="space-y-6"
              >
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Animation Variants</h3>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Predefined animation variants for common patterns
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(ANIMATION_VARIANTS).map(([key, variant]) => (
                    <motion.div
                      key={key}
                      {...variant}
                      transition={TRANSITIONS.normal}
                      className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl p-4 cursor-pointer hover:border-[var(--color-accent)] transition-colors"
                      onClick={triggerAnimation}
                      role="button"
                      tabIndex={0}
                      aria-label={`Trigger ${key.replace(/([A-Z])/g, ' $1').trim()} animation`}
                      onKeyDown={(e) => e.key === 'Enter' && triggerAnimation()}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-[var(--color-text-primary)] capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                        <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)] font-mono mt-2">
                        {JSON.stringify(variant.initial, null, 2)}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'transitions' && (
              <motion.div
                key="transitions"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={TRANSITIONS.normal}
                className="space-y-6"
              >
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Transition Presets</h3>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Standardized timing and easing functions
                </p>
                
                <div className="space-y-4">
                  {Object.entries(TRANSITIONS).map(([key, transition]) => (
                    <motion.div
                      key={key}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Object.keys(TRANSITIONS).indexOf(key) * 0.1 }}
                      className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium text-[var(--color-text-primary)] capitalize">
                          {key} Transition
                        </span>
                        <div className="text-xs px-2 py-1 bg-[var(--color-bg-tertiary)] rounded">
                          {transition.type || 'tween'}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[var(--color-text-muted)]">Duration:</span>
                          <span className="font-mono">
                            {transition.duration ? `${transition.duration}s` : 'spring'}
                          </span>
                        </div>
                        
                        {transition.ease && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-[var(--color-text-muted)]">Easing:</span>
                            <span className="font-mono">{transition.ease}</span>
                          </div>
                        )}
                        
                        {transition.type === 'spring' && (
                          <>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-[var(--color-text-muted)]">Stiffness:</span>
                              <span className="font-mono">{transition.stiffness}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-[var(--color-text-muted)]">Damping:</span>
                              <span className="font-mono">{transition.damping}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'examples' && (
              <motion.div
                key="examples"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={TRANSITIONS.spring}
                className="space-y-8"
              >
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Live Examples</h3>
                
                {/* Page Transition Example */}
                <div className="space-y-4">
                  <h4 className="font-medium text-[var(--color-text-primary)]">Page Transition</h4>
                  <motion.div
                    key={`page-${triggerKey}`}
                    {...PAGE_TRANSITION}
                    className="bg-gradient-to-r from-[var(--color-accent)]/10 to-[var(--color-accent)]/5 border border-[var(--color-accent)]/20 rounded-xl p-6"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="h-4 w-32 bg-[var(--color-accent)]/30 rounded mb-2"></div>
                        <div className="h-3 w-48 bg-[var(--color-bg-tertiary)] rounded"></div>
                      </div>
                      <StandardButton
                        variant="outline"
                        size="sm"
                        onClick={triggerAnimation}
                      >
                        Replay
                      </StandardButton>
                    </div>
                  </motion.div>
                </div>

                {/* List with Staggered Items */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-[var(--color-text-primary)]">Staggered List</h4>
                    <StandardButton
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowList(!showList)}
                      icon={showList ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    >
                      {showList ? 'Hide' : 'Show'} List
                    </StandardButton>
                  </div>
                  
                  <AnimatePresence>
                    {showList && (
                      <motion.div
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        variants={getStaggerChildren(0.1)}
                        className="space-y-2"
                      >
                        {listItems.map((item, index) => (
                          <motion.div
                            key={item}
                            variants={LIST_ITEM_TRANSITION}
                            className="flex items-center justify-between p-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg hover:border-[var(--color-accent)] transition-colors"
                            {...createHoverAnimation(1.01, -1)}
                          >
                            <span className="text-[var(--color-text-primary)]">{item}</span>
                            <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)] px-2 py-1 rounded">
                              Item {index + 1}
                            </span>
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Interactive Cards with Hover */}
                <div className="space-y-4">
                  <h4 className="font-medium text-[var(--color-text-primary)]">Interactive Cards</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {['Primary', 'Secondary', 'Accent'].map((type, index) => (
                      <motion.div
                        key={type}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        {...createHoverAnimation(1.03, -3)}
                        className={`p-5 rounded-xl border-2 ${
                          type === 'Primary'
                            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
                            : type === 'Secondary'
                            ? 'border-[var(--color-border)] bg-[var(--color-bg-primary)]'
                            : 'border-[var(--color-data-pass)] bg-[var(--color-data-pass)]/5'
                        } cursor-pointer`}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            type === 'Primary'
                              ? 'bg-[var(--color-accent)] text-white'
                              : type === 'Secondary'
                              ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]'
                              : 'bg-[var(--color-data-pass)] text-white'
                          }`}>
                            {type.charAt(0)}
                          </div>
                          <span className="font-semibold text-[var(--color-text-primary)]">{type} Card</span>
                        </div>
                        <p className="text-sm text-[var(--color-text-muted)]">
                          Hover over this card to see the animation. Click to trigger.
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Modal Trigger */}
                <div className="space-y-4">
                  <h4 className="font-medium text-[var(--color-text-primary)]">Modal Animation</h4>
                  <div className="flex items-center gap-4">
                    <StandardButton
                      variant="primary"
                      onClick={() => setIsModalOpen(true)}
                    >
                      Open Modal
                    </StandardButton>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      Click to see modal entrance/exit animation
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'utilities' && (
              <motion.div
                key="utilities"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={TRANSITIONS.normal}
                className="space-y-6"
              >
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">CSS Transition Utilities</h3>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Tailwind classes for consistent CSS transitions
                </p>
                
                <div className="space-y-4">
                  {Object.entries(CSS_TRANSITIONS).map(([key, value]) => (
                    <div
                      key={key}
                      className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <span className="font-medium text-[var(--color-text-primary)] capitalize">
                            {key}
                          </span>
                          <div className="text-xs text-[var(--color-text-muted)] mt-1">
                            Class: <code className="bg-[var(--color-bg-tertiary)] px-2 py-1 rounded">{value}</code>
                          </div>
                        </div>
                        <div className={`w-20 h-10 rounded-lg bg-[var(--color-accent)] ${value} hover:bg-[var(--color-accent-hover)] cursor-pointer`}></div>
                      </div>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        Use for: {key === 'colors' ? 'color changes, hover states' : 
                                 key === 'transforms' ? 'scale, translate, rotate' :
                                 key === 'opacity' ? 'fade in/out effects' :
                                 key === 'all' ? 'any property changes' :
                                 key === 'fast' ? 'quick feedback' : 'smooth, dramatic effects'}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Timing Constants */}
                <div className="space-y-4">
                  <h4 className="font-medium text-[var(--color-text-primary)]">Timing Constants</h4>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {Object.entries(ANIMATION_DURATIONS).map(([key, value]) => (
                      <div
                        key={key}
                        className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg p-3 text-center"
                      >
                        <div className="text-lg font-bold text-[var(--color-accent)]">{value}s</div>
                        <div className="text-xs text-[var(--color-text-muted)] capitalize mt-1">{key.replace(/([A-Z])/g, ' $1')}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Easing Functions */}
                <div className="space-y-4">
                  <h4 className="font-medium text-[var(--color-text-primary)]">Easing Functions</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Object.entries(EASING).map(([key, value]) => (
                      <div
                        key={key}
                        className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-[var(--color-text-primary)] capitalize">{key}</span>
                          <div className="w-16 h-1 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-[var(--color-accent)] rounded-full"
                              style={{
                                animation: `easeDemo 2s ${value} infinite`,
                              }}
                            ></div>
                          </div>
                        </div>
                        <code className="text-xs text-[var(--color-text-muted)] font-mono break-all">{value}</code>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Modal Example */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--color-overlay)]">
            <motion.div
              {...MODAL_TRANSITION}
              className="bg-[var(--color-bg-primary)] rounded-2xl border border-[var(--color-border)] shadow-xl max-w-md w-full p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Modal Example</h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors"
                  title="Close modal"
                  aria-label="Close modal"
                >
                  <Square className="w-5 h-5 text-[var(--color-text-muted)]" />
                </button>
              </div>
              
              <p className="text-[var(--color-text-secondary)] mb-6">
                This modal demonstrates the standard modal transition with spring physics.
                Notice the smooth scale and fade animation.
              </p>
              
              <div className="flex gap-3">
                <StandardButton
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </StandardButton>
                <StandardButton
                  variant="primary"
                  className="flex-1"
                  onClick={() => setIsModalOpen(false)}
                >
                  Confirm
                </StandardButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Example */}
      <AnimatePresence>
        {isToastVisible && (
          <motion.div
            {...TOAST_TRANSITION}
            className="fixed top-4 right-4 z-50 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl shadow-lg p-4 max-w-sm"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[var(--color-data-pass)]/20 flex items-center justify-center flex-shrink-0">
                <div className="w-4 h-4 bg-[var(--color-data-pass)] rounded-full"></div>
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-[var(--color-text-primary)]">Toast Notification</h4>
                <p className="text-sm text-[var(--color-text-muted)] mt-1">
                  This toast uses a bouncy entrance animation for attention.
                </p>
              </div>
              <button
                onClick={() => setIsToastVisible(false)}
                className="p-1 hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors flex-shrink-0"
                title="Close toast"
                aria-label="Close toast notification"
              >
                <Square className="w-4 h-4 text-[var(--color-text-muted)]" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx>{`
        @keyframes easeDemo {
          0%, 100% { width: 0%; }
          50% { width: 100%; }
        }
      `}</style>
    </div>
  );
};