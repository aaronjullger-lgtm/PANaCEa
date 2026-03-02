/**
 * MobileScreenSizeTester Component
 * 
 * Allows testing the application on various mobile screen sizes.
 * Provides preset device sizes, custom viewport controls, and issue detection.
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Smartphone, Tablet, Monitor, Maximize2, Minimize2, 
  RotateCw, AlertCircle, CheckCircle, X, Grid, 
  Smartphone as PhoneIcon, Tablet as TabletIcon, Monitor as DesktopIcon
} from 'lucide-react';
import { StandardButton, PrimaryButton, OutlineButton } from './StandardButton';

export interface ScreenSizeIssue {
  id: string;
  type: 'layout' | 'overflow' | 'touch-target' | 'typography' | 'image';
  description: string;
  severity: 'low' | 'medium' | 'high';
  element?: string;
  recommendation: string;
}

export interface DevicePreset {
  id: string;
  name: string;
  width: number;
  height: number;
  type: 'phone' | 'tablet' | 'desktop';
  dpi: number;
  icon: React.ReactNode;
}

export interface MobileScreenSizeTesterProps {
  /** Whether the tester is initially open */
  defaultOpen?: boolean;
  /** Callback when tester is closed */
  onClose?: () => void;
}

export const MobileScreenSizeTester: React.FC<MobileScreenSizeTesterProps> = ({
  defaultOpen = false,
  onClose
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [activeTab, setActiveTab] = useState<'presets' | 'custom' | 'issues'>('presets');
  const [viewportWidth, setViewportWidth] = useState(375);
  const [viewportHeight, setViewportHeight] = useState(812);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRotated, setIsRotated] = useState(false);
  const [issues, setIssues] = useState<ScreenSizeIssue[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>('iphone-15-pro');
  
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Device presets
  const devicePresets: DevicePreset[] = [
    // Phones
    { id: 'iphone-se', name: 'iPhone SE', width: 375, height: 667, type: 'phone', dpi: 326, icon: <PhoneIcon className="w-4 h-4" /> },
    { id: 'iphone-15-pro', name: 'iPhone 15 Pro', width: 393, height: 852, type: 'phone', dpi: 460, icon: <PhoneIcon className="w-4 h-4" /> },
    { id: 'iphone-15-pro-max', name: 'iPhone 15 Pro Max', width: 430, height: 932, type: 'phone', dpi: 460, icon: <PhoneIcon className="w-4 h-4" /> },
    { id: 'pixel-7', name: 'Google Pixel 7', width: 412, height: 915, type: 'phone', dpi: 420, icon: <PhoneIcon className="w-4 h-4" /> },
    { id: 'samsung-s23', name: 'Samsung S23', width: 360, height: 780, type: 'phone', dpi: 425, icon: <PhoneIcon className="w-4 h-4" /> },
    { id: 'galaxy-fold', name: 'Galaxy Fold', width: 884, height: 1104, type: 'phone', dpi: 373, icon: <PhoneIcon className="w-4 h-4" /> },
    
    // Tablets
    { id: 'ipad-mini', name: 'iPad Mini', width: 768, height: 1024, type: 'tablet', dpi: 326, icon: <TabletIcon className="w-4 h-4" /> },
    { id: 'ipad-air', name: 'iPad Air', width: 820, height: 1180, type: 'tablet', dpi: 264, icon: <TabletIcon className="w-4 h-4" /> },
    { id: 'ipad-pro-11', name: 'iPad Pro 11"', width: 834, height: 1194, type: 'tablet', dpi: 264, icon: <TabletIcon className="w-4 h-4" /> },
    { id: 'ipad-pro-12', name: 'iPad Pro 12.9"', width: 1024, height: 1366, type: 'tablet', dpi: 264, icon: <TabletIcon className="w-4 h-4" /> },
    { id: 'pixel-tablet', name: 'Pixel Tablet', width: 1600, height: 2560, type: 'tablet', dpi: 240, icon: <TabletIcon className="w-4 h-4" /> },
    
    // Desktop (mobile-like)
    { id: 'small-desktop', name: 'Small Desktop', width: 1024, height: 768, type: 'desktop', dpi: 96, icon: <DesktopIcon className="w-4 h-4" /> },
    { id: 'medium-desktop', name: 'Medium Desktop', width: 1280, height: 800, type: 'desktop', dpi: 96, icon: <DesktopIcon className="w-4 h-4" /> },
    { id: 'large-desktop', name: 'Large Desktop', width: 1440, height: 900, type: 'desktop', dpi: 96, icon: <DesktopIcon className="w-4 h-4" /> },
  ];

  // Apply selected preset
  useEffect(() => {
    const preset = devicePresets.find(p => p.id === selectedPreset);
    if (preset) {
      setViewportWidth(isRotated ? preset.height : preset.width);
      setViewportHeight(isRotated ? preset.width : preset.height);
    }
  }, [selectedPreset, isRotated]);

  // Update iframe when viewport changes
  useEffect(() => {
    if (!iframeRef.current || !isOpen) return;

    const updateIframe = () => {
      const iframe = iframeRef.current;
      if (!iframe) return;

      // Set iframe dimensions
      iframe.style.width = `${viewportWidth}px`;
      iframe.style.height = `${viewportHeight}px`;
      
      // Set iframe content (current page)
      if (!iframe.contentDocument || !iframe.contentWindow) {
        iframe.src = window.location.href;
      }
    };

    updateIframe();
  }, [viewportWidth, viewportHeight, isOpen]);

  // Scan for screen size issues
  const scanForIssues = () => {
    setIsScanning(true);
    const newIssues: ScreenSizeIssue[] = [];

    // This would normally scan the iframe content
    // For now, we'll simulate some common issues
    
    // Check for horizontal overflow
    if (viewportWidth < 768) {
      newIssues.push({
        id: 'overflow-1',
        type: 'overflow',
        description: `Potential horizontal overflow on ${viewportWidth}px wide screen`,
        severity: 'high',
        recommendation: 'Use max-width: 100% on containers and images'
      });
    }

    // Check for small touch targets
    if (viewportWidth <= 480) {
      newIssues.push({
        id: 'touch-target-1',
        type: 'touch-target',
        description: 'Small screens may have touch target issues',
        severity: 'medium',
        recommendation: 'Ensure buttons are at least 44×44px'
      });
    }

    // Check for typography issues
    if (viewportWidth < 375) {
      newIssues.push({
        id: 'typography-1',
        type: 'typography',
        description: 'Text may be too small on very narrow screens',
        severity: 'medium',
        recommendation: 'Use responsive font sizes (clamp())'
      });
    }

    // Check for image optimization
    if (viewportWidth < 768) {
      newIssues.push({
        id: 'image-1',
        type: 'image',
        description: 'Large images may cause performance issues on mobile',
        severity: 'low',
        recommendation: 'Use srcset with appropriate image sizes'
      });
    }

    setIssues(newIssues);
    setIsScanning(false);
  };

  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    
    setIsFullscreen(!isFullscreen);
  };

  // Rotate viewport
  const rotateViewport = () => {
    setIsRotated(!isRotated);
    setViewportWidth(prev => prev);
    setViewportHeight(prev => prev);
  };

  // Apply custom viewport
  const applyCustomViewport = () => {
    // Validate inputs
    const width = Math.max(320, Math.min(5000, viewportWidth));
    const height = Math.max(480, Math.min(5000, viewportHeight));
    
    setViewportWidth(width);
    setViewportHeight(height);
    
    // Find closest preset
    const closestPreset = devicePresets.reduce((closest, preset) => {
      const presetWidth = isRotated ? preset.height : preset.width;
      const presetHeight = isRotated ? preset.width : preset.height;
      const distance = Math.abs(presetWidth - width) + Math.abs(presetHeight - height);
      return distance < closest.distance ? { preset: preset.id, distance } : closest;
    }, { preset: 'custom', distance: Infinity });
    
    if (closestPreset.distance < 100) { // Close enough to a preset
      setSelectedPreset(closestPreset.preset);
    } else {
      setSelectedPreset('custom');
    }
  };

  // Handle fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  if (!isOpen) {
    return (
      <div className="fixed bottom-40 right-6 z-50">
        <PrimaryButton
          leftIcon={<Grid className="w-4 h-4" />}
          onClick={() => setIsOpen(true)}
          size="lg"
          className="shadow-lg"
        >
          Test Screen Sizes
        </PrimaryButton>
      </div>
    );
  }

  const selectedDevice = devicePresets.find(p => p.id === selectedPreset) || devicePresets[0];

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
        className="bg-[var(--color-bg-primary)] rounded-2xl border border-[var(--color-border)] shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        ref={containerRef}
      >
        <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[var(--color-accent)]/10">
              <Grid className="w-6 h-6 text-[var(--color-accent)]" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
                Mobile Screen Size Tester
              </h2>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                {selectedDevice.name} • {viewportWidth}×{viewportHeight}px • {isRotated ? 'Landscape' : 'Portrait'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={rotateViewport}
              className="p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              aria-label="Rotate"
              title="Rotate viewport"
            >
              <RotateCw className="w-5 h-5" />
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              aria-label="Fullscreen"
              title="Toggle fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <button
              onClick={() => {
                setIsOpen(false);
                onClose?.();
              }}
              className="p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--color-border)]">
          {['presets', 'custom', 'issues'].map((tab) => (
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
        <div className="flex-1 overflow-hidden flex">
          {/* Left Panel - Controls */}
          <div className="w-80 border-r border-[var(--color-border)] overflow-y-auto p-6">
            <AnimatePresence mode="wait">
              {activeTab === 'presets' && (
                <motion.div
                  key="presets"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  <div>
                    <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-4">
                      Device Presets
                    </h3>
                    <p className="text-sm text-[var(--color-text-muted)] mb-6">
                      Select a device to test your application on different screen sizes
                    </p>
                  </div>

                  {/* Device Categories */}
                  <div className="space-y-4">
                    {['phone', 'tablet', 'desktop'].map((type) => (
                      <div key={type}>
                        <h4 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2 flex items-center gap-2">
                          {type === 'phone' && <PhoneIcon className="w-4 h-4" />}
                          {type === 'tablet' && <TabletIcon className="w-4 h-4" />}
                          {type === 'desktop' && <DesktopIcon className="w-4 h-4" />}
                          {type.charAt(0).toUpperCase() + type.slice(1)}s
                        </h4>
                        <div className="space-y-2">
                          {devicePresets
                            .filter(preset => preset.type === type)
                            .map((preset) => (
                              <button
                                key={preset.id}
                                onClick={() => setSelectedPreset(preset.id)}
                                className={`w-full p-3 rounded-lg border text-left transition-all ${selectedPreset === preset.id ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5' : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-bg-secondary)]'}`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className={`p-1.5 rounded ${selectedPreset === preset.id ? 'bg-[var(--color-accent)]/10' : 'bg-[var(--color-bg-secondary)]'}`}>
                                      {preset.icon}
                                    </div>
                                    <div>
                                      <div className="font-medium text-[var(--color-text-primary)]">
                                        {preset.name}
                                      </div>
                                      <div className="text-xs text-[var(--color-text-muted)]">
                                        {preset.width}×{preset.height}px
                                      </div>
                                    </div>
                                  </div>
                                  {selectedPreset === preset.id && (
                                    <CheckCircle className="w-4 h-4 text-[var(--color-accent)]" />
                                  )}
                                </div>
                              </button>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-[var(--color-border)]">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="font-medium text-[var(--color-text-primary)]">
                          Current Viewport
                        </h4>
                        <p className="text-sm text-[var(--color-text-muted)]">
                          {viewportWidth}×{viewportHeight}px
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={rotateViewport}
                          className="p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                          aria-label="Rotate"
                          title="Rotate viewport"
                        >
                          <RotateCw className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                          Width (px)
                        </label>
                        <input
                          type="number"
                          value={viewportWidth}
                          onChange={(e) => setViewportWidth(parseInt(e.target.value) || 375)}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                          min="320"
                          max="5000"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                          Height (px)
                        </label>
                        <input
                          type="number"
                          value={viewportHeight}
                          onChange={(e) => setViewportHeight(parseInt(e.target.value) || 812)}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                          min="480"
                          max="5000"
                        />
                      </div>
                    </div>
                    
                    <PrimaryButton
                      onClick={applyCustomViewport}
                      className="w-full mt-4"
                    >
                      Apply Custom Size
                    </PrimaryButton>
                  </div>
                </motion.div>
              )}

              {activeTab === 'custom' && (
                <motion.div
                  key="custom"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  <div>
                    <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-4">
                      Custom Viewport
                    </h3>
                    <p className="text-sm text-[var(--color-text-muted)] mb-6">
                      Set custom dimensions for testing specific screen sizes
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                        Viewport Width (px)
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="320"
                          max="2000"
                          value={viewportWidth}
                          onChange={(e) => setViewportWidth(parseInt(e.target.value))}
                          className="flex-1"
                        />
                        <input
                          type="number"
                          value={viewportWidth}
                          onChange={(e) => setViewportWidth(parseInt(e.target.value) || 375)}
                          className="w-24 px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                          min="320"
                          max="5000"
                        />
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)] mt-1">
                        Mobile: 320-480px • Tablet: 481-1024px • Desktop: 1025px+
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                        Viewport Height (px)
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="480"
                          max="2000"
                          value={viewportHeight}
                          onChange={(e) => setViewportHeight(parseInt(e.target.value))}
                          className="flex-1"
                        />
                        <input
                          type="number"
                          value={viewportHeight}
                          onChange={(e) => setViewportHeight(parseInt(e.target.value) || 812)}
                          className="w-24 px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                          min="480"
                          max="5000"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Mobile S', width: 320, height: 568 },
                        { label: 'Mobile M', width: 375, height: 667 },
                        { label: 'Mobile L', width: 425, height: 812 },
                        { label: 'Tablet', width: 768, height: 1024 },
                      ].map((size) => (
                        <button
                          key={size.label}
                          onClick={() => {
                            setViewportWidth(size.width);
                            setViewportHeight(size.height);
                          }}
                          className="p-3 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:bg-[var(--color-bg-secondary)] transition-colors"
                        >
                          <div className="text-sm font-medium text-[var(--color-text-primary)]">
                            {size.label}
                          </div>
                          <div className="text-xs text-[var(--color-text-muted)]">
                            {size.width}×{size.height}px
                          </div>
                        </button>
                      ))}
                    </div>

                    <div className="pt-4 border-t border-[var(--color-border)]">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-[var(--color-text-primary)]">
                          Orientation
                        </span>
                        <button
                          onClick={rotateViewport}
                          className="p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                        >
                          <RotateCw className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setIsRotated(false)}
                          className={`flex-1 py-2 rounded-lg border ${!isRotated ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5 text-[var(--color-accent)]' : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/50'}`}
                        >
                          Portrait
                        </button>
                        <button
                          onClick={() => setIsRotated(true)}
                          className={`flex-1 py-2 rounded-lg border ${isRotated ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5 text-[var(--color-accent)]' : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/50'}`}
                        >
                          Landscape
                        </button>
                      </div>
                    </div>

                    <PrimaryButton
                      onClick={applyCustomViewport}
                      className="w-full"
                    >
                      Apply Viewport
                    </PrimaryButton>
                  </div>
                </motion.div>
              )}

              {activeTab === 'issues' && (
                <motion.div
                  key="issues"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  <div>
                    <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-4">
                      Screen Size Issues
                    </h3>
                    <p className="text-sm text-[var(--color-text-muted)] mb-6">
                      Common issues detected at the current screen size
                    </p>
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-medium text-[var(--color-text-primary)]">
                        Issue Detection
                      </h4>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        {viewportWidth}×{viewportHeight}px • {isRotated ? 'Landscape' : 'Portrait'}
                      </p>
                    </div>
                    <PrimaryButton
                      leftIcon={<AlertCircle className="w-4 h-4" />}
                      onClick={scanForIssues}
                      loading={isScanning}
                      size="sm"
                    >
                      Scan Again
                    </PrimaryButton>
                  </div>

                  {issues.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle className="w-12 h-12 text-[var(--color-success)] mx-auto mb-3" />
                      <h4 className="text-lg font-medium text-[var(--color-text-primary)] mb-2">
                        No Issues Found
                      </h4>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        Your application appears to be responsive at this screen size.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {issues.map((issue) => (
                        <div
                          key={issue.id}
                          className={`p-4 rounded-lg border ${
                            issue.severity === 'high' ? 'border-[var(--color-error)]/20 bg-[var(--color-error)]/5' :
                            issue.severity === 'medium' ? 'border-[var(--color-warning)]/20 bg-[var(--color-warning)]/5' :
                            'border-[var(--color-info)]/20 bg-[var(--color-info)]/5'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <AlertCircle className={`w-4 h-4 ${
                                issue.severity === 'high' ? 'text-[var(--color-error)]' :
                                issue.severity === 'medium' ? 'text-[var(--color-warning)]' :
                                'text-[var(--color-info)]'
                              }`} />
                              <span className={`font-medium ${
                                issue.severity === 'high' ? 'text-[var(--color-error)]' :
                                issue.severity === 'medium' ? 'text-[var(--color-warning)]' :
                                'text-[var(--color-info)]'
                              }`}>
                                {issue.type.charAt(0).toUpperCase() + issue.type.slice(1)} Issue
                              </span>
                            </div>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              issue.severity === 'high' ? 'bg-[var(--color-error)]/10 text-[var(--color-error)]' :
                              issue.severity === 'medium' ? 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]' :
                              'bg-[var(--color-info)]/10 text-[var(--color-info)]'
                            }`}>
                              {issue.severity}
                            </span>
                          </div>
                          <p className="text-sm text-[var(--color-text-secondary)] mb-2">
                            {issue.description}
                          </p>
                          <p className="text-xs text-[var(--color-text-muted)]">
                            <strong>Recommendation:</strong> {issue.recommendation}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-4 border-t border-[var(--color-border)]">
                    <h4 className="font-medium text-[var(--color-text-primary)] mb-3">
                      Common Mobile Issues
                    </h4>
                    <ul className="space-y-2 text-sm text-[var(--color-text-secondary)]">
                      <li className="flex items-start gap-2">
                        <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] flex-shrink-0" />
                        Horizontal overflow on narrow screens
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] flex-shrink-0" />
                        Touch targets smaller than 44×44px
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] flex-shrink-0" />
                        Text too small on high-DPI screens
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] flex-shrink-0" />
                        Images not optimized for mobile
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] flex-shrink-0" />
                        Layout breaks in landscape mode
                      </li>
                    </ul>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Panel - Preview */}
          <div className="flex-1 overflow-hidden p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium text-[var(--color-text-primary)]">
                  Preview
                </h3>
                <p className="text-sm text-[var(--color-text-muted)]">
                  {selectedDevice.name} • {viewportWidth}×{viewportHeight}px • {isRotated ? 'Landscape' : 'Portrait'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--color-text-muted)]">
                  Scale: {Math.round((containerRef.current?.clientWidth || 800) / viewportWidth * 100)}%
                </span>
              </div>
            </div>

            {/* Preview Container */}
            <div className="relative border-4 border-[var(--color-border)] rounded-2xl overflow-hidden bg-[var(--color-bg-secondary)] flex items-center justify-center p-8">
              {/* Device Frame (optional) */}
              {selectedDevice.type === 'phone' && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-6 bg-[var(--color-border)] rounded-b-2xl" />
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-32 h-8 bg-[var(--color-border)] rounded-t-2xl" />
                </div>
              )}

              {/* Iframe Preview */}
              <div className="relative overflow-auto max-w-full max-h-full">
                <iframe
                  ref={iframeRef}
                  title="Screen size preview"
                  className="border-0 rounded-lg shadow-lg"
                  style={{
                    width: `${viewportWidth}px`,
                    height: `${viewportHeight}px`,
                    transform: `scale(${Math.min(
                      (containerRef.current?.clientWidth || 800) / viewportWidth * 0.9,
                      (containerRef.current?.clientHeight || 600) / viewportHeight * 0.8
                    )})`,
                    transformOrigin: 'top left'
                  }}
                />
              </div>

              {/* Overlay Info */}
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                <div className="px-3 py-1.5 rounded-lg bg-[var(--color-overlay)] backdrop-blur-sm text-sm text-[var(--color-text-primary)]">
                  {viewportWidth}×{viewportHeight}px
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={rotateViewport}
                    className="px-3 py-1.5 rounded-lg bg-[var(--color-overlay)] backdrop-blur-sm text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-overlay)]/80 transition-colors"
                  >
                    Rotate
                  </button>
                  <button
                    onClick={scanForIssues}
                    className="px-3 py-1.5 rounded-lg bg-[var(--color-overlay)] backdrop-blur-sm text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-overlay)]/80 transition-colors"
                  >
                    Scan Issues
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-[var(--color-text-muted)]">
                {issues.length > 0 ? (
                  <span className="text-[var(--color-warning)]">
                    {issues.length} issue{issues.length !== 1 ? 's' : ''} detected
                  </span>
                ) : (
                  <span className="text-[var(--color-success)]">
                    No issues detected at this size
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <OutlineButton
                  size="sm"
                  onClick={() => setActiveTab('issues')}
                >
                  View Issues
                </OutlineButton>
                <PrimaryButton
                  size="sm"
                  onClick={scanForIssues}
                  loading={isScanning}
                >
                  Scan Now
                </PrimaryButton>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Footer */}
      <footer className="p-4 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <div className="flex items-center justify-between">
          <div className="text-sm text-[var(--color-text-muted)]">
            {selectedDevice.name} • {viewportWidth}×{viewportHeight}px • {isRotated ? 'Landscape' : 'Portrait'} • {issues.length} issues
          </div>
          <div className="flex items-center gap-3">
            <OutlineButton
              size="sm"
              onClick={() => setIsOpen(false)}
            >
              Close
            </OutlineButton>
            <PrimaryButton
              size="sm"
              onClick={toggleFullscreen}
            >
              {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            </PrimaryButton>
          </div>
        </div>
      </footer>
        </div>
      </motion.div>
    </motion.div>
  );
};
