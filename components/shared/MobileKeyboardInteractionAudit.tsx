/**
 * Mobile Keyboard Interaction Audit Component
 * 
 * Identifies and helps fix mobile keyboard interaction issues:
 * - Virtual keyboard covering input fields
 * - Input type mismatches (email, number, tel)
 * - Autocomplete and autocorrect issues
 * - Form submission on mobile
 * - Focus management
 * - Keyboard dismissal
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard, Smartphone, AlertCircle, CheckCircle, XCircle, Type, Search, Mail, Hash, Phone } from 'lucide-react';
import { StandardButton, PrimaryButton, SecondaryButton } from './StandardButton';

export interface KeyboardInteractionIssue {
  id: string;
  element: string;
  type: 'input' | 'textarea' | 'select' | 'button' | 'form';
  issue: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  recommendation: string;
  selector: string;
  testSteps: string[];
}

interface MobileKeyboardInteractionAuditProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const MobileKeyboardInteractionAudit: React.FC<MobileKeyboardInteractionAuditProps> = ({
  isOpen = false,
  onClose
}) => {
  const [issues, setIssues] = useState<KeyboardInteractionIssue[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [activeTab, setActiveTab] = useState<'issues' | 'testing' | 'guidelines'>('issues');
  const [viewportHeight, setViewportHeight] = useState(typeof window !== 'undefined' ? window.innerHeight : 768);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [activeInput, setActiveInput] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track viewport changes (keyboard showing/hiding)
  useEffect(() => {
    const handleResize = () => {
      const newHeight = window.innerHeight;
      const wasKeyboardVisible = keyboardVisible;
      const isNowKeyboardVisible = newHeight < viewportHeight * 0.8;
      
      setViewportHeight(newHeight);
      setKeyboardVisible(isNowKeyboardVisible);
      
      if (wasKeyboardVisible && !isNowKeyboardVisible) {
        console.log('[Keyboard Audit] Keyboard dismissed');
      } else if (!wasKeyboardVisible && isNowKeyboardVisible) {
        console.log('[Keyboard Audit] Keyboard visible');
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [keyboardVisible, viewportHeight]);

  // Track focus changes
  useEffect(() => {
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      const tagName = target.tagName.toLowerCase();
      const id = target.id || target.getAttribute('name') || target.className || tagName;
      setActiveInput(id);
      
      if (tagName === 'input' || tagName === 'textarea') {
        console.log('[Keyboard Audit] Input focused:', id, 'type:', (target as HTMLInputElement).type);
      }
    };

    const handleBlur = () => {
      setActiveInput(null);
    };

    document.addEventListener('focusin', handleFocus);
    document.addEventListener('focusout', handleBlur);
    
    return () => {
      document.removeEventListener('focusin', handleFocus);
      document.removeEventListener('focusout', handleBlur);
    };
  }, []);

  const scanForKeyboardIssues = () => {
    setIsScanning(true);
    const newIssues: KeyboardInteractionIssue[] = [];

    // Check all input elements
    const inputs = document.querySelectorAll('input, textarea, select');
    
    inputs.forEach((input, index) => {
      const element = input as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      const tagName = element.tagName.toLowerCase();
      const type = element.getAttribute('type') || 'text';
      const id = element.id || `input-${index}`;
      const selector = element.id ? `#${element.id}` : 
                     element.name ? `[name="${element.name}"]` : 
                     `${tagName}[type="${type}"]:nth-of-type(${index + 1})`;

      // Check 1: Input type appropriateness for mobile
      if (tagName === 'input') {
        const inputElement = element as HTMLInputElement;
        
        // Email inputs without email keyboard
        if (inputElement.type === 'text' && 
            (inputElement.name?.includes('email') || 
             inputElement.id?.includes('email') ||
             inputElement.placeholder?.includes('email'))) {
          newIssues.push({
            id: `issue-email-type-${index}`,
            element: 'Input',
            type: 'input',
            issue: 'Email field using text type instead of email',
            severity: 'medium',
            description: 'Email field should use type="email" to trigger appropriate mobile keyboard',
            recommendation: 'Change input type from "text" to "email"',
            selector,
            testSteps: ['Tap on field', 'Check if email keyboard appears']
          });
        }

        // Number inputs
        if (inputElement.type === 'text' && 
            (inputElement.name?.includes('number') || 
             inputElement.id?.includes('number') ||
             inputElement.placeholder?.match(/\b(number|age|count)\b/i))) {
          newIssues.push({
            id: `issue-number-type-${index}`,
            element: 'Input',
            type: 'input',
            issue: 'Number field using text type instead of number',
            severity: 'medium',
            description: 'Number field should use type="number" or inputmode="numeric" for numeric keyboard',
            recommendation: 'Add type="number" or inputmode="numeric"',
            selector,
            testSteps: ['Tap on field', 'Check if numeric keyboard appears']
          });
        }

        // Telephone inputs
        if (inputElement.type === 'text' && 
            (inputElement.name?.includes('phone') || 
             inputElement.id?.includes('phone') ||
             inputElement.placeholder?.includes('phone'))) {
          newIssues.push({
            id: `issue-phone-type-${index}`,
            element: 'Input',
            type: 'input',
            issue: 'Phone field using text type instead of tel',
            severity: 'medium',
            description: 'Phone field should use type="tel" to trigger telephone keyboard',
            recommendation: 'Change input type from "text" to "tel"',
            selector,
            testSteps: ['Tap on field', 'Check if telephone keyboard appears']
          });
        }
      }

      // Check 2: Autocomplete attributes
      const autocomplete = element.getAttribute('autocomplete');
      if (!autocomplete && tagName === 'input') {
        const inputElement = element as HTMLInputElement;
        const shouldHaveAutocomplete = 
          inputElement.type === 'email' || 
          inputElement.name?.match(/(email|username|name|password|tel|address|city|state|zip|country)/i);
        
        if (shouldHaveAutocomplete) {
          newIssues.push({
            id: `issue-autocomplete-${index}`,
            element: 'Input',
            type: 'input',
            issue: 'Missing autocomplete attribute',
            severity: 'low',
            description: 'Autocomplete helps mobile browsers fill forms quickly and accurately',
            recommendation: 'Add appropriate autocomplete attribute (e.g., autocomplete="email")',
            selector,
            testSteps: ['Try to autofill form', 'Check if browser suggests values']
          });
        }
      }

      // Check 3: Input mode for better keyboard
      const inputmode = element.getAttribute('inputmode');
      if (!inputmode && tagName === 'input') {
        const inputElement = element as HTMLInputElement;
        
        if (inputElement.type === 'number' && !inputmode) {
          newIssues.push({
            id: `issue-inputmode-${index}`,
            element: 'Input',
            type: 'input',
            issue: 'Number input missing inputmode',
            severity: 'low',
            description: 'inputmode="numeric" or "decimal" improves mobile keyboard experience',
            recommendation: 'Add inputmode="numeric" or inputmode="decimal"',
            selector,
            testSteps: ['Tap on field', 'Check keyboard type']
          });
        }
      }

      // Check 4: Small touch targets
      const rect = element.getBoundingClientRect();
      if (rect.height < 44 || rect.width < 44) {
        newIssues.push({
          id: `issue-touch-target-${index}`,
          element: tagName.toUpperCase(),
          type: tagName as any,
          issue: 'Touch target too small',
          severity: 'high',
          description: `Element is ${Math.round(rect.height)}px tall (minimum 44px recommended for mobile)`,
          recommendation: 'Increase min-height to 44px and add sufficient padding',
          selector,
          testSteps: ['Try to tap element', 'Check for accurate targeting']
        });
      }

      // Check 5: Labels and accessibility
      const hasLabel = element.labels && element.labels.length > 0;
      const ariaLabel = element.getAttribute('aria-label');
      const ariaLabelledBy = element.getAttribute('aria-labelledby');
      
      if (!hasLabel && !ariaLabel && !ariaLabelledBy && !element.getAttribute('placeholder')) {
        newIssues.push({
          id: `issue-label-${index}`,
          element: tagName.toUpperCase(),
          type: tagName as any,
          issue: 'Missing accessible label',
          severity: 'medium',
          description: 'Element needs a label for screen readers and accessibility',
          recommendation: 'Add <label>, aria-label, aria-labelledby, or placeholder',
          selector,
          testSteps: ['Use screen reader', 'Check if element is announced']
        });
      }
    });

    // Check form submission
    const forms = document.querySelectorAll('form');
    forms.forEach((form, index) => {
      const hasSubmitButton = form.querySelector('button[type="submit"], input[type="submit"]');
      const handlesEnterKey = form.querySelector('input[type="text"], input[type="email"], input[type="password"]');
      
      if (!hasSubmitButton) {
        newIssues.push({
          id: `issue-form-submit-${index}`,
          element: 'Form',
          type: 'form',
          issue: 'Missing submit button',
          severity: 'medium',
          description: 'Forms should have visible submit buttons for mobile users',
          recommendation: 'Add a submit button with type="submit"',
          selector: `form:nth-of-type(${index + 1})`,
          testSteps: ['Try to submit form', 'Check for submission method']
        });
      }
    });

    // Check for elements that might be covered by keyboard
    if (keyboardVisible && activeInput) {
      const activeElement = document.querySelector(`#${activeInput}`) || 
                           document.querySelector(`[name="${activeInput}"]`);
      if (activeElement) {
        const rect = activeElement.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const keyboardHeight = 300; // Approximate keyboard height
        
        if (rect.bottom > viewportHeight - keyboardHeight) {
          newIssues.push({
            id: `issue-keyboard-cover-${Date.now()}`,
            element: 'Input',
            type: 'input',
            issue: 'Input may be covered by keyboard',
            severity: 'high',
            description: `Input is ${Math.round(rect.bottom)}px from top, keyboard covers bottom ${keyboardHeight}px`,
            recommendation: 'Ensure inputs scroll into view when focused',
            selector: activeInput,
            testSteps: ['Focus input', 'Check if it scrolls into view']
          });
        }
      }
    }

    setIssues(newIssues);
    setIsScanning(false);
  };

  const highlightElement = (selector: string) => {
    // Remove previous highlights
    document.querySelectorAll('.keyboard-audit-highlight').forEach(el => {
      el.classList.remove('keyboard-audit-highlight');
    });

    const element = document.querySelector(selector);
    if (element instanceof HTMLElement) {
      element.classList.add('keyboard-audit-highlight');
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Focus the element if it's focusable
      if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT' || element.tagName === 'BUTTON') {
        (element as HTMLElement).focus();
      }
    }
  };

  const testInputTypes = [
    { type: 'email', icon: Mail, label: 'Email', placeholder: 'test@example.com' },
    { type: 'tel', icon: Phone, label: 'Phone', placeholder: '(123) 456-7890' },
    { type: 'number', icon: Hash, label: 'Number', placeholder: '42' },
    { type: 'text', icon: Type, label: 'Text', placeholder: 'Enter text' },
    { type: 'search', icon: Search, label: 'Search', placeholder: 'Search...' }
  ];

  const severityColor = (severity: KeyboardInteractionIssue['severity']) => {
    switch (severity) {
      case 'high': return 'text-[var(--color-error)]';
      case 'medium': return 'text-[var(--color-warning)]';
      case 'low': return 'text-[var(--color-info)]';
      default: return 'text-[var(--color-text-muted)]';
    }
  };

  const severityBg = (severity: KeyboardInteractionIssue['severity']) => {
    switch (severity) {
      case 'high': return 'bg-[var(--color-error-bg)]';
      case 'medium': return 'bg-[var(--color-warning-bg)]';
      case 'low': return 'bg-[var(--color-info-bg)]';
      default: return 'bg-[var(--color-bg-secondary)]';
    }
  };

  const severityIcon = (severity: KeyboardInteractionIssue['severity']) => {
    switch (severity) {
      case 'high': return <XCircle className="w-4 h-4" />;
      case 'medium': return <AlertCircle className="w-4 h-4" />;
      case 'low': return <AlertCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  useEffect(() => {
    if (isOpen) {
      scanForKeyboardIssues();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-[var(--color-overlay)] backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="bg-[var(--color-bg-primary)] rounded-2xl border border-[var(--color-border)] shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        ref={containerRef}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[var(--color-accent)]/10">
              <Keyboard className="w-6 h-6 text-[var(--color-accent)]" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
                Mobile Keyboard Interaction Audit
              </h2>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                Viewport: {window.innerWidth}×{viewportHeight}px • {keyboardVisible ? 'Keyboard visible' : 'No keyboard'} • Active: {activeInput || 'none'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--color-border)]">
          {['issues', 'testing', 'guidelines'].map((tab) => (
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
            {activeTab === 'issues' && (
              <motion.div
                key="issues"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {/* Scan button */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-[var(--color-text-primary)]">
                      Keyboard Interaction Issues
                    </h3>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      Found {issues.length} potential mobile keyboard issues
                    </p>
                  </div>
                  <PrimaryButton
                    leftIcon={<Smartphone className="w-4 h-4" />}
                    onClick={scanForKeyboardIssues}
                    loading={isScanning}
                  >
                    {isScanning ? 'Scanning...' : 'Scan Again'}
                  </PrimaryButton>
                </div>

                {/* Issues list */}
                {issues.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle className="w-12 h-12 text-[var(--color-success)] mx-auto mb-4" />
                    <h4 className="text-lg font-medium text-[var(--color-text-primary)] mb-2">
                      No Keyboard Issues Found
                    </h4>
                    <p className="text-[var(--color-text-muted)]">
                      All keyboard interactions appear to be mobile-friendly.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {issues.map((issue) => (
                      <motion.div
                        key={issue.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-4 rounded-xl border ${severityBg(issue.severity)} ${severityColor(issue.severity)}/20 border-current/20`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5">
                              {severityIcon(issue.severity)}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`font-medium ${severityColor(issue.severity)}`}>
                                  {issue.issue}
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-current/10">
                                  {issue.severity}
                                </span>
                              </div>
                              <p className="text-sm text-[var(--color-text-secondary)] mb-2">
                                {issue.description}
                              </p>
                              <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
                                Recommendation:
                              </p>
                              <p className="text-sm text-[var(--color-text-secondary)] mb-3">
                                {issue.recommendation}
                              </p>
                              <div className="flex items-center gap-3">
                                <SecondaryButton
                                  size="sm"
                                  onClick={() => highlightElement(issue.selector)}
                                >
                                  Highlight Element
                                </SecondaryButton>
                                <button
                                  className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                                  onClick={() => navigator.clipboard.writeText(issue.selector)}
                                >
                                  Copy selector
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'testing' && (
              <motion.div
                key="testing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <h3 className="text-lg font-medium text-[var(--color-text-primary)]">
                  Keyboard Testing Suite
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {testInputTypes.map((input) => (
                    <div key={input.type} className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                      <div className="flex items-center gap-3 mb-3">
                        <input.type.icon className="w-5 h-5 text-[var(--color-text-muted)]" />
                        <div>
                          <h4 className="font-medium text-[var(--color-text-primary)]">{input.label}</h4>
                          <p className="text-xs text-[var(--color-text-muted)]">type="{input.type}"</p>
                        </div>
                      </div>
                      <input
                        type={input.type}
                        placeholder={input.placeholder}
                        className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                        autoComplete={input.type === 'email' ? 'email' : input.type === 'tel' ? 'tel' : 'off'}
                        inputMode={input.type === 'number' ? 'numeric' : input.type === 'tel' ? 'tel' : 'text'}
                      />
                      <div className="mt-3 text-xs text-[var(--color-text-muted)]">
                        <p>Test: Tap to see keyboard type</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                  <h4 className="font-medium text-[var(--color-text-primary)] mb-3">Form Submission Test</h4>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      alert('Form submitted (test)');
                    }}
                    className="space-y-3"
                  >
                    <input
                      type="email"
                      placeholder="Email"
                      className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
                      autoComplete="email"
                    />
                    <input
                      type="password"
                      placeholder="Password"
                      className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
                      autoComplete="current-password"
                    />
                    <div className="flex gap-3">
                      <PrimaryButton type="submit">
                        Submit Form
                      </PrimaryButton>
                      <SecondaryButton type="button">
                        Cancel
                      </SecondaryButton>
                    </div>
                  </form>
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
                <h3 className="text-lg font-medium text-[var(--color-text-primary)]">
                  Mobile Keyboard Guidelines
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                      <h4 className="font-medium text-[var(--color-text-primary)] mb-2">Input Types</h4>
                      <ul className="space-y-2 text-sm text-[var(--color-text-secondary)]">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-[var(--color-success)]" />
                          <span>Use <code>type="email"</code> for email addresses</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-[var(--color-success)]" />
                          <span>Use <code>type="tel"</code> for phone numbers</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-[var(--color-success)]" />
                          <span>Use <code>type="number"</code> with <code>inputmode="numeric"</code></span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-[var(--color-success)]" />
                          <span>Use <code>type="search"</code> for search fields</span>
                        </li>
                      </ul>
                    </div>

                    <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                      <h4 className="font-medium text-[var(--color-text-primary)] mb-2">Autocomplete</h4>
                      <ul className="space-y-2 text-sm text-[var(--color-text-secondary)]">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-[var(--color-success)]" />
                          <span>Always add <code>autocomplete</code> attributes</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-[var(--color-success)]" />
                          <span>Use <code>autocomplete="email"</code> for email</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-[var(--color-success)]" />
                          <span>Use <code>autocomplete="current-password"</code> for passwords</span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                      <h4 className="font-medium text-[var(--color-text-primary)] mb-2">Touch Targets</h4>
                      <ul className="space-y-2 text-sm text-[var(--color-text-secondary)]">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-[var(--color-success)]" />
                          <span>Minimum 44×44px for touch targets</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-[var(--color-success)]" />
                          <span>Add sufficient padding around inputs</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-[var(--color-success)]" />
                          <span>Ensure labels are tappable</span>
                        </li>
                      </ul>
                    </div>

                    <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                      <h4 className="font-medium text-[var(--color-text-primary)] mb-2">Keyboard Management</h4>
                      <ul className="space-y-2 text-sm text-[var(--color-text-secondary)]">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-[var(--color-success)]" />
                          <span>Scroll inputs into view when focused</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-[var(--color-success)]" />
                          <span>Provide "Done" or "Next" buttons in keyboard toolbar</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-[var(--color-success)]" />
                          <span>Dismiss keyboard on form submission</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                  <h4 className="font-medium text-[var(--color-text-primary)] mb-3">Testing Checklist</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h5 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">Manual Testing</h5>
                      <ul className="space-y-1 text-sm text-[var(--color-text-secondary)]">
                        <li>• Test on actual iOS and Android devices</li>
                        <li>• Try different keyboard types (email, numeric, etc.)</li>
                        <li>• Test form submission with keyboard</li>
                        <li>• Check autofill behavior</li>
                      </ul>
                    </div>
                    <div>
                      <h5 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">Automated Checks</h5>
                      <ul className="space-y-1 text-sm text-[var(--color-text-secondary)]">
                        <li>• Run this audit tool regularly</li>
                        <li>• Check Lighthouse accessibility score</li>
                        <li>• Validate HTML with input type attributes</li>
                        <li>• Test with screen readers</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <div className="flex items-center justify-between">
            <div className="text-sm text-[var(--color-text-muted)]">
              {issues.length > 0 ? (
                <span>
                  Found <span className="font-medium text-[var(--color-text-primary)]">{issues.length}</span> keyboard issues •
                  High: {issues.filter(i => i.severity === 'high').length} •
                  Medium: {issues.filter(i => i.severity === 'medium').length} •
                  Low: {issues.filter(i => i.severity === 'low').length}
                </span>
              ) : (
                <span>All keyboard interactions pass mobile usability checks</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <SecondaryButton
                size="sm"
                onClick={() => {
                  document.querySelectorAll('.keyboard-audit-highlight').forEach(el => {
                    el.classList.remove('keyboard-audit-highlight');
                  });
                }}
              >
                Clear Highlights
              </SecondaryButton>
              <PrimaryButton
                size="sm"
                onClick={scanForKeyboardIssues}
                loading={isScanning}
              >
                {isScanning ? 'Scanning...' : 'Scan Again'}
              </PrimaryButton>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Add CSS for highlighting
const style = document.createElement('style');
style.textContent = `
  .keyboard-audit-highlight {
    outline: 3px solid var(--color-accent) !important;
    outline-offset: 2px !important;
    box-shadow: 0 0 0 4px var(--color-accent) / 0.3 !important;
    z-index: 9999 !important;
    position: relative !important;
    animation: keyboard-audit-pulse 2s infinite !important;
  }
  
  @keyframes keyboard-audit-pulse {
    0%, 100% { outline-color: var(--color-accent); }
    50% { outline-color: var(--color-warning); }
  }
`;
document.head.appendChild(style);