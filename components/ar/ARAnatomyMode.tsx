/**
 * AR Anatomy Mode
 * Mobile AR experience using ARKit/ARCore for 3D anatomy visualization
 * Phase 15: Requirement 61
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Camera, Info, RotateCcw, Layers, X } from 'lucide-react';

interface ARAnatomyModeProps {
  onClose: () => void;
}

type AnatomyModel = 'heart' | 'lung' | 'brain' | 'kidney';
type ViewMode = 'full' | 'cross-section' | 'layers';

interface ModelAnnotation {
  id: string;
  label: string;
  description: string;
  position: { x: number; y: number };
}

export const ARAnatomyMode: React.FC<ARAnatomyModeProps> = ({ onClose }) => {
  const [isARSupported, setIsARSupported] = useState(false);
  const [isARActive, setIsARActive] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AnatomyModel>('heart');
  const [viewMode, setViewMode] = useState<ViewMode>('full');
  const [showAnnotations, setShowAnnotations] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    checkARSupport();
  }, []);

  const checkARSupport = async () => {
    // Check if device supports camera access and permissions
    try {
      // Check for video input devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasCamera = devices.some(device => device.kind === 'videoinput');
      
      if (!hasCamera) {
        setIsARSupported(false);
        return;
      }

      // Check camera permissions if API is available
      if ('permissions' in navigator) {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
          setIsARSupported(permissionStatus.state !== 'denied');
        } catch {
          // Permissions API might not support camera, assume camera is available
          setIsARSupported(true);
        }
      } else {
        // Permissions API not available, assume camera is available
        setIsARSupported(true);
      }
    } catch (error) {
      console.error('Error checking AR support:', error);
      setIsARSupported(false);
    }
  };

  const startAR = async () => {
    if (!videoRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });

      videoRef.current.srcObject = stream;
      videoRef.current.play();
      setIsARActive(true);
    } catch (error) {
      console.error('Error starting AR:', error);
      alert('Failed to access camera. Please ensure camera permissions are granted.');
    }
  };

  const stopAR = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsARActive(false);
  };

  const toggleViewMode = () => {
    const modes: ViewMode[] = ['full', 'cross-section', 'layers'];
    const currentIndex = modes.indexOf(viewMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setViewMode(modes[nextIndex]);
  };

  const handleClose = () => {
    stopAR();
    onClose();
  };

  const heartAnnotations: ModelAnnotation[] = [
    { id: '1', label: 'Left Ventricle', description: 'Main pumping chamber', position: { x: 45, y: 55 } },
    { id: '2', label: 'Right Ventricle', description: 'Pumps blood to lungs', position: { x: 55, y: 55 } },
    { id: '3', label: 'Aorta', description: 'Main artery from heart', position: { x: 50, y: 30 } },
    { id: '4', label: 'Ventricular Hypertrophy', description: 'Thickened heart wall', position: { x: 40, y: 60 } }
  ];

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white text-xl font-bold">AR Anatomy Explorer</h2>
            <p className="text-gray-300 text-sm">
              Point your camera at a flat surface
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>

      {/* Camera View / AR Canvas */}
      <div className="flex-1 relative">
        {isARActive ? (
          <>
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              playsInline
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full"
            />
            
            {/* AR Model Placeholder (In production, this would be WebGL/Three.js) */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                animate={{
                  scale: [1, 1.05, 1],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{ duration: 4, repeat: Infinity }}
                className="relative"
              >
                {/* Simplified 3D Heart Model Representation */}
                <div className={`w-64 h-64 ${viewMode === 'cross-section' ? 'opacity-75' : ''}`}>
                  <svg viewBox="0 0 200 200" className="w-full h-full">
                    {/* Heart outline */}
                    <path
                      d="M100,170 C100,170 30,120 30,80 C30,50 50,40 70,50 C85,58 100,70 100,70 C100,70 115,58 130,50 C150,40 170,50 170,80 C170,120 100,170 100,170 Z"
                      fill={viewMode === 'full' ? '#ef4444' : 'none'}
                      stroke="#ef4444"
                      strokeWidth="3"
                      className="drop-shadow-2xl"
                    />
                    
                    {/* Cross-section view */}
                    {viewMode === 'cross-section' && (
                      <>
                        <line x1="50" y1="100" x2="150" y2="100" stroke="#fbbf24" strokeWidth="2" strokeDasharray="5,5" />
                        <ellipse cx="80" cy="100" rx="20" ry="25" fill="#dc2626" opacity="0.7" />
                        <ellipse cx="120" cy="100" rx="20" ry="25" fill="#b91c1c" opacity="0.7" />
                      </>
                    )}
                    
                    {/* Layers view */}
                    {viewMode === 'layers' && (
                      <>
                        <path d="M100,170 C100,170 35,120 35,80 C35,55 52,45 70,52 C85,58 100,70 100,70 C100,70 115,58 130,52 C148,45 165,55 165,80 C165,120 100,170 100,170 Z" fill="#ef4444" opacity="0.4" />
                        <path d="M100,165 C100,165 40,118 40,82 C40,58 55,48 70,55 C85,61 100,72 100,72 C100,72 115,61 130,55 C145,48 160,58 160,82 C160,118 100,165 100,165 Z" fill="#dc2626" opacity="0.6" />
                      </>
                    )}
                  </svg>
                </div>

                {/* Annotations */}
                {showAnnotations && selectedModel === 'heart' && (
                  <div className="absolute inset-0">
                    {heartAnnotations.map((annotation) => (
                      <div
                        key={annotation.id}
                        className="absolute"
                        style={{
                          left: `${annotation.position.x}%`,
                          top: `${annotation.position.y}%`,
                          transform: 'translate(-50%, -50%)'
                        }}
                      >
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="relative"
                        >
                          <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />
                          <div className="absolute left-4 top-0 bg-black/90 text-white px-3 py-2 rounded-lg text-xs whitespace-nowrap">
                            <div className="font-bold">{annotation.label}</div>
                            <div className="text-gray-300">{annotation.description}</div>
                          </div>
                        </motion.div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full bg-gradient-to-br from-blue-900 to-purple-900">
            <div className="text-center px-6">
              <Camera className="w-24 h-24 text-white mx-auto mb-6" />
              <h3 className="text-2xl font-bold text-white mb-4">
                {isARSupported ? 'Ready to Explore' : 'AR Not Supported'}
              </h3>
              <p className="text-gray-200 mb-8 max-w-md">
                {isARSupported
                  ? 'Point your camera at a flat surface to project a 3D anatomy model. You can rotate, zoom, and slice through organs.'
                  : 'Your device does not support AR features. Please use a device with a camera.'}
              </p>
              {isARSupported && (
                <button
                  onClick={startAR}
                  className="px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-bold text-lg hover:shadow-2xl transition-all hover:scale-105"
                >
                  Start AR Experience
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Controls (shown when AR is active) */}
      {isARActive && (
        <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 to-transparent p-6">
          <div className="flex justify-around items-center max-w-2xl mx-auto">
            {/* Model Selector */}
            <div className="flex gap-2">
              {(['heart', 'lung', 'brain', 'kidney'] as AnatomyModel[]).map((model) => (
                <button
                  key={model}
                  onClick={() => setSelectedModel(model)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    selectedModel === model
                      ? 'bg-blue-500 text-white'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  {model.charAt(0).toUpperCase() + model.slice(1)}
                </button>
              ))}
            </div>

            {/* View Mode Toggle */}
            <button
              onClick={toggleViewMode}
              className="p-3 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
              title={`View: ${viewMode}`}
            >
              <Layers className="w-6 h-6 text-white" />
            </button>

            {/* Annotations Toggle */}
            <button
              onClick={() => setShowAnnotations(!showAnnotations)}
              className={`p-3 rounded-full transition-colors ${
                showAnnotations ? 'bg-yellow-500' : 'bg-white/20 hover:bg-white/30'
              }`}
              title="Toggle annotations"
            >
              <Info className="w-6 h-6 text-white" />
            </button>

            {/* Reset View */}
            <button
              onClick={() => setViewMode('full')}
              className="p-3 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
              title="Reset view"
            >
              <RotateCcw className="w-6 h-6 text-white" />
            </button>
          </div>

          {/* View Mode Indicator */}
          <div className="text-center mt-4">
            <span className="text-white text-sm bg-black/50 px-4 py-2 rounded-full">
              View Mode: <span className="font-bold capitalize">{viewMode.replace('-', ' ')}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ARAnatomyMode;
