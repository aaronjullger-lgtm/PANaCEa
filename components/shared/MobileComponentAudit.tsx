import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StandardButton } from './StandardButton';

export interface MobileComponentIssue {
  id: string;
  component: string;
  type: 'layout' | 'navigation' | 'interaction' | 'performance' | 'accessibility';
  issue: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  recommendation: string;
  testSteps: string[];
  affectedSelectors: string[];
  mobileBreakpoints: string[];
}

interface MobileComponentAuditProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const MobileComponentAudit: React.FC<MobileComponentAuditProps> = ({
  isOpen = false,
  onClose
}) => {
  const [issues, setIssues] = useState<MobileComponentIssue[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [activeTab, setActiveTab] = useState<'issues' | 'components' | 'tests'>('issues');
  const [viewportWidth, setViewportWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  const [viewportHeight, setViewportHeight] = useState(typeof window !== 'undefined' ? window.innerHeight : 768);
  const [deviceType, setDeviceType] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  const containerRef = useRef<HTMLDivElement>(null);

  // Common mobile component issues to check
  const commonMobileIssues: Omit<MobileComponentIssue, 'id' | 'affectedSelectors'>[] = [
    {
      component: 'Navigation',
      type: 'navigation',
      issue: 'Hamburger menu not accessible',
      severity: 'high',
      description: 'Hamburger menu may be difficult to reach with one hand on large phones',
      recommendation: 'Consider bottom navigation or reachable menu placement',
      testSteps: ['Try to open menu with thumb', 'Check if menu is reachable one-handed'],
      mobileBreakpoints: ['< 768px']
    },
    {
      component: 'Forms',
      type: 'interaction',
      issue: 'Form inputs too small',
      severity: 'medium',
      description: 'Form inputs may be difficult to tap accurately on mobile',
      recommendation: 'Increase input height to at least 44px and add sufficient padding',
      testSteps: ['Tap each form field', 'Check for accurate cursor placement'],
      mobileBreakpoints: ['< 1024px']
    },
    {
      component: 'Modals/Dialogs',
      type: 'layout',
      issue: 'Modal too large for screen',
      severity: 'medium',
      description: 'Modals may overflow viewport or be difficult to dismiss',
      recommendation: 'Use full-screen modals on mobile with swipe-to-dismiss',
      testSteps: ['Open modal', 'Try to dismiss', 'Check content visibility'],
      mobileBreakpoints: ['< 768px']
    },
    {
      component: 'Buttons',
      type: 'interaction',
      issue: 'Button spacing too tight',
      severity: 'low',
      description: 'Buttons placed too close together may cause accidental taps',
      recommendation: 'Maintain at least 8px spacing between interactive elements',
      testSteps: ['Tap buttons rapidly', 'Check for accidental adjacent taps'],
      mobileBreakpoints: ['< 1024px']
    },
    {
      component: 'Images/Media',
      type: 'performance',
      issue: 'Unoptimized images',
      severity: 'medium',
      description: 'Large images may cause slow loading on mobile networks',
      recommendation: 'Use responsive images with srcset and lazy loading',
      testSteps: ['Check image loading times', 'Test on slow network'],
      mobileBreakpoints: ['all']
    },
    {
      component: 'Tables',
      type: 'layout',
      issue: 'Horizontal scrolling required',
      severity: 'high',
      description: 'Tables may force horizontal scrolling on mobile',
      recommendation: 'Use responsive table patterns (stacked, card-based, or horizontal scroll with indicators)',
      testSteps: ['Scroll table horizontally', 'Check content readability'],
      mobileBreakpoints: ['< 768px']
    },
    {
      component: 'Carousels',
      type: 'interaction',
      issue: 'Swipe gestures not working',
      severity: 'medium',
      description: 'Carousels may not respond to touch gestures',
      recommendation: 'Implement touch-friendly swipe gestures with momentum scrolling',
      testSteps: ['Swipe carousel', 'Check gesture responsiveness'],
      mobileBreakpoints: ['< 1024px']
    },
    {
      component: 'Dropdowns',
      type: 'interaction',
      issue: 'Dropdowns opening off-screen',
      severity: 'high',
      description: 'Dropdown menus may open outside viewport bounds',
      recommendation: 'Ensure dropdowns open within viewport with proper positioning',
      testSteps: ['Open dropdowns', 'Check visibility on screen edges'],
      mobileBreakpoints: ['< 768px']
    },
    {
      component: 'Text Inputs',
      type: 'interaction',
      issue: 'Keyboard covering input',
      severity: 'high',
      description: 'Virtual keyboard may cover focused input fields',
      recommendation: 'Scroll input into view when keyboard appears',
      testSteps: ['Focus input fields', 'Check keyboard interaction'],
      mobileBreakpoints: ['< 768px']
    },
    {
      component: 'Loading States',
      type: 'performance',
      issue: 'No skeleton loading',
      severity: 'low',
      description: 'Content may jump around during loading',
      recommendation: 'Implement skeleton screens for better perceived performance',
      testSteps: ['Trigger loading states', 'Check layout stability'],
      mobileBreakpoints: ['all']
    }
  ];

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setViewportWidth(width);
      setViewportHeight(height);
      
      if (width < 768) {
        setDeviceType('mobile');
      } else if (width < 1024) {
        setDeviceType('tablet');
      } else {
        setDeviceType('desktop');
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial call
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const scanForMobileComponentIssues = () => {
    setIsScanning(true);
    const newIssues: MobileComponentIssue[] = [];

    // Check for common mobile component patterns
    commonMobileIssues.forEach((template, index) => {
      // Check if this issue is relevant for current viewport
      const isRelevant = template.mobileBreakpoints.some(breakpoint => {
        if (breakpoint === 'all') return true;
        if (breakpoint.startsWith('<')) {
          const maxWidth = parseInt(breakpoint.replace('<', '').trim());
          return viewportWidth < maxWidth;
        }
        return false;
      });

      if (isRelevant) {
        // Find affected elements
        const affectedSelectors = findAffectedElements(template.component, template.type);
        
        if (affectedSelectors.length > 0 || template.severity === 'high') {
          newIssues.push({
            id: `mobile-issue-${index}`,
            ...template,
            affectedSelectors
          });
        }
      }
    });

    // Check for specific component issues
    checkSpecificComponentIssues(newIssues);

    // Sort by severity (high first)
    newIssues.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });

    setIssues(newIssues);
    setIsScanning(false);
  };

  const findAffectedElements = (component: string, type: string): string[] => {
    const selectors: string[] = [];
    
    switch (component) {
      case 'Navigation':
        // Look for hamburger menus
        const hamburgers = document.querySelectorAll('[aria-label*="menu"], [aria-label*="navigation"], .hamburger, .menu-toggle');
        hamburgers.forEach(el => {
          if (el instanceof HTMLElement) {
            const rect = el.getBoundingClientRect();
            // Check if menu is in hard-to-reach area (top corners)
            if (rect.top < 100 && (rect.left < 50 || rect.right > viewportWidth - 50)) {
              selectors.push(getElementSelector(el));
            }
          }
        });
        break;
        
      case 'Forms':
        // Check form input sizes
        const inputs = document.querySelectorAll('input, select, textarea');
        inputs.forEach(el => {
          if (el instanceof HTMLElement) {
            const rect = el.getBoundingClientRect();
            if (rect.height < 44) {
              selectors.push(getElementSelector(el));
            }
          }
        });
        break;
        
      case 'Modals/Dialogs':
        // Check modal sizes
        const modals = document.querySelectorAll('[role="dialog"], .modal, .dialog');
        modals.forEach(el => {
          if (el instanceof HTMLElement) {
            const rect = el.getBoundingClientRect();
            if (rect.width > viewportWidth * 0.9) {
              selectors.push(getElementSelector(el));
            }
          }
        });
        break;
        
      case 'Tables':
        // Check for horizontally scrolling tables
        const tables = document.querySelectorAll('table');
        tables.forEach(el => {
          if (el instanceof HTMLElement) {
            const rect = el.getBoundingClientRect();
            if (rect.width > viewportWidth) {
              selectors.push(getElementSelector(el));
            }
          }
        });
        break;
    }
    
    return selectors;
  };

  const checkSpecificComponentIssues = (issues: MobileComponentIssue[]) => {
    // Check for viewport overflow
    const overflowingElements = document.querySelectorAll('*');
    overflowingElements.forEach(el => {
      if (el instanceof HTMLElement) {
        const rect = el.getBoundingClientRect();
        if (rect.right > viewportWidth || rect.left < 0) {
          const style = window.getComputedStyle(el);
          if (style.overflowX === 'visible' && el.scrollWidth > el.clientWidth) {
            issues.push({
              id: `overflow-${issues.length}`,
              component: 'Layout',
              type: 'layout',
              issue: 'Horizontal overflow',
              severity: 'high',
              description: `Element "${getElementSelector(el)}" overflows viewport horizontally`,
              recommendation: 'Add overflow-x: hidden or make element responsive',
              testSteps: ['Scroll horizontally', 'Check element bounds'],
              mobileBreakpoints: [`< ${viewportWidth + 100}px`],
              affectedSelectors: [getElementSelector(el)]
            });
          }
        }
      }
    });

    // Check for fixed elements that might overlap
    const fixedElements = document.querySelectorAll('*[style*="fixed"], .fixed, .sticky');
    fixedElements.forEach(el => {
      if (el instanceof HTMLElement) {
        const rect = el.getBoundingClientRect();
        // Check if fixed element covers important content
        if (rect.bottom > viewportHeight * 0.8 && rect.height > 50) {
          issues.push({
            id: `fixed-${issues.length}`,
            component: 'Layout',
            type: 'layout',
            issue: 'Fixed element may obscure content',
            severity: 'medium',
            description: `Fixed element "${getElementSelector(el)}" covers significant portion of screen`,
            recommendation: 'Consider making element dismissible or less intrusive on mobile',
            testSteps: ['Scroll page', 'Check content visibility'],
            mobileBreakpoints: [`< ${viewportWidth}px`],
            affectedSelectors: [getElementSelector(el)]
          });
        }
      }
    });
  };

  const getElementSelector = (element: HTMLElement): string => {
    if (element.id) return `#${element.id}`;
    
    let selector = element.tagName.toLowerCase();
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.split(' ').filter(c => c.length > 0);
      if (classes.length > 0) {
        selector += `.${classes.join('.')}`;
      }
    }
    
    return selector;
  };

  const highlightElement = (selector: string) => {
    // Remove previous highlights
    document.querySelectorAll('.mobile-component-highlight').forEach(el => {
      el.classList.remove('mobile-component-highlight');
    });

    // Add highlight to element
    const element = document.querySelector(selector);
    if (element instanceof HTMLElement) {
      element.classList.add('mobile-component-highlight');
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const runTest = (testSteps: string[]) => {
    alert(`Test Steps:\n${testSteps.map((step, i) => `${i + 1}. ${step}`).join('\n')}`);
  };

  const simulateMobileViewport = (width: number, height: number) => {
    // This would typically be done through browser devtools
    // For now, we'll just update the viewport display
    setViewportWidth(width);
    setViewportHeight(height);
    alert(`Simulating viewport: ${width}×${height}px\nUse browser devtools for actual viewport simulation.`);
  };

  useEffect(() => {
    if (isOpen) {
      scanForMobileComponentIssues();
    }
  }, [isOpen, viewportWidth]);

  useEffect(() => {
    return () => {
      // Clean up highlights
      document.querySelectorAll('.mobile-component-highlight').forEach(el => {
        el.classList.remove('mobile-component-highlight');
      });
    };
  }, []);

  const severityColor = (severity: MobileComponentIssue['severity']) => {
    switch (severity) {
      case 'high': return 'text-[var(--color-data-fail)]';
      case 'medium': return 'text-[var(--color-data-provisional)]';
      case 'low': return 'text-[var(--color-data-pass)]';
    }
  };

  const severityBg = (severity: MobileComponentIssue['severity']) => {
    switch (severity) {
      case 'high': return 'bg-[var(--color-data-fail)]/10';
      case 'medium': return 'bg-[var(--color-data-provisional)]/10';
      case 'low': return 'bg-[var(--color-data-pass)]/10';
    }
  };

  const typeIcon = (type: MobileComponentIssue['type']) => {
    switch (type) {
      case 'layout': return '📐';
      case 'navigation': return '🧭';
      case 'interaction': return '👆';
      case 'performance': return '⚡';
      case 'accessibility': return '♿';
    }
  };

  const commonViewports = [
    { label: 'iPhone SE', width: 375, height: 667 },
    { label: 'iPhone 12', width: 390, height: 844 },
    { label: 'Pixel 5', width: 393, height: 851 },
    { label: 'iPad Mini', width: 768, height: 1024 },
    { label: 'iPad Air', width: 820, height: 1180 },
    { label: 'Desktop', width: 1440, height: 900 }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--color-overlay)]"
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.95 }}
            className="bg-[var(--color-bg-primary)] rounded-2xl border border-[var(--color-border)] shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden"
            ref={containerRef}
          >
            <div className="p-6 border-b border-[var(--color-border)]">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
                    Mobile Component Audit
                  </h2>
                  <p className="text-sm text-[var(--color-text-muted)] mt-1">
                    Viewport: {viewportWidth}×{viewportHeight}px • Device: {deviceType} • Issues: {issues.length}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StandardButton
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                  >
                    Close
                  </StandardButton>
                </div>
              </div>

              <div className="flex items-center gap-4 mt-4">
                <div className="flex border border-[var(--color-border)] rounded-lg overflow-hidden">
                  {(['issues', 'components', 'tests'] as const).map((tab) => (
                    <button
                      key={tab}
                      className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                        activeTab === tab
                          ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
                      }`}
                      onClick={() => setActiveTab(tab)}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div className="flex-1">
                  <div className="flex flex-wrap gap-2">
                    {commonViewports.map((vp) => (
                      <button
                        key={vp.label}
                        className="px-3 py-1 text-xs border border-[var(--color-border)] rounded hover:bg-[var(--color-bg-tertiary)]"
                        onClick={() => simulateMobileViewport(vp.width, vp.height)}
                      >
                        {vp.label}
                      </button>
                    ))}
                  </div>
                </div>

                <StandardButton
                  variant="outline"
                  size="sm"
                  onClick={scanForMobileComponentIssues}
                  loading={isScanning}
                >
                  {isScanning ? 'Scanning...' : 'Rescan'}
                </StandardButton>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              {activeTab === 'issues' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-[var(--color-text-primary)]">
                        Mobile Component Issues
                      </h3>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        Found {issues.length} potential mobile usability issues
                      </p>
                    </div>
                  </div>

                  {issues.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-4xl mb-4">📱✅</div>
                      <h4 className="text-lg font-medium text-[var(--color-text-primary)] mb-2">
                        No Mobile Issues Found
                      </h4>
                      <p className="text-[var(--color-text-muted)]">
                        All components appear to be mobile-friendly at {viewportWidth}×{viewportHeight}px.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {issues.map((issue) => (
                        <motion.div
                          key={issue.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="text-lg">{typeIcon(issue.type)}</span>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${severityBg(issue.severity)} ${severityColor(issue.severity)}`}>
                                  {issue.severity.toUpperCase()}
                                </span>
                                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                                  {issue.component}
                                </span>
                                <span className="text-xs text-[var(--color-text-muted)]">
                                  {issue.type}
                                </span>
                              </div>
                              
                              <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
                                {issue.issue}
                              </h4>
                              
                              <p className="text-sm text-[var(--color-text-secondary)] mb-3">
                                {issue.description}
                              </p>
                              
                              <div className="mb-3">
                                <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1">Recommendation</p>
                                <p className="text-sm text-[var(--color-text-primary)]">{issue.recommendation}</p>
                              </div>
                              
                              {issue.affectedSelectors.length > 0 && (
                                <div className="mb-3">
                                  <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1">Affected Elements</p>
                                  <div className="flex flex-wrap gap-2">
                                    {issue.affectedSelectors.map((selector, idx) => (
                                      <button
                                        key={idx}
                                        className="text-xs bg-[var(--color-bg-tertiary)] px-2 py-1 rounded hover:bg-[var(--color-bg-tertiary)]/80"
                                        onClick={() => highlightElement(selector)}
                                      >
                                        {selector}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              <div>
                                <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1">Test Steps</p>
                                <ul className="text-sm text-[var(--color-text-secondary)] space-y-1">
                                  {issue.testSteps.map((step, idx) => (
                                    <li key={idx} className="flex items-start gap-2">
                                      <span className="text-[var(--color-text-muted)]">{idx + 1}.</span>
                                      <span>{step}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                            
                            <div className="flex flex-col gap-2 ml-4">
                              <StandardButton
                                variant="outline"
                                size="sm"
                                onClick={() => runTest(issue.testSteps)}
                              >
                                Run Test
                              </StandardButton>
                              {issue.affectedSelectors.length > 0 && (
                                <StandardButton
                                  variant="primary"
                                  size="sm"
                                  onClick={() => issue.affectedSelectors.forEach(highlightElement)}
                                >
                                  Highlight All
                                </StandardButton>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'components' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-4">
                      Mobile Component Patterns
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {[
                        {
                          title: 'Bottom Navigation',
                          icon: '👇',
                          description: 'Place primary navigation at bottom for thumb reachability',
                          implementation: 'Use fixed positioning with safe area insets',
                          components: ['NavRail', 'BottomTabBar']
                        },
                        {
                          title: 'Responsive Tables',
                          icon: '📊',
                          description: 'Stack table rows or enable horizontal scroll with indicators',
                          implementation: 'CSS grid or flexbox with overflow-x: auto',
                          components: ['DataTable', 'ResponsiveTable']
                        },
                        {
                          title: 'Touch-Friendly Forms',
                          icon: '📝',
                          description: 'Large inputs with proper spacing and keyboard management',
                          implementation: 'min-height: 44px, inputmode attributes',
                          components: ['Form', 'Input', 'Select']
                        },
                        {
                          title: 'Swipeable Carousels',
                          icon: '🔄',
                          description: 'Implement touch gestures with momentum and boundaries',
                          implementation: 'touch-action: pan-y, transform transitions',
                          components: ['Carousel', 'ImageGallery']
                        },
                        {
                          title: 'Full-Screen Modals',
                          icon: '📱',
                          description: 'Modals that fill screen on mobile with swipe-to-dismiss',
                          implementation: 'position: fixed, overscroll-behavior: contain',
                          components: ['Modal', 'Dialog', 'Drawer']
                        },
                        {
                          title: 'Adaptive Typography',
                          icon: 'A',
                          description: 'Font sizes that scale appropriately for screen size',
                          implementation: 'clamp() function, CSS custom properties',
                          components: ['Typography', 'Text']
                        }
                      ].map((pattern, index) => (
                        <div key={index} className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-2xl">{pattern.icon}</span>
                            <h4 className="font-medium text-[var(--color-text-primary)]">{pattern.title}</h4>
                          </div>
                          <p className="text-sm text-[var(--color-text-secondary)] mb-3">{pattern.description}</p>
                          <div className="mb-3">
                            <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1">Implementation</p>
                            <code className="text-xs bg-[var(--color-bg-tertiary)] px-2 py-1 rounded block">
                              {pattern.implementation}
                            </code>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1">Components</p>
                            <div className="flex flex-wrap gap-1">
                              {pattern.components.map((comp, idx) => (
                                <span key={idx} className="text-xs bg-[var(--color-accent)]/10 text-[var(--color-accent)] px-2 py-1 rounded">
                                  {comp}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'tests' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-4">
                      Mobile Testing Suite
                    </h3>
                    
                    <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="font-medium text-[var(--color-text-primary)] mb-3">Manual Tests</h4>
                          <div className="space-y-4">
                            {[
                              'Test one-handed operation (thumb reach)',
                              'Check form input accuracy',
                              'Verify keyboard doesn\'t cover inputs',
                              'Test swipe gestures on carousels',
                              'Check modal dismissal (tap outside, swipe)',
                              'Verify touch target sizes (44px minimum)',
                              'Test in both portrait and landscape',
                              'Check loading states and skeletons',
                              'Verify no horizontal scrolling',
                              'Test with increased font size'
                            ].map((test, idx) => (
                              <div key={idx} className="flex items-start gap-3">
                                <input type="checkbox" id={`test-${idx}`} className="mt-1" />
                                <label htmlFor={`test-${idx}`} className="text-sm text-[var(--color-text-secondary)] flex-1">
                                  {test}
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="font-medium text-[var(--color-text-primary)] mb-3">Automated Checks</h4>
                          <div className="space-y-4">
                            <div className="p-4 border border-[var(--color-border)] rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium">Viewport Analysis</span>
                                <span className="text-xs px-2 py-1 bg-[var(--color-data-pass)]/10 text-[var(--color-data-pass)] rounded">
                                  Pass
                                </span>
                              </div>
                              <p className="text-xs text-[var(--color-text-muted)]">
                                Checking for viewport meta tag and responsive design
                              </p>
                            </div>
                            
                            <div className="p-4 border border-[var(--color-border)] rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium">Touch Target Audit</span>
                                <span className="text-xs px-2 py-1 bg-[var(--color-data-provisional)]/10 text-[var(--color-data-provisional)] rounded">
                                  Warning
                                </span>
                              </div>
                              <p className="text-xs text-[var(--color-text-muted)]">
                                {issues.filter(i => i.type === 'interaction').length} interaction issues found
                              </p>
                            </div>
                            
                            <div className="p-4 border border-[var(--color-border)] rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium">Performance Check</span>
                                <span className="text-xs px-2 py-1 bg-[var(--color-data-pass)]/10 text-[var(--color-data-pass)] rounded">
                                  Pass
                                </span>
                              </div>
                              <p className="text-xs text-[var(--color-text-muted)]">
                                Checking for unoptimized images and heavy components
                              </p>
                            </div>
                            
                            <div className="p-4 border border-[var(--color-border)] rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium">Accessibility Scan</span>
                                <span className="text-xs px-2 py-1 bg-[var(--color-data-pass)]/10 text-[var(--color-data-pass)] rounded">
                                  Pass
                                </span>
                              </div>
                              <p className="text-xs text-[var(--color-text-muted)]">
                                Checking screen reader compatibility and focus management
                              </p>
                            </div>
                          </div>
                          
                          <div className="mt-6">
                            <h5 className="font-medium text-[var(--color-text-primary)] mb-2">Testing Tools</h5>
                            <div className="flex flex-wrap gap-2">
                              <button className="px-3 py-1 text-xs border border-[var(--color-border)] rounded hover:bg-[var(--color-bg-tertiary)]">
                                Lighthouse
                              </button>
                              <button className="px-3 py-1 text-xs border border-[var(--color-border)] rounded hover:bg-[var(--color-bg-tertiary)]">
                                WebPageTest
                              </button>
                              <button className="px-3 py-1 text-xs border border-[var(--color-border)] rounded hover:bg-[var(--color-bg-tertiary)]">
                                BrowserStack
                              </button>
                              <button className="px-3 py-1 text-xs border border-[var(--color-border)] rounded hover:bg-[var(--color-bg-tertiary)]">
                                Responsively
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <div className="flex items-center justify-between">
                <div className="text-sm text-[var(--color-text-muted)]">
                  {issues.length > 0 ? (
                    <span>
                      Found <span className="font-medium text-[var(--color-text-primary)]">{issues.length}</span> mobile component issues • 
                      High: {issues.filter(i => i.severity === 'high').length} • 
                      Medium: {issues.filter(i => i.severity === 'medium').length}
                    </span>
                  ) : (
                    <span>All components pass mobile usability checks</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <StandardButton
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      document.querySelectorAll('.mobile-component-highlight').forEach(el => {
                        el.classList.remove('mobile-component-highlight');
                      });
                    }}
                  >
                    Clear Highlights
                  </StandardButton>
                  <StandardButton
                    variant="primary"
                    size="sm"
                    onClick={scanForMobileComponentIssues}
                  >
                    Run Full Audit
                  </StandardButton>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};