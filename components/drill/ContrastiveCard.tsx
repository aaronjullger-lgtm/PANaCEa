/**
 * Contrastive Card Component
 * 
 * DDx Compare mode with drag-and-drop interface for distinguishing similar conditions.
 * Targets user's confusion pairs for focused practice.
 * 
 * @component
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  closestCenter,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, X, GripVertical, ArrowRight } from 'lucide-react';
import { ContrastiveQuestion, DistinguisherFeature } from '@/services/drill/contrastiveDrill.service';

interface ContrastiveCardProps {
  question: ContrastiveQuestion;
  onAnswer: (isCorrect: boolean, timeMs: number, assignments: Record<string, 1 | 2>) => void;
}

interface FeatureItemProps {
  feature: DistinguisherFeature;
  isDragging?: boolean;
  isAssigned?: boolean;
}

const FeatureItem: React.FC<FeatureItemProps> = ({ feature, isDragging, isAssigned }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: feature.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        flex items-center gap-2 p-3 rounded-lg border-2 bg-white cursor-move
        transition-all duration-200
        ${isDragging ? 'opacity-50 rotate-2' : ''}
        ${isAssigned ? 'border-steel-blue-500 bg-steel-blue-50' : 'border-slate-300 hover:border-steel-blue-400'}
      `}
    >
      <GripVertical className="w-4 h-4 text-slate-400" />
      <span className="text-sm font-medium text-slate-800">{feature.text}</span>
    </div>
  );
};

export const ContrastiveCard: React.FC<ContrastiveCardProps> = ({
  question,
  onAnswer,
}) => {
  const [startTime] = useState<number>(Date.now());
  const [unassignedFeatures, setUnassignedFeatures] = useState<DistinguisherFeature[]>([]);
  const [condition1Features, setCondition1Features] = useState<DistinguisherFeature[]>([]);
  const [condition2Features, setCondition2Features] = useState<DistinguisherFeature[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [result, setResult] = useState<{ correct: number; total: number } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Initialize features
  useEffect(() => {
    setUnassignedFeatures(question.distinguishers);
    setCondition1Features([]);
    setCondition2Features([]);
    setIsSubmitted(false);
    setResult(null);
  }, [question]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeFeature = [
      ...unassignedFeatures,
      ...condition1Features,
      ...condition2Features,
    ].find((f) => f.id === active.id);

    if (!activeFeature) return;

    const targetZone = over.id as string;

    // Remove from current list
    setUnassignedFeatures((prev) => prev.filter((f) => f.id !== activeFeature.id));
    setCondition1Features((prev) => prev.filter((f) => f.id !== activeFeature.id));
    setCondition2Features((prev) => prev.filter((f) => f.id !== activeFeature.id));

    // Add to target list
    if (targetZone === 'unassigned') {
      setUnassignedFeatures((prev) => [...prev, activeFeature]);
    } else if (targetZone === 'condition1') {
      setCondition1Features((prev) => [...prev, activeFeature]);
    } else if (targetZone === 'condition2') {
      setCondition2Features((prev) => [...prev, activeFeature]);
    }
  };

  const handleSubmit = () => {
    const responseTime = Date.now() - startTime;

    // Build assignments
    const assignments: Record<string, 1 | 2> = {};
    condition1Features.forEach((f) => {
      assignments[f.id] = 1;
    });
    condition2Features.forEach((f) => {
      assignments[f.id] = 2;
    });

    // Check correctness
    let correct = 0;
    let total = 0;

    question.distinguishers.forEach((feature) => {
      total++;
      if (assignments[feature.id] === feature.belongsTo) {
        correct++;
      }
    });

    const isCorrect = correct === total;
    setResult({ correct, total });
    setIsSubmitted(true);

    // Callback
    setTimeout(() => {
      onAnswer(isCorrect, responseTime, assignments);
    }, 2000);
  };

  const canSubmit = unassignedFeatures.length === 0 && !isSubmitted;

  const getFeatureClassName = (feature: DistinguisherFeature, assigned?: 1 | 2) => {
    if (!isSubmitted) return '';

    const isCorrect = assigned === feature.belongsTo;
    return isCorrect ? 'border-sage-500 bg-sage-50' : 'border-dusty-rose-500 bg-dusty-rose-50';
  };

  return (
    <div className="w-full max-w-6xl mx-auto bg-white rounded-2xl shadow-xl p-6">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">
          DDx Compare: Distinguish These Conditions
        </h2>
        <p className="text-slate-600">
          Drag each feature to the condition it belongs to
        </p>
      </div>

      {/* Presenting Symptom */}
      <div className="bg-steel-blue-50 border-2 border-steel-blue-300 rounded-xl p-4 mb-6 text-center">
        <span className="text-sm font-medium text-steel-blue-800">Presenting Symptom:</span>
        <p className="text-lg font-semibold text-slate-800 mt-1">{question.symptom}</p>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Unassigned Features Pool */}
          <div className="md:col-span-3">
            <h3 className="text-lg font-semibold text-slate-700 mb-3">
              Distinguishing Features ({unassignedFeatures.length} remaining)
            </h3>
            <SortableContext
              id="unassigned"
              items={unassignedFeatures.map((f) => f.id)}
              strategy={verticalListSortingStrategy}
            >
              <div
                className="min-h-[100px] p-4 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 space-y-2"
                data-zone="unassigned"
              >
                {unassignedFeatures.map((feature) => (
                  <FeatureItem key={feature.id} feature={feature} />
                ))}
                {unassignedFeatures.length === 0 && (
                  <p className="text-center text-slate-400 text-sm">
                    Drag features here from conditions below
                  </p>
                )}
              </div>
            </SortableContext>
          </div>

          {/* Condition 1 Drop Zone */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-4 h-4 rounded-full bg-deep-plum-500" />
              <h3 className="text-lg font-semibold text-slate-700">
                {question.conditions[0]?.name}
              </h3>
            </div>
            <SortableContext
              id="condition1"
              items={condition1Features.map((f) => f.id)}
              strategy={verticalListSortingStrategy}
            >
              <div
                className="min-h-[200px] p-4 rounded-xl border-2 border-deep-plum-300 bg-deep-plum-50 space-y-2"
                data-zone="condition1"
              >
                {condition1Features.map((feature) => (
                  <div key={feature.id} className={getFeatureClassName(feature, 1)}>
                    <FeatureItem feature={feature} isAssigned />
                  </div>
                ))}
                {condition1Features.length === 0 && (
                  <p className="text-center text-slate-400 text-sm py-8">
                    Drop features here
                  </p>
                )}
              </div>
            </SortableContext>
          </div>

          {/* Visual Separator */}
          <div className="hidden md:flex items-center justify-center">
            <ArrowRight className="w-8 h-8 text-slate-300" />
          </div>

          {/* Condition 2 Drop Zone */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-4 h-4 rounded-full bg-muted-amber-500" />
              <h3 className="text-lg font-semibold text-slate-700">
                {question.conditions[1]?.name}
              </h3>
            </div>
            <SortableContext
              id="condition2"
              items={condition2Features.map((f) => f.id)}
              strategy={verticalListSortingStrategy}
            >
              <div
                className="min-h-[200px] p-4 rounded-xl border-2 border-muted-amber-300 bg-muted-amber-50 space-y-2"
                data-zone="condition2"
              >
                {condition2Features.map((feature) => (
                  <div key={feature.id} className={getFeatureClassName(feature, 2)}>
                    <FeatureItem feature={feature} isAssigned />
                  </div>
                ))}
                {condition2Features.length === 0 && (
                  <p className="text-center text-slate-400 text-sm py-8">
                    Drop features here
                  </p>
                )}
              </div>
            </SortableContext>
          </div>
        </div>

        <DragOverlay>
          {activeId ? (
            <div className="p-3 rounded-lg border-2 border-steel-blue-500 bg-white shadow-xl">
              <span className="text-sm font-medium">
                {[...unassignedFeatures, ...condition1Features, ...condition2Features].find(
                  (f) => f.id === activeId
                )?.text}
              </span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Submit Button */}
      <div className="mt-6 flex flex-col items-center gap-4">
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`
            px-8 py-3 rounded-xl font-semibold text-white
            transition-all duration-300 transform
            ${
              canSubmit
                ? 'bg-steel-blue-600 hover:bg-steel-blue-700 hover:scale-105 active:scale-95'
                : 'bg-slate-300 cursor-not-allowed'
            }
          `}
        >
          Submit Answer
        </button>

        {/* Result Display */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`
                flex items-center gap-3 px-6 py-3 rounded-xl text-white font-semibold
                ${result.correct === result.total ? 'bg-sage-600' : 'bg-muted-amber-600'}
              `}
            >
              {result.correct === result.total ? (
                <>
                  <Check className="w-6 h-6" />
                  <span>Perfect! {result.correct}/{result.total} correct</span>
                </>
              ) : (
                <>
                  <X className="w-6 h-6" />
                  <span>{result.correct}/{result.total} correct - Review highlighted features</span>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Metadata */}
      <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between text-sm text-slate-500">
        <span>Difficulty: {question.difficulty}</span>
        {question.system && <span>System: {question.system}</span>}
      </div>
    </div>
  );
};

export default ContrastiveCard;