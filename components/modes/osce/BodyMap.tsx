// components/modes/osce/BodyMap.tsx
// Interactive SVG Body Map for Physical Exam

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { BodyRegion, ExamManeuver } from '@/types/osce-enhanced';

interface BodyMapProps {
  onRegionClick: (region: BodyRegion) => void;
  highlightedRegions?: BodyRegion[];
  examinedRegions?: BodyRegion[];
  findingsMap?: Record<BodyRegion, string>;
  size?: 'sm' | 'md' | 'lg';
  view?: 'anterior' | 'posterior';
}

const REGION_PATHS: Record<BodyRegion, { d: string; cx?: number; cy?: number; label: string }> = {
  head: { cx: 100, cy: 30, d: '', label: 'Head' },
  eyes: { cx: 100, cy: 25, d: '', label: 'Eyes' },
  ears: { cx: 100, cy: 35, d: '', label: 'Ears' },
  nose: { cx: 100, cy: 30, d: '', label: 'Nose/Sinuses' },
  throat: { cx: 100, cy: 50, d: '', label: 'Throat' },
  neck: { cx: 100, cy: 60, d: '', label: 'Neck' },
  chest_anterior: { d: 'M 70 80 L 130 80 L 135 140 L 65 140 Z', label: 'Chest (Ant)' },
  chest_posterior: { d: 'M 70 80 L 130 80 L 135 140 L 65 140 Z', label: 'Chest (Post)' },
  heart: { cx: 90, cy: 110, d: '', label: 'Heart' },
  lungs: { cx: 110, cy: 110, d: '', label: 'Lungs' },
  abdomen_ruq: { d: 'M 70 145 L 100 145 L 100 180 L 70 180 Z', label: 'RUQ' },
  abdomen_luq: { d: 'M 100 145 L 130 145 L 130 180 L 100 180 Z', label: 'LUQ' },
  abdomen_rlq: { d: 'M 70 180 L 100 180 L 100 215 L 70 215 Z', label: 'RLQ' },
  abdomen_llq: { d: 'M 100 180 L 130 180 L 130 215 L 100 215 Z', label: 'LLQ' },
  abdomen_epigastric: { d: 'M 85 145 L 115 145 L 115 165 L 85 165 Z', label: 'Epigastric' },
  abdomen_periumbilical: { cx: 100, cy: 180, d: '', label: 'Periumbilical' },
  pelvis: { d: 'M 75 215 L 125 215 L 130 240 L 70 240 Z', label: 'Pelvis' },
  back_upper: { d: 'M 70 80 L 130 80 L 135 120 L 65 120 Z', label: 'Upper Back' },
  back_lower: { d: 'M 70 120 L 130 120 L 130 180 L 70 180 Z', label: 'Lower Back' },
  arm_right: { d: 'M 55 85 L 65 85 L 50 160 L 40 160 Z', label: 'Right Arm' },
  arm_left: { d: 'M 135 85 L 145 85 L 160 160 L 150 160 Z', label: 'Left Arm' },
  hand_right: { cx: 45, cy: 170, d: '', label: 'Right Hand' },
  hand_left: { cx: 155, cy: 170, d: '', label: 'Left Hand' },
  leg_right: { d: 'M 75 240 L 95 240 L 80 340 L 60 340 Z', label: 'Right Leg' },
  leg_left: { d: 'M 105 240 L 125 240 L 140 340 L 120 340 Z', label: 'Left Leg' },
  foot_right: { cx: 70, cy: 350, d: '', label: 'Right Foot' },
  foot_left: { cx: 130, cy: 350, d: '', label: 'Left Foot' },
  skin: { d: '', label: 'Skin (General)' },
  lymph_nodes: { d: '', label: 'Lymph Nodes' },
  neurological: { d: '', label: 'Neurological' },
  musculoskeletal: { d: '', label: 'MSK (General)' },
};

// Common exam maneuvers by region
export const EXAM_MANEUVERS: Record<BodyRegion, ExamManeuver[]> = {
  head: [
    { id: 'inspect_head', name: 'Inspect scalp and hair', category: 'inspection' },
    { id: 'palpate_skull', name: 'Palpate skull', category: 'palpation' },
  ],
  eyes: [
    { id: 'inspect_conjunctiva', name: 'Inspect conjunctivae', category: 'inspection' },
    { id: 'pupillary_reflex', name: 'Test pupillary reflexes', category: 'neurological' },
    { id: 'fundoscopy', name: 'Fundoscopic exam', category: 'inspection' },
    { id: 'visual_acuity', name: 'Visual acuity', category: 'neurological' },
    { id: 'eom', name: 'Extraocular movements', category: 'neurological' },
  ],
  ears: [
    { id: 'otoscopy', name: 'Otoscopy', category: 'inspection' },
    { id: 'rinne_weber', name: 'Rinne/Weber test', category: 'neurological' },
  ],
  nose: [
    { id: 'inspect_nares', name: 'Inspect nasal mucosa', category: 'inspection' },
    { id: 'sinus_palpation', name: 'Palpate sinuses', category: 'palpation' },
  ],
  throat: [
    { id: 'inspect_oropharynx', name: 'Inspect oropharynx', category: 'inspection' },
    { id: 'tonsils', name: 'Examine tonsils', category: 'inspection' },
  ],
  neck: [
    { id: 'inspect_neck', name: 'Inspect neck', category: 'inspection' },
    { id: 'thyroid_palpation', name: 'Palpate thyroid', category: 'palpation' },
    { id: 'lymph_node_neck', name: 'Palpate cervical lymph nodes', category: 'palpation' },
    { id: 'carotid_auscultation', name: 'Auscultate carotids', category: 'auscultation' },
    { id: 'jvd', name: 'Assess JVD', category: 'inspection' },
  ],
  chest_anterior: [
    { id: 'inspect_chest', name: 'Inspect chest wall', category: 'inspection' },
    { id: 'chest_expansion', name: 'Assess chest expansion', category: 'palpation' },
    { id: 'tactile_fremitus', name: 'Tactile fremitus', category: 'palpation' },
    { id: 'chest_percussion', name: 'Percuss chest', category: 'percussion' },
  ],
  chest_posterior: [
    {
      id: 'posterior_lung_auscult',
      name: 'Auscultate posterior lung fields',
      category: 'auscultation',
    },
    { id: 'posterior_percussion', name: 'Percuss posterior chest', category: 'percussion' },
  ],
  heart: [
    { id: 'auscult_aortic', name: 'Auscultate aortic area', category: 'auscultation' },
    { id: 'auscult_pulmonic', name: 'Auscultate pulmonic area', category: 'auscultation' },
    { id: 'auscult_erbs', name: "Auscultate Erb's point", category: 'auscultation' },
    { id: 'auscult_tricuspid', name: 'Auscultate tricuspid area', category: 'auscultation' },
    { id: 'auscult_mitral', name: 'Auscultate mitral/apex', category: 'auscultation' },
    { id: 'pmi', name: 'Palpate PMI', category: 'palpation' },
  ],
  lungs: [
    {
      id: 'auscult_anterior_lungs',
      name: 'Auscultate anterior lung fields',
      category: 'auscultation',
    },
    {
      id: 'auscult_lateral_lungs',
      name: 'Auscultate lateral lung fields',
      category: 'auscultation',
    },
  ],
  abdomen_ruq: [
    { id: 'inspect_ruq', name: 'Inspect RUQ', category: 'inspection' },
    { id: 'palpate_liver', name: 'Palpate liver', category: 'palpation' },
    { id: 'murphy_sign', name: "Murphy's sign", category: 'special_test' },
  ],
  abdomen_luq: [
    { id: 'inspect_luq', name: 'Inspect LUQ', category: 'inspection' },
    { id: 'palpate_spleen', name: 'Palpate spleen', category: 'palpation' },
  ],
  abdomen_rlq: [
    { id: 'inspect_rlq', name: 'Inspect RLQ', category: 'inspection' },
    { id: 'mcburney_palpation', name: "Palpate McBurney's point", category: 'palpation' },
    { id: 'rovsing_sign', name: "Rovsing's sign", category: 'special_test' },
    { id: 'psoas_sign', name: 'Psoas sign', category: 'special_test' },
  ],
  abdomen_llq: [
    { id: 'inspect_llq', name: 'Inspect LLQ', category: 'inspection' },
    { id: 'palpate_llq', name: 'Palpate LLQ', category: 'palpation' },
  ],
  abdomen_epigastric: [
    { id: 'palpate_epigastric', name: 'Palpate epigastric region', category: 'palpation' },
  ],
  abdomen_periumbilical: [
    { id: 'auscult_bowel_sounds', name: 'Auscultate bowel sounds', category: 'auscultation' },
    { id: 'palpate_aorta', name: 'Palpate aorta', category: 'palpation' },
  ],
  pelvis: [
    { id: 'inspect_genitalia', name: 'Inspect external genitalia', category: 'inspection' },
    { id: 'inguinal_lymph', name: 'Palpate inguinal lymph nodes', category: 'palpation' },
  ],
  back_upper: [
    { id: 'cva_tenderness', name: 'CVA tenderness', category: 'palpation' },
    { id: 'spine_palpation', name: 'Palpate thoracic spine', category: 'palpation' },
  ],
  back_lower: [
    { id: 'lumbar_palpation', name: 'Palpate lumbar spine', category: 'palpation' },
    { id: 'si_joint', name: 'SI joint palpation', category: 'palpation' },
    { id: 'slr', name: 'Straight leg raise', category: 'special_test' },
  ],
  arm_right: [
    { id: 'inspect_arm_r', name: 'Inspect right arm', category: 'inspection' },
    { id: 'rom_shoulder_r', name: 'ROM right shoulder', category: 'neurological' },
    { id: 'radial_pulse_r', name: 'Palpate right radial pulse', category: 'palpation' },
  ],
  arm_left: [
    { id: 'inspect_arm_l', name: 'Inspect left arm', category: 'inspection' },
    { id: 'rom_shoulder_l', name: 'ROM left shoulder', category: 'neurological' },
    { id: 'radial_pulse_l', name: 'Palpate left radial pulse', category: 'palpation' },
  ],
  hand_right: [
    { id: 'grip_strength_r', name: 'Test grip strength R', category: 'neurological' },
    { id: 'finger_dexterity_r', name: 'Fine motor R', category: 'neurological' },
  ],
  hand_left: [
    { id: 'grip_strength_l', name: 'Test grip strength L', category: 'neurological' },
    { id: 'finger_dexterity_l', name: 'Fine motor L', category: 'neurological' },
  ],
  leg_right: [
    { id: 'inspect_leg_r', name: 'Inspect right leg', category: 'inspection' },
    { id: 'pedal_pulse_r', name: 'Palpate right pedal pulses', category: 'palpation' },
    { id: 'patellar_reflex_r', name: 'Patellar reflex R', category: 'neurological' },
  ],
  leg_left: [
    { id: 'inspect_leg_l', name: 'Inspect left leg', category: 'inspection' },
    { id: 'pedal_pulse_l', name: 'Palpate left pedal pulses', category: 'palpation' },
    { id: 'patellar_reflex_l', name: 'Patellar reflex L', category: 'neurological' },
  ],
  foot_right: [
    { id: 'babinski_r', name: 'Babinski reflex R', category: 'neurological' },
    { id: 'monofilament_r', name: 'Monofilament test R', category: 'neurological' },
  ],
  foot_left: [
    { id: 'babinski_l', name: 'Babinski reflex L', category: 'neurological' },
    { id: 'monofilament_l', name: 'Monofilament test L', category: 'neurological' },
  ],
  skin: [
    { id: 'skin_inspection', name: 'General skin inspection', category: 'inspection' },
    { id: 'turgor', name: 'Assess skin turgor', category: 'palpation' },
  ],
  lymph_nodes: [{ id: 'lymph_survey', name: 'Lymph node survey', category: 'palpation' }],
  neurological: [
    { id: 'mental_status', name: 'Mental status exam', category: 'neurological' },
    { id: 'cranial_nerves', name: 'Cranial nerve exam', category: 'neurological' },
    { id: 'sensation', name: 'Sensory exam', category: 'neurological' },
    { id: 'coordination', name: 'Coordination (finger-nose)', category: 'neurological' },
    { id: 'gait', name: 'Gait assessment', category: 'neurological' },
    { id: 'romberg', name: 'Romberg test', category: 'neurological' },
  ],
  musculoskeletal: [
    { id: 'msk_survey', name: 'MSK survey', category: 'inspection' },
    { id: 'joint_rom', name: 'Joint ROM assessment', category: 'neurological' },
  ],
};

const SIZE_CONFIGS = {
  sm: { width: 120, height: 220, scale: 0.6 },
  md: { width: 200, height: 360, scale: 1 },
  lg: { width: 280, height: 500, scale: 1.4 },
};

export const BodyMap: React.FC<BodyMapProps> = ({
  onRegionClick,
  highlightedRegions = [],
  examinedRegions = [],
  findingsMap = {},
  size = 'md',
  view = 'anterior',
}) => {
  const [hoveredRegion, setHoveredRegion] = useState<BodyRegion | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<BodyRegion | null>(null);
  const config = SIZE_CONFIGS[size];

  const handleRegionClick = useCallback(
    (region: BodyRegion) => {
      setSelectedRegion(region);
      onRegionClick(region);
    },
    [onRegionClick]
  );

  const getRegionColor = (region: BodyRegion) => {
    if (hoveredRegion === region) return 'var(--color-accent)'; // hover highlight
    if (examinedRegions.includes(region)) {
      return findingsMap[region] ? 'var(--color-data-provisional)' : 'var(--color-data-pass)'; // finding or normal
    }
    // No visual hints for suggested regions - make it harder/more realistic
    return 'var(--color-border)'; // unexamined
  };

  // Simplified body outline SVG
  const bodyOutline =
    view === 'anterior' ? (
      <>
        {/* Head circle */}
        <circle
          cx="100"
          cy="30"
          r="22"
          fill={getRegionColor('head')}
          stroke="var(--color-text-secondary)"
          strokeWidth="1.5"
          onMouseEnter={() => setHoveredRegion('head')}
          onMouseLeave={() => setHoveredRegion(null)}
          onClick={() => handleRegionClick('head')}
          className="cursor-pointer transition-colors"
        />
        {/* Neck */}
        <rect
          x="90"
          y="52"
          width="20"
          height="18"
          rx="3"
          fill={getRegionColor('neck')}
          stroke="var(--color-text-secondary)"
          strokeWidth="1"
          onMouseEnter={() => setHoveredRegion('neck')}
          onMouseLeave={() => setHoveredRegion(null)}
          onClick={() => handleRegionClick('neck')}
          className="cursor-pointer"
        />
        {/* Torso */}
        <path
          d="M 65 70 L 135 70 L 140 85 L 145 85 L 145 145 L 135 145 L 135 215 L 115 215 L 115 220 L 85 220 L 85 215 L 65 215 L 65 145 L 55 145 L 55 85 L 60 85 Z"
          fill={getRegionColor('chest_anterior')}
          stroke="var(--color-text-secondary)"
          strokeWidth="1.5"
          onMouseEnter={() => setHoveredRegion('chest_anterior')}
          onMouseLeave={() => setHoveredRegion(null)}
          onClick={() => handleRegionClick('chest_anterior')}
          className="cursor-pointer"
        />
        {/* Heart region overlay */}
        <circle
          cx="90"
          cy="105"
          r="12"
          fill={getRegionColor('heart')}
          fillOpacity="0.7"
          stroke="var(--color-text-secondary)"
          strokeWidth="1"
          onMouseEnter={() => setHoveredRegion('heart')}
          onMouseLeave={() => setHoveredRegion(null)}
          onClick={() => handleRegionClick('heart')}
          className="cursor-pointer"
        />
        {/* Abdomen quadrants */}
        <rect
          x="70"
          y="145"
          width="30"
          height="35"
          fill={getRegionColor('abdomen_ruq')}
          stroke="var(--color-text-secondary)"
          strokeWidth="0.5"
          onMouseEnter={() => setHoveredRegion('abdomen_ruq')}
          onMouseLeave={() => setHoveredRegion(null)}
          onClick={() => handleRegionClick('abdomen_ruq')}
          className="cursor-pointer"
        />
        <rect
          x="100"
          y="145"
          width="30"
          height="35"
          fill={getRegionColor('abdomen_luq')}
          stroke="var(--color-text-secondary)"
          strokeWidth="0.5"
          onMouseEnter={() => setHoveredRegion('abdomen_luq')}
          onMouseLeave={() => setHoveredRegion(null)}
          onClick={() => handleRegionClick('abdomen_luq')}
          className="cursor-pointer"
        />
        <rect
          x="70"
          y="180"
          width="30"
          height="35"
          fill={getRegionColor('abdomen_rlq')}
          stroke="var(--color-text-secondary)"
          strokeWidth="0.5"
          onMouseEnter={() => setHoveredRegion('abdomen_rlq')}
          onMouseLeave={() => setHoveredRegion(null)}
          onClick={() => handleRegionClick('abdomen_rlq')}
          className="cursor-pointer"
        />
        <rect
          x="100"
          y="180"
          width="30"
          height="35"
          fill={getRegionColor('abdomen_llq')}
          stroke="var(--color-text-secondary)"
          strokeWidth="0.5"
          onMouseEnter={() => setHoveredRegion('abdomen_llq')}
          onMouseLeave={() => setHoveredRegion(null)}
          onClick={() => handleRegionClick('abdomen_llq')}
          className="cursor-pointer"
        />
        {/* Arms */}
        <path
          d="M 55 85 L 40 170 L 50 170 L 65 90 Z"
          fill={getRegionColor('arm_right')}
          stroke="var(--color-text-secondary)"
          strokeWidth="1"
          onMouseEnter={() => setHoveredRegion('arm_right')}
          onMouseLeave={() => setHoveredRegion(null)}
          onClick={() => handleRegionClick('arm_right')}
          className="cursor-pointer"
        />
        <path
          d="M 145 85 L 160 170 L 150 170 L 135 90 Z"
          fill={getRegionColor('arm_left')}
          stroke="var(--color-text-secondary)"
          strokeWidth="1"
          onMouseEnter={() => setHoveredRegion('arm_left')}
          onMouseLeave={() => setHoveredRegion(null)}
          onClick={() => handleRegionClick('arm_left')}
          className="cursor-pointer"
        />
        {/* Hands */}
        <ellipse
          cx="43"
          cy="180"
          rx="8"
          ry="12"
          fill={getRegionColor('hand_right')}
          stroke="var(--color-text-secondary)"
          strokeWidth="1"
          onMouseEnter={() => setHoveredRegion('hand_right')}
          onMouseLeave={() => setHoveredRegion(null)}
          onClick={() => handleRegionClick('hand_right')}
          className="cursor-pointer"
        />
        <ellipse
          cx="157"
          cy="180"
          rx="8"
          ry="12"
          fill={getRegionColor('hand_left')}
          stroke="var(--color-text-secondary)"
          strokeWidth="1"
          onMouseEnter={() => setHoveredRegion('hand_left')}
          onMouseLeave={() => setHoveredRegion(null)}
          onClick={() => handleRegionClick('hand_left')}
          className="cursor-pointer"
        />
        {/* Legs */}
        <path
          d="M 75 220 L 95 220 L 85 340 L 65 340 Z"
          fill={getRegionColor('leg_right')}
          stroke="var(--color-text-secondary)"
          strokeWidth="1"
          onMouseEnter={() => setHoveredRegion('leg_right')}
          onMouseLeave={() => setHoveredRegion(null)}
          onClick={() => handleRegionClick('leg_right')}
          className="cursor-pointer"
        />
        <path
          d="M 105 220 L 125 220 L 135 340 L 115 340 Z"
          fill={getRegionColor('leg_left')}
          stroke="var(--color-text-secondary)"
          strokeWidth="1"
          onMouseEnter={() => setHoveredRegion('leg_left')}
          onMouseLeave={() => setHoveredRegion(null)}
          onClick={() => handleRegionClick('leg_left')}
          className="cursor-pointer"
        />
        {/* Feet */}
        <ellipse
          cx="75"
          cy="352"
          rx="12"
          ry="8"
          fill={getRegionColor('foot_right')}
          stroke="var(--color-text-secondary)"
          strokeWidth="1"
          onMouseEnter={() => setHoveredRegion('foot_right')}
          onMouseLeave={() => setHoveredRegion(null)}
          onClick={() => handleRegionClick('foot_right')}
          className="cursor-pointer"
        />
        <ellipse
          cx="125"
          cy="352"
          rx="12"
          ry="8"
          fill={getRegionColor('foot_left')}
          stroke="var(--color-text-secondary)"
          strokeWidth="1"
          onMouseEnter={() => setHoveredRegion('foot_left')}
          onMouseLeave={() => setHoveredRegion(null)}
          onClick={() => handleRegionClick('foot_left')}
          className="cursor-pointer"
        />
      </>
    ) : (
      // Posterior view (simplified)
      <>
        <circle
          cx="100"
          cy="30"
          r="22"
          fill={getRegionColor('head')}
          stroke="var(--color-text-secondary)"
          strokeWidth="1.5"
          onClick={() => handleRegionClick('head')}
          className="cursor-pointer"
        />
        <rect
          x="65"
          y="70"
          width="70"
          height="60"
          fill={getRegionColor('back_upper')}
          stroke="var(--color-text-secondary)"
          strokeWidth="1"
          onClick={() => handleRegionClick('back_upper')}
          className="cursor-pointer"
        />
        <rect
          x="65"
          y="130"
          width="70"
          height="60"
          fill={getRegionColor('back_lower')}
          stroke="var(--color-text-secondary)"
          strokeWidth="1"
          onClick={() => handleRegionClick('back_lower')}
          className="cursor-pointer"
        />
      </>
    );

  return (
    <div className="relative">
      <svg width={config.width} height={config.height} viewBox="0 0 200 370" className="mx-auto">
        {bodyOutline}
      </svg>

      {/* Tooltip */}
      <AnimatePresence>
        {hoveredRegion && (
          <motion.div
            initial={{ y: 5 }}
            animate={{ y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full mb-2 px-3 py-1.5 bg-data-neutral text-[var(--color-text-inverse)] text-sm rounded-lg shadow-lg whitespace-nowrap"
          >
            {REGION_PATHS[hoveredRegion]?.label || hoveredRegion}
            {findingsMap[hoveredRegion] && <span className="ml-2 text-[var(--color-data-provisional)]">• Finding</span>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BodyMap;
