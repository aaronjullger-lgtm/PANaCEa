import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface NeuralLinkLogProps {
  lastTuned: Date;
  reason: string;
  adjustment: 'tighten' | 'loosen';
}

const NeuralLinkLog: React.FC<NeuralLinkLogProps> = ({ lastTuned, reason, adjustment }) => {
  const [displayedLines, setDisplayedLines] = useState<string[]>([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);

  // Generate log lines based on input
  const logLines = [
    '> ANALYZING_USER_PERFORMANCE...',
    `> DETECTED_DRIFT_IN_${reason.toUpperCase().replace(/ /g, '_')}`,
    `> ADJUSTING_FORGETTING_CURVE_PARAMETERS... [${adjustment === 'tighten' ? 'TIGHTENING' : 'LOOSENING'}]`,
    '> OPTIMIZATION_COMPLETE [DONE]',
  ];

  // Typewriter effect
  useEffect(() => {
    if (currentLineIndex < logLines.length) {
      const timer = setTimeout(() => {
        setDisplayedLines((prev) => [...prev, logLines[currentLineIndex]]);
        setCurrentLineIndex((prev) => prev + 1);
      }, 600); // Delay between lines

      return () => clearTimeout(timer);
    } else {
      setIsTyping(false);
    }
  }, [currentLineIndex, logLines]);

  // Calculate time until next optimization (14 hours from lastTuned)
  const getNextOptimization = () => {
    const now = new Date();
    const nextOptimization = new Date(lastTuned.getTime() + 14 * 60 * 60 * 1000);
    const diff = nextOptimization.getTime() - now.getTime();

    if (diff <= 0) return 'Processing...';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m`;
  };

  const [nextOptTime, setNextOptTime] = useState(getNextOptimization());

  // Update countdown every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setNextOptTime(getNextOptimization());
    }, 60000);

    return () => clearInterval(interval);
  }, [lastTuned]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="w-full h-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-slate-700 dark:to-slate-700 border-b border-slate-200 dark:border-slate-600 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                opacity: [1, 0.7, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="w-2 h-2 bg-blue-500 dark:bg-cyan-400 rounded-full shadow-lg shadow-blue-500/50 dark:shadow-cyan-400/50"
            ></motion.div>
            <h3 className="text-sm font-bold text-blue-700 dark:text-cyan-300 tracking-wider font-mono">
              CORTEX OPTIMIZATION ENGINE: ONLINE
            </h3>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">v2.1.4</div>
        </div>
      </div>

      {/* Terminal Body */}
      <div className="p-4 space-y-2 min-h-[180px] font-mono text-sm">
        <AnimatePresence>
          {displayedLines.map((line, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className={`flex items-start gap-2 ${
                line.includes('[DONE]')
                  ? 'text-blue-600 dark:text-cyan-400'
                  : line.includes('[TIGHTENING]') || line.includes('[LOOSENING]')
                    ? 'text-amber-500 dark:text-amber-400'
                    : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <span className="text-blue-500 dark:text-cyan-400">$</span>
              <span className="flex-1">
                {line}
                {index === displayedLines.length - 1 && isTyping && (
                  <motion.span
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                    className="inline-block ml-1"
                  >
                    _
                  </motion.span>
                )}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Loading dots while typing */}
        {isTyping && displayedLines.length < logLines.length && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-1 text-slate-600 dark:text-slate-400"
          >
            <motion.span
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0 }}
            >
              .
            </motion.span>
            <motion.span
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
            >
              .
            </motion.span>
            <motion.span
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
            >
              .
            </motion.span>
          </motion.div>
        )}
      </div>

      {/* Footer Status */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.5 }}
        className="border-t border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-4 py-3"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-blue-500 dark:bg-cyan-400 rounded-full"></div>
            <span className="text-slate-600 dark:text-slate-400">Last Tuned:</span>
            <span className="text-slate-900 dark:text-slate-200">
              {lastTuned.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
            <span className="text-slate-600 dark:text-slate-400">Adjustment:</span>
            <span
              className={`font-semibold ${
                adjustment === 'tighten' ? 'text-orange-400' : 'text-blue-400'
              }`}
            >
              {adjustment === 'tighten' ? '↑ Tighten' : '↓ Loosen'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-blue-500 dark:bg-cyan-400 rounded-full animate-pulse"></div>
            <span className="text-slate-600 dark:text-slate-400">Next Optimization:</span>
            <span className="text-blue-600 dark:text-cyan-400 font-semibold">{nextOptTime}</span>
          </div>
        </div>
      </motion.div>

      {/* Scan line effect */}
      <motion.div
        animate={{
          y: ['0%', '100%'],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'linear',
        }}
        className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/5 dark:via-cyan-400/5 to-transparent h-8 pointer-events-none"
        style={{ mixBlendMode: 'screen' }}
      ></motion.div>
    </motion.div>
  );
};

export default NeuralLinkLog;
