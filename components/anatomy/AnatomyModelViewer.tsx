/**
 * AnatomyModelViewer Component
 * 
 * A 3D model viewer for anatomical structures using Three.js/React Three Fiber.
 * Designed to display NIH 3D Print Exchange models with proper citations.
 * 
 * Features:
 * - Interactive 3D model viewing with rotation, zoom, and pan
 * - Structure highlighting and selection
 * - Annotation display
 * - Citation generation
 * - Loading states with skeletons
 */

import React, { Suspense, useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Rotate3D,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Info,
  BookOpen,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Eye,
  EyeOff,
  Layers,
  Settings,
} from 'lucide-react';
import type { AnatomyModel, ModelAnnotation, ViewerConfig, AnatomySystem } from '../../types/anatomy-model';
import { DEFAULT_VIEWER_CONFIG } from '../../types/anatomy-model';
import * as anatomyModelService from '@/services/anatomyModelService';

// Skeleton loader for when 3D libraries are loading
const ModelSkeleton = () => (
  <div className="w-full h-full flex items-center justify-center bg-slate-900/50 rounded-xl">
    <div className="flex flex-col items-center gap-4">
      <div className="w-24 h-24 rounded-full bg-slate-700/50 animate-pulse" />
      <div className="flex flex-col items-center gap-2">
        <div className="h-4 w-32 bg-slate-700/50 rounded animate-pulse" />
        <div className="h-3 w-24 bg-slate-700/50 rounded animate-pulse" />
      </div>
    </div>
  </div>
);

// Placeholder 3D Scene - Will be replaced with actual Three.js when models are added
const Model3DPlaceholder: React.FC<{
  model: AnatomyModel;
  onStructureClick?: (structureName: string) => void;
  highlightedStructures: string[];
  wireframe: boolean;
  autoRotate: boolean;
}> = ({ model, onStructureClick, highlightedStructures, wireframe, autoRotate }) => {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl overflow-hidden">
      <div className="relative">
        {/* Animated placeholder representing 3D model */}
        <motion.div
          className="w-48 h-48 rounded-full bg-gradient-to-br from-emerald-500/30 to-teal-600/30 border-2 border-emerald-500/50 flex items-center justify-center"
          animate={autoRotate ? { rotateY: 360 } : {}}
          transition={autoRotate ? { duration: 10, repeat: Infinity, ease: 'linear' } : {}}
        >
          <div className="text-center">
            <Rotate3D className="w-12 h-12 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm text-slate-300 font-medium">{model.name}</p>
          </div>
        </motion.div>
        
        {/* Structure indicators */}
        <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-center">
          <p className="text-xs text-slate-500">
            {model.structures.length} structures available
          </p>
        </div>
      </div>
      
      {/* Placeholder message */}
      <div className="absolute bottom-4 left-4 right-4 text-center">
        <p className="text-xs text-slate-500 bg-slate-800/80 rounded-lg px-3 py-2">
          3D model loading requires Three.js. Add NIH GLB/GLTF files to /public/models/
        </p>
      </div>
    </div>
  );
};

// Structure list sidebar
const StructureList: React.FC<{
  model: AnatomyModel;
  selectedStructure: string | null;
  highlightedStructures: string[];
  onStructureSelect: (structure: string) => void;
  onStructureHighlight: (structure: string) => void;
}> = ({ model, selectedStructure, highlightedStructures, onStructureSelect, onStructureHighlight }) => {
  return (
    <div className="bg-slate-800/50 rounded-xl p-4 h-full overflow-y-auto">
      <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
        <Layers className="w-4 h-4" />
        Structures ({model.structures.length})
      </h3>
      <div className="space-y-1">
        {model.structures.map((structure) => {
          const isSelected = selectedStructure === structure;
          const isHighlighted = highlightedStructures.includes(structure);
          
          return (
            <button
              key={structure}
              onClick={() => onStructureSelect(structure)}
              className={`
                w-full text-left px-3 py-2 rounded-lg text-sm transition-all
                ${isSelected 
                  ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50' 
                  : isHighlighted
                  ? 'bg-teal-600/20 text-teal-300'
                  : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-300'
                }
              `}
            >
              <span className="capitalize">{structure}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Citation panel
const CitationPanel: React.FC<{
  model: AnatomyModel;
  citationFormat: 'AMA' | 'APA' | 'MLA';
  onFormatChange: (format: 'AMA' | 'APA' | 'MLA') => void;
}> = ({ model, citationFormat, onFormatChange }) => {
  const [copied, setCopied] = useState(false);
  
  const citation = anatomyModelService.generateCitation(model, citationFormat);
  
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(citation);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [citation]);
  
  return (
    <div className="bg-slate-800/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <BookOpen className="w-4 h-4" />
          Citation
        </h3>
        <div className="flex gap-1">
          {(['AMA', 'APA', 'MLA'] as const).map((format) => (
            <button
              key={format}
              onClick={() => onFormatChange(format)}
              className={`
                px-2 py-1 text-xs rounded transition-colors
                ${citationFormat === format
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                }
              `}
            >
              {format}
            </button>
          ))}
        </div>
      </div>
      
      <div className="relative">
        <p className="text-xs text-slate-400 bg-slate-900/50 rounded-lg p-3 pr-10 leading-relaxed">
          {citation}
        </p>
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 p-1.5 rounded-md bg-slate-700/50 hover:bg-slate-700 transition-colors"
          title="Copy citation"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-slate-400" />
          )}
        </button>
      </div>
      
      <div className="mt-3 pt-3 border-t border-slate-700/50">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="px-1.5 py-0.5 bg-slate-700/50 rounded">
            {model.citation.license}
          </span>
          <a 
            href={model.citation.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-emerald-400 hover:text-emerald-300 underline"
          >
            View source
          </a>
        </div>
      </div>
    </div>
  );
};

// Main viewer component props
interface AnatomyModelViewerProps {
  modelId?: string;
  model?: AnatomyModel;
  initialSystem?: AnatomySystem;
  showControls?: boolean;
  showStructureList?: boolean;
  showCitation?: boolean;
  className?: string;
  onStructureSelect?: (structure: string) => void;
  config?: Partial<ViewerConfig>;
}

export const AnatomyModelViewer: React.FC<AnatomyModelViewerProps> = ({
  modelId,
  model: providedModel,
  initialSystem,
  showControls = true,
  showStructureList = true,
  showCitation = true,
  className = '',
  onStructureSelect,
  config: userConfig,
}) => {
  const [model, setModel] = useState<AnatomyModel | null>(providedModel || null);
  const [isLoading, setIsLoading] = useState(!providedModel);
  const [error, setError] = useState<string | null>(null);
  
  // Viewer state
  const [selectedStructure, setSelectedStructure] = useState<string | null>(null);
  const [highlightedStructures, setHighlightedStructures] = useState<string[]>([]);
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [citationFormat, setCitationFormat] = useState<'AMA' | 'APA' | 'MLA'>('AMA');
  
  // Config
  const config = { ...DEFAULT_VIEWER_CONFIG, ...userConfig };
  
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Load model
  useEffect(() => {
    if (providedModel) {
      setModel(providedModel);
      setIsLoading(false);
      return;
    }
    
    if (modelId) {
      setIsLoading(true);
      anatomyModelService.getModel(modelId)
        .then((loadedModel) => {
          if (loadedModel) {
            setModel(loadedModel);
          } else {
            setError('Model not found');
          }
        })
        .catch((err) => {
          setError('Failed to load model');
          console.error('Model load error:', err);
        })
        .finally(() => setIsLoading(false));
    }
  }, [modelId, providedModel]);
  
  // Handle structure selection
  const handleStructureSelect = useCallback((structure: string) => {
    setSelectedStructure(prev => prev === structure ? null : structure);
    onStructureSelect?.(structure);
  }, [onStructureSelect]);
  
  // Handle structure highlight
  const handleStructureHighlight = useCallback((structure: string) => {
    setHighlightedStructures(prev => 
      prev.includes(structure)
        ? prev.filter(s => s !== structure)
        : [...prev, structure]
    );
  }, []);
  
  // Reset view
  const handleResetView = useCallback(() => {
    setSelectedStructure(null);
    setHighlightedStructures([]);
    setWireframe(false);
    setAutoRotate(false);
  }, []);
  
  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);
  
  // Loading state
  if (isLoading) {
    return (
      <div className={`w-full h-96 ${className}`}>
        <ModelSkeleton />
      </div>
    );
  }
  
  // Error state
  if (error || !model) {
    return (
      <div className={`w-full h-96 flex items-center justify-center bg-slate-800/50 rounded-xl ${className}`}>
        <div className="text-center">
          <Info className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400">{error || 'No model selected'}</p>
          <p className="text-sm text-slate-500 mt-1">
            Select an anatomy model to view
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div 
      ref={containerRef}
      className={`bg-slate-900 rounded-xl overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-semibold text-white">{model.name}</h2>
          <p className="text-xs text-slate-400 capitalize">{model.system} System</p>
        </div>
        
        {showControls && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWireframe(prev => !prev)}
              className={`p-2 rounded-lg transition-colors ${
                wireframe ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
              title="Toggle wireframe"
            >
              <Layers className="w-4 h-4" />
            </button>
            <button
              onClick={() => setAutoRotate(prev => !prev)}
              className={`p-2 rounded-lg transition-colors ${
                autoRotate ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
              title="Toggle auto-rotate"
            >
              <Rotate3D className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowAnnotations(prev => !prev)}
              className={`p-2 rounded-lg transition-colors ${
                showAnnotations ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
              title="Toggle annotations"
            >
              {showAnnotations ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
            <button
              onClick={handleResetView}
              className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 transition-colors"
              title="Reset view"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 transition-colors"
              title="Toggle fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>
      
      {/* Main content */}
      <div className="flex h-[500px]">
        {/* 3D Viewer */}
        <div className="flex-1 relative">
          <Suspense fallback={<ModelSkeleton />}>
            <Model3DPlaceholder
              model={model}
              onStructureClick={handleStructureSelect}
              highlightedStructures={highlightedStructures}
              wireframe={wireframe}
              autoRotate={autoRotate}
            />
          </Suspense>
          
          {/* Selected structure info */}
          <AnimatePresence>
            {selectedStructure && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-4 left-4 right-4 bg-slate-800/90 backdrop-blur-sm rounded-xl p-4"
              >
                <h4 className="text-sm font-semibold text-white capitalize mb-1">
                  {selectedStructure}
                </h4>
                <p className="text-xs text-slate-400">
                  Click to learn more about this anatomical structure
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        {/* Sidebar */}
        {showStructureList && (
          <div className="w-64 border-l border-slate-800 p-4 flex flex-col gap-4 overflow-y-auto">
            <StructureList
              model={model}
              selectedStructure={selectedStructure}
              highlightedStructures={highlightedStructures}
              onStructureSelect={handleStructureSelect}
              onStructureHighlight={handleStructureHighlight}
            />
          </div>
        )}
      </div>
      
      {/* Citation */}
      {showCitation && (
        <div className="px-4 pb-4">
          <CitationPanel
            model={model}
            citationFormat={citationFormat}
            onFormatChange={setCitationFormat}
          />
        </div>
      )}
      
      {/* Clinical relevance */}
      {model.clinicalRelevance && model.clinicalRelevance.length > 0 && (
        <div className="px-4 pb-4">
          <div className="bg-slate-800/50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-2">Clinical Relevance</h3>
            <ul className="space-y-1">
              {model.clinicalRelevance.map((item, idx) => (
                <li key={idx} className="text-xs text-slate-400 flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnatomyModelViewer;
