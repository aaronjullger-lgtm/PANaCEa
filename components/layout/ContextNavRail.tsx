import React from 'react';
import { motion } from 'framer-motion';
import { useNavRailContext } from '@/hooks/useNavRailContext';
import { X, Pill, Beaker, BookOpen } from 'lucide-react';

export const ContextNavRail = () => {
  const { currentContext, relatedModules, clearContext } = useNavRailContext();

  if (!currentContext) {
    return null;
  }

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed top-0 right-0 h-full bg-surface-primary border-l border-border w-72 z-40"
      style={{ top: 'var(--header-height)', height: 'calc(100vh - var(--header-height))' }}
    >
      <div className="p-4 border-b border-border">
        <div className="flex justify-between items-center">
          <h3 className="font-bold">{currentContext.name}</h3>
          <button onClick={clearContext} className="p-1 rounded-full hover:bg-surface-secondary">
            <X size={16} />
          </button>
        </div>
        <p className="text-sm text-text-muted capitalize">{currentContext.type} Context</p>
      </div>
      <div className="p-4">
        <h4 className="font-semibold text-sm mb-2">Related Modules</h4>
        <ul>
          {relatedModules.map((module) => (
            <li key={module.id} className="mb-2">
              <a href={module.href} className="flex items-center p-2 rounded-md hover:bg-surface-secondary">
                {module.type === 'drug' && <Pill size={16} className="mr-2" />}
                {module.type === 'lab' && <Beaker size={16} className="mr-2" />}
                {module.type === 'condition' && <BookOpen size={16} className="mr-2" />}
                <span className="text-sm">{module.label}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
};
