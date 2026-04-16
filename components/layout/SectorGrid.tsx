import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  bodySupportClass,
  sectionHeadingClass,
  surfaceBaseClass,
  surfaceCompactPaddingClass,
  surfaceInteractiveClass,
  surfaceShadowStyle,
} from '@/components/ui/system';

export interface SectorItem {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  path: string;
  color: string;
}

interface SectorGridProps {
  items: SectorItem[];
  onNavigate?: (path: string) => void;
}

/**
 * SectorGrid - Universal navigation component for PANaCEa
 *
 * Design: Clean, modern, data-focused aesthetic for lifelong learning
 * - Professional card layout with subtle hover effects
 * - Clear hierarchy: Icon → Title → Description
 * - Responsive grid (1 → 2 → 3 columns)
 */
export const SectorGrid: React.FC<SectorGridProps> = ({ items, onNavigate }) => {
  const navigate = useNavigate();
  const handleNavigate = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      navigate(path);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {items.map((item, index) => {
        const Icon = item.icon;

        return (
          <motion.button
            key={item.id}
            initial={{ y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            onClick={() => handleNavigate(item.path)}
            className={cn(
              'group relative text-left hover:-translate-y-0.5 hover:border-[var(--color-accent)]/24',
              surfaceBaseClass,
              surfaceCompactPaddingClass,
              surfaceInteractiveClass,
            )}
            style={surfaceShadowStyle}
          >
            {/* Icon Badge */}
            <div className={`inline-flex p-3 ${item.color} rounded-lg mb-4`}>
              <Icon className="w-6 h-6" />
            </div>

            {/* Content */}
            <div className="space-y-2 mb-4">
              <h3 className={sectionHeadingClass}>{item.title}</h3>
              <p className={bodySupportClass}>{item.description}</p>
            </div>

            {/* Arrow Indicator */}
            <div className="flex items-center text-[var(--color-accent)] text-sm font-medium">
              <span className="opacity-0 group-hover:opacity-100 transition-opacity">Go</span>
              <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </div>

            {/* Subtle Background Pattern */}
            <div className="absolute top-0 right-0 w-20 h-20 opacity-0 group-hover:opacity-5 transition-opacity">
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-accent)] to-transparent rounded-full transform translate-x-8 -translate-y-8"></div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
};

export default SectorGrid;
