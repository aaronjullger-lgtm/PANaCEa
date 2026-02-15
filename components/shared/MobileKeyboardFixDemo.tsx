/**
 * MobileKeyboardFixDemo Component
 *
 * Demonstrates and tests mobile keyboard interaction fixes.
 * Provides a testing interface for developers to verify mobile keyboard behavior.
 */

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Keyboard,
  Smartphone,
  CheckCircle,
  AlertCircle,
  Type,
  Mail,
  Phone,
  Hash,
  Search,
  Zap,
} from 'lucide-react';
import { StandardButton, PrimaryButton, SecondaryButton } from './StandardButton';
import {
  useMobileKeyboardFix,
  useKeyboardDismissal,
  useMobileFormSubmission,
} from '@/hooks/useMobileKeyboardFix';

export interface MobileKeyboardFixDemoProps {
  /** Whether the demo is initially open */
  defaultOpen?: boolean;
  /** Callback when demo is closed */
  onClose?: () => void;
}

export const MobileKeyboardFixDemo: React.FC<MobileKeyboardFixDemoProps> = ({
  defaultOpen = false,
  onClose,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [activeTab, setActiveTab] = useState<'test' | 'fixes' | 'guidelines'>('test');
  const [testResults, setTestResults] = useState<
    Array<{ test: string; passed: boolean; message: string }>
  >([]);
  const [isTesting, setIsTesting] = useState(false);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const numberInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Use the mobile keyboard fix hooks
  const {
    scrollInputIntoView,
    fixInputType,
    addMobileAttributes,
    isKeyboardVisible,
    viewportHeight,
    applyGlobalFixes,
  } = useMobileKeyboardFix({
    autoScroll: true,
    fixInputTypes: true,
    optimizeForms: true,
    touchFriendly: true,
    debug: true,
  });

  useKeyboardDismissal();
  useMobileFormSubmission();

  const runTests = () => {
    setIsTesting(true);
    const results: Array<{ test: string; passed: boolean; message: string }> = [];

    // Test 1: Check if inputs have proper types
    const inputs = [
      { ref: emailInputRef, expectedType: 'email', name: 'Email Input' },
      { ref: phoneInputRef, expectedType: 'tel', name: 'Phone Input' },
      { ref: numberInputRef, expectedType: 'number', name: 'Number Input' },
      { ref: searchInputRef, expectedType: 'search', name: 'Search Input' },
    ];

    inputs.forEach(({ ref, expectedType, name }) => {
      if (ref.current) {
        const actualType = ref.current.type;
        const passed = actualType === expectedType;
        results.push({
          test: `${name} Type`,
          passed,
          message: passed
            ? `Correct type: ${expectedType}`
            : `Incorrect type: ${actualType} (expected: ${expectedType})`,
        });
      }
    });

    // Test 2: Check touch target sizes
    const testElements = [
      { ref: emailInputRef, name: 'Email Input' },
      { ref: phoneInputRef, name: 'Phone Input' },
    ];

    testElements.forEach(({ ref, name }) => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect();
        const minHeight = 44;
        const passed = rect.height >= minHeight;
        results.push({
          test: `${name} Touch Target`,
          passed,
          message: passed
            ? `Height: ${Math.round(rect.height)}px (≥ ${minHeight}px)`
            : `Height: ${Math.round(rect.height)}px (< ${minHeight}px minimum)`,
        });
      }
    });

    // Test 3: Check for mobile attributes
    if (emailInputRef.current) {
      const hasAutocomplete = emailInputRef.current.hasAttribute('autocomplete');
      const hasInputMode = emailInputRef.current.hasAttribute('inputmode');
      results.push({
        test: 'Mobile Attributes',
        passed: hasAutocomplete || hasInputMode,
        message:
          hasAutocomplete || hasInputMode
            ? 'Has mobile optimization attributes'
            : 'Missing mobile optimization attributes',
      });
    }

    // Test 4: Check keyboard visibility detection
    results.push({
      test: 'Keyboard Detection',
      passed: typeof isKeyboardVisible === 'boolean',
      message: isKeyboardVisible ? 'Keyboard detected as visible' : 'Keyboard not visible',
    });

    setTestResults(results);
    setIsTesting(false);
  };

  const applyFixes = () => {
    // Apply fixes to demo inputs
    if (emailInputRef.current) fixInputType(emailInputRef.current);
    if (phoneInputRef.current) fixInputType(phoneInputRef.current);
    if (numberInputRef.current) fixInputType(numberInputRef.current);
    if (searchInputRef.current) fixInputType(searchInputRef.current);

    // Add mobile attributes
    [emailInputRef, phoneInputRef, numberInputRef, textInputRef, searchInputRef].forEach((ref) => {
      if (ref.current) addMobileAttributes(ref.current);
    });

    // Apply global fixes
    applyGlobalFixes();

    // Run tests to verify fixes
    setTimeout(runTests, 100);
  };

  const testInputTypes = [
    {
      ref: emailInputRef,
      icon: Mail,
      label: 'Email',
      placeholder: 'test@example.com',
      type: 'email',
    },
    { ref: phoneInputRef, icon: Phone, label: 'Phone', placeholder: '(123) 456-7890', type: 'tel' },
    { ref: numberInputRef, icon: Hash, label: 'Number', placeholder: '42', type: 'number' },
    { ref: textInputRef, icon: Type, label: 'Text', placeholder: 'Enter your name', type: 'text' },
    {
      ref: searchInputRef,
      icon: Search,
      label: 'Search',
      placeholder: 'Search medical terms...',
      type: 'search',
    },
  ];

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <PrimaryButton
          leftIcon={<Keyboard className="w-4 h-4" />}
          onClick={() => setIsOpen(true)}
          size="lg"
          className="shadow-lg"
        >
          Test Mobile Keyboard
        </PrimaryButton>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-[var(--color-overlay)] backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => {
        setIsOpen(false);
        onClose?.();
      }}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="bg-[var(--color-bg-primary)] rounded-2xl border border-[var(--color-border)] shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[var(--color-accent)]/10">
              <Keyboard className="w-6 h-6 text-[var(--color-accent)]" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
                Mobile Keyboard Fix Demo
              </h2>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                Viewport: {typeof window !== 'undefined' ? window.innerWidth : 0}×{viewportHeight}px
                • Keyboard: {isKeyboardVisible ? 'Visible' : 'Hidden'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setIsOpen(false);
              onClose?.();
            }}
            className="p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--color-border)]">
          {['test', 'fixes', 'guidelines'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === tab ? 'text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {activeTab === 'test' && (
              <motion.div
                key="test"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-[var(--color-text-primary)]">
                      Test Mobile Keyboard Interactions
                    </h3>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      Tap on inputs to test keyboard behavior and auto-scrolling
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <SecondaryButton leftIcon={<Zap className="w-4 h-4" />} onClick={applyFixes}>
                      Apply Fixes
                    </SecondaryButton>
                    <PrimaryButton
                      leftIcon={<Smartphone className="w-4 h-4" />}
                      onClick={runTests}
                      loading={isTesting}
                    >
                      Run Tests
                    </PrimaryButton>
                  </div>
                </div>

                {/* Test Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {testInputTypes.map(({ ref, icon: Icon, label, placeholder, type }) => (
                    <div key={label} className="space-y-2">
                      <label className="text-sm font-medium text-[var(--color-text-secondary)] flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        {label}
                      </label>
                      <input
                        ref={ref}
                        type={type}
                        placeholder={placeholder}
                        className="w-full px-4 py-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                        onFocus={(e) => {
                          if (ref.current) {
                            scrollInputIntoView(ref.current);
                          }
                        }}
                      />
                      <div className="text-xs text-[var(--color-text-muted)]">
                        Type:{' '}
                        <code className="px-1 py-0.5 rounded bg-[var(--color-bg-secondary)]">
                          {type}
                        </code>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Test Form */}
                <div className="mt-8 p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                  <h4 className="text-lg font-medium text-[var(--color-text-primary)] mb-4">
                    Test Mobile Form Submission
                  </h4>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      alert('Form submitted! (Mobile-optimized)');
                    }}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                          First Name
                        </label>
                        <input
                          type="text"
                          placeholder="John"
                          className="w-full px-4 py-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                          Last Name
                        </label>
                        <input
                          type="text"
                          placeholder="Doe"
                          className="w-full px-4 py-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                        Medical Specialty
                      </label>
                      <select
                        className="w-full px-4 py-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                        title="Select medical specialty"
                      >
                        <option value="">Select a specialty</option>
                        <option value="cardiology">Cardiology</option>
                        <option value="pulmonology">Pulmonology</option>
                        <option value="neurology">Neurology</option>
                        <option value="orthopedics">Orthopedics</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-3 pt-4">
                      <PrimaryButton type="submit">Submit Form</PrimaryButton>
                      <SecondaryButton type="button">Clear</SecondaryButton>
                    </div>
                  </form>
                </div>

                {/* Test Results */}
                {testResults.length > 0 && (
                  <div className="mt-8">
                    <h4 className="text-lg font-medium text-[var(--color-text-primary)] mb-4">
                      Test Results
                    </h4>
                    <div className="space-y-3">
                      {testResults.map((result, index) => (
                        <div
                          key={index}
                          className={`p-4 rounded-lg border ${result.passed ? 'border-[var(--color-success)]/20 bg-[var(--color-success)]/5' : 'border-[var(--color-error)]/20 bg-[var(--color-error)]/5'}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {result.passed ? (
                                <CheckCircle className="w-5 h-5 text-[var(--color-success)]" />
                              ) : (
                                <AlertCircle className="w-5 h-5 text-[var(--color-error)]" />
                              )}
                              <span
                                className={`font-medium ${result.passed ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}
                              >
                                {result.test}
                              </span>
                            </div>
                            <span className="text-sm text-[var(--color-text-secondary)]">
                              {result.message}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 p-4 rounded-lg bg-[var(--color-bg-secondary)]">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-[var(--color-text-primary)]">
                          Summary
                        </span>
                        <span
                          className={`text-lg font-semibold ${testResults.every((r) => r.passed) ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}
                        >
                          {testResults.filter((r) => r.passed).length} / {testResults.length} tests
                          passed
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'fixes' && (
              <motion.div
                key="fixes"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-4">
                    Mobile Keyboard Fixes Applied
                  </h3>
                  <p className="text-sm text-[var(--color-text-muted)] mb-6">
                    These fixes are automatically applied when using the useMobileKeyboardFix hook
                  </p>
                </div>

                <div className="space-y-4">
                  {[
                    {
                      title: 'Auto-Scroll Inputs',
                      description: 'Automatically scrolls inputs into view when keyboard appears',
                      code: 'useMobileKeyboardFix({ autoScroll: true })',
                      status: 'Active',
                    },
                    {
                      title: 'Input Type Correction',
                      description: 'Fixes input types based on field names (email → type="email")',
                      code: 'useMobileKeyboardFix({ fixInputTypes: true })',
                      status: 'Active',
                    },
                    {
                      title: 'Touch-Friendly Attributes',
                      description: 'Adds min-height: 44px and touch-action: manipulation',
                      code: 'useMobileKeyboardFix({ touchFriendly: true })',
                      status: 'Active',
                    },
                    {
                      title: 'Keyboard Dismissal',
                      description: 'Dismisses keyboard when tapping outside inputs',
                      code: 'useKeyboardDismissal()',
                      status: 'Active',
                    },
                    {
                      title: 'Mobile Form Submission',
                      description: 'Optimizes form submission behavior for mobile',
                      code: 'useMobileFormSubmission()',
                      status: 'Active',
                    },
                  ].map((fix, index) => (
                    <div
                      key={index}
                      className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-medium text-[var(--color-text-primary)]">
                            {fix.title}
                          </h4>
                          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                            {fix.description}
                          </p>
                        </div>
                        <span className="px-3 py-1 text-xs font-medium rounded-full bg-[var(--color-success)]/10 text-[var(--color-success)]">
                          {fix.status}
                        </span>
                      </div>
                      <code className="block mt-3 px-3 py-2 text-sm rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-secondary)] font-mono">
                        {fix.code}
                      </code>
                    </div>
                  ))}
                </div>

                <div className="mt-8 p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-accent)]/5">
                  <h4 className="text-lg font-medium text-[var(--color-text-primary)] mb-3">
                    Quick Fix Application
                  </h4>
                  <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                    Apply all mobile keyboard fixes to the current page:
                  </p>
                  <div className="flex items-center gap-3">
                    <PrimaryButton
                      leftIcon={<Zap className="w-4 h-4" />}
                      onClick={applyGlobalFixes}
                    >
                      Apply All Fixes Now
                    </PrimaryButton>
                    <SecondaryButton
                      onClick={() => {
                        const inputs = document.querySelectorAll('input');
                        inputs.forEach((input) => {
                          if (input instanceof HTMLInputElement) {
                            fixInputType(input);
                            addMobileAttributes(input);
                          }
                        });
                      }}
                    >
                      Fix Input Types Only
                    </SecondaryButton>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'guidelines' && (
              <motion.div
                key="guidelines"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-4">
                    Mobile Keyboard Guidelines
                  </h3>
                  <p className="text-sm text-[var(--color-text-muted)] mb-6">
                    Best practices for mobile keyboard interactions in medical applications
                  </p>
                </div>

                <div className="space-y-6">
                  {[
                    {
                      title: 'Input Type Selection',
                      items: [
                        'Use type="email" for email fields (triggers email keyboard)',
                        'Use type="tel" for phone numbers (triggers numeric keyboard)',
                        'Use type="number" or inputmode="numeric" for numbers',
                        'Use type="search" for search fields',
                        'Add autocomplete attributes for form autofill',
                      ],
                    },
                    {
                      title: 'Touch Target Size',
                      items: [
                        'Minimum 44×44px touch targets (WCAG guideline)',
                        'Add sufficient padding around interactive elements',
                        'Use min-height: 44px for buttons and inputs',
                        'Ensure adequate spacing between touch targets',
                      ],
                    },
                    {
                      title: 'Keyboard Management',
                      items: [
                        'Scroll inputs into view when keyboard appears',
                        'Provide clear way to dismiss keyboard',
                        'Handle form submission appropriately (avoid accidental submits)',
                        'Consider using visualViewport API for accurate keyboard detection',
                      ],
                    },
                    {
                      title: 'Form Optimization',
                      items: [
                        'Use appropriate input types for medical data (e.g., numeric for lab values)',
                        'Add labels and placeholders for clarity',
                        'Group related fields logically',
                        'Provide clear error messages and validation',
                      ],
                    },
                    {
                      title: 'Performance Considerations',
                      items: [
                        'Avoid layout shifts when keyboard appears',
                        'Minimize reflows during input',
                        'Use debouncing for search inputs',
                        'Consider virtualized lists for long forms',
                      ],
                    },
                  ].map((section, index) => (
                    <div
                      key={index}
                      className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
                    >
                      <h4 className="font-medium text-[var(--color-text-primary)] mb-3">
                        {section.title}
                      </h4>
                      <ul className="space-y-2">
                        {section.items.map((item, itemIndex) => (
                          <li
                            key={itemIndex}
                            className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]"
                          >
                            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] flex-shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                <div className="mt-8 p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                  <h4 className="text-lg font-medium text-[var(--color-text-primary)] mb-3">
                    Implementation Example
                  </h4>
                  <pre className="text-sm bg-[var(--color-bg-primary)] p-4 rounded-lg border border-[var(--color-border)] overflow-x-auto">
                    {`// In your component:
import { useMobileKeyboardFix } from '@/hooks/useMobileKeyboardFix';

function MedicalForm() {
  const { scrollInputIntoView, fixInputType } = useMobileKeyboardFix({
    autoScroll: true,
    fixInputTypes: true,
    debug: false
  });

  return (
    <form>
      <input
        type="text"
        name="patient_email"
        placeholder="Patient email"
        onFocus={(e) => scrollInputIntoView(e.target)}
      />
      {/* ... */}
    </form>
  );
}`}
                  </pre>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <div className="flex items-center justify-between">
            <div className="text-sm text-[var(--color-text-muted)]">
              Viewport: {viewportHeight}px • Keyboard: {isKeyboardVisible ? 'Visible' : 'Hidden'}
            </div>
            <div className="flex items-center gap-3">
              <SecondaryButton size="sm" onClick={() => setIsOpen(false)}>
                Close
              </SecondaryButton>
              <PrimaryButton size="sm" onClick={applyGlobalFixes}>
                Apply & Test
              </PrimaryButton>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
