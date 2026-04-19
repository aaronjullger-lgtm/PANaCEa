import React from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { springs } from '@/config/appViews';
import { Link } from 'react-router-dom';
import { useNavRailContext } from '@/hooks/useNavRailContext';
import { X, Pill, Beaker, BookOpen } from 'lucide-react';

export const ContextNavRail = () => {
  const prefersReducedMotion = useReducedMotion();
  const { currentContext, relatedModules, clearContext } = useNavRailContext();

  if (!currentContext) {
    return null;
  }

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { x: '100%' }}
      animate={{ x: 0 }}
      exit={prefersReducedMotion ? undefined : { x: '100%' }}
      transition={prefersReducedMotion ? { duration: 0 } : springs.snappy}
      className="fixed top-0 right-0 h-full bg-[var(--color-bg-primary)] border-l border-[var(--color-border)] w-72 z-40"
      style={{ top: 'var(--header-height)', height: 'calc(100vh - var(--header-height))' }}
    >
      <div className="p-4 border-b border-[var(--color-border)]">
        <div className="flex justify-between items-center">
          <h3 className="font-bold">{currentContext.name}</h3>
          <button onClick={clearContext} aria-label="Clear context" className="p-1 rounded-full hover:bg-[var(--color-bg-secondary)]">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <p className="text-sm text-[var(--color-text-muted)] capitalize">{currentContext.type} Context</p>
      </div>
      <div className="p-4">
        <h4 className="font-semibold text-sm mb-2">Related Modules</h4>
        <ul>
          {relatedModules.map((module) => (
            <li key={module.id} className="mb-2">
              <Link to={module.href ?? '/'} className="flex items-center p-2 rounded-md hover:bg-[var(--color-bg-secondary)]">
                {module.type === 'drug' && <Pill size={16} className="mr-2" />}
                {module.type === 'lab' && <Beaker size={16} className="mr-2" />}
                {module.type === 'condition' && <BookOpen size={16} className="mr-2" />}
                <span className="text-sm">{module.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
};
