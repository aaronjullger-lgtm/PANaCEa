/**
 * EKG Interpreter
 *
 * Structured EKG interpretation assistant:
 * Rhythm, rate, PR, QRS, QT, ST, T-wave → diagnostic interpretation & DDx
 * Rule-based with clinical pearls. Use Knowledge Base for full ECGPattern reference.
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Heart } from 'lucide-react';
import { CalculatorHeader, ClinicalInput, ResetButton, CopyResultButton } from '../calculators/shared';
import type { CalculatorProps } from '../calculators/types';

const RHYTHM_OPTIONS = [
  { value: 'sinus', label: 'Sinus' },
  { value: 'afib', label: 'Atrial fibrillation' },
  { value: 'aflutter', label: 'Atrial flutter' },
  { value: 'svt', label: 'SVT (narrow complex tachycardia)' },
  { value: 'vt', label: 'VT (wide complex tachycardia)' },
  { value: 'brady', label: 'Sinus bradycardia' },
  { value: 'heart_block_1', label: '1° AV block' },
  { value: 'heart_block_2_type1', label: '2° AV block (Mobitz I / Wenckebach)' },
  { value: 'heart_block_2_type2', label: '2° AV block (Mobitz II)' },
  { value: 'heart_block_3', label: '3° AV block (complete heart block)' },
  { value: 'pvc', label: 'PVCs / ectopy' },
  { value: 'other', label: 'Other / Unknown' },
];

const ST_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'elevation', label: 'ST elevation' },
  { value: 'depression', label: 'ST depression' },
  { value: 'tombstones', label: 'Tombstone (STEMI)' },
];

const T_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'inverted', label: 'T-wave inversion' },
  { value: 'peaked', label: 'Peaked T-waves' },
  { value: 'flattened', label: 'Flattened T-waves' },
];

interface EKGInterpretation {
  primaryFinding: string;
  urgency: 'routine' | 'urgent' | 'emergent';
  criteria: string[];
  differential: string[];
  pearls: string[];
  recommendation: string;
}

function interpretEKG(
  rhythm: string,
  rate: number,
  pr: number,
  qrs: number,
  qt: number,
  st: string,
  tWave: string
): EKGInterpretation {
  const findings: EKGInterpretation = {
    primaryFinding: '',
    urgency: 'routine',
    criteria: [],
    differential: [],
    pearls: [],
    recommendation: 'Obtain prior EKGs for comparison. Clinical correlation required.',
  };

  if (!rhythm || rhythm === 'other') {
    findings.primaryFinding = 'Incomplete data';
    findings.recommendation = 'Enter rhythm and key intervals for interpretation.';
    return findings;
  }

  // Rate-based findings
  if (rate > 0) {
    if (rate > 100) findings.criteria.push(`Rate ${rate} bpm (tachycardia)`);
    else if (rate < 60) findings.criteria.push(`Rate ${rate} bpm (bradycardia)`);
    else findings.criteria.push(`Rate ${rate} bpm`);
  }

  // PR interval
  if (pr > 0) {
    if (pr > 200) findings.criteria.push(`Prolonged PR ${pr} ms (1° AV block)`);
    else if (pr < 120) findings.criteria.push(`Short PR ${pr} ms (pre-excitation? WPW?)`);
    else findings.criteria.push(`PR ${pr} ms`);
  }

  // QRS
  if (qrs > 0) {
    if (qrs >= 120) findings.criteria.push(`Wide QRS ${qrs} ms`);
    else findings.criteria.push(`QRS ${qrs} ms`);
  }

  // QT
  if (qt > 0) {
    const qtcMax = 440; // ms, gender-dependent
    if (qt > qtcMax) findings.criteria.push(`Prolonged QTc ${qt} ms`);
    else findings.criteria.push(`QTc ${qt} ms`);
  }

  // Rhythm-specific interpretation
  switch (rhythm) {
    case 'afib':
      findings.primaryFinding = 'Atrial fibrillation';
      findings.urgency = rate > 120 ? 'urgent' : 'routine';
      findings.differential = ['Hypertension', 'CAD', 'HF', 'Thyrotoxicosis', 'EtOH', 'Lone AF'];
      findings.pearls = [
        'Irregularly irregular. No P waves. Check CHA₂DS₂-VASc for anticoagulation.',
      ];
      findings.recommendation =
        'Rate vs rhythm control. Anticoagulation per CHA₂DS₂-VASc. Treat reversible causes.';
      break;
    case 'aflutter':
      findings.primaryFinding = 'Atrial flutter';
      findings.differential = ['Same as AF', 'Post-cardiac surgery', 'Pulmonary disease'];
      findings.pearls = ['Sawtooth flutter waves. Often 2:1 or 4:1 block. Consider ablation.'];
      findings.recommendation =
        'Rate control; anticoagulation. Consider cardioversion or ablation.';
      break;
    case 'svt':
      findings.primaryFinding = 'Narrow complex tachycardia (SVT)';
      findings.urgency = 'urgent';
      findings.differential = [
        'AVNRT',
        'AVRT (WPW)',
        'Atrial tachycardia',
        'Junctional tachycardia',
      ];
      findings.pearls = [
        'Vagal maneuvers, adenosine. If WPW + AF → avoid nodal blockers (use procainamide/amiodarone).',
      ];
      findings.recommendation =
        'Vagal maneuvers first. Adenosine 6→12→12 mg if stable. Cardiovert if unstable.';
      break;
    case 'vt':
      findings.primaryFinding = 'Wide complex tachycardia (presumed VT)';
      findings.urgency = 'emergent';
      findings.differential = ['VT', 'SVT with aberrancy', 'WPW + AF'];
      findings.pearls = [
        'Treat as VT until proven otherwise. Amiodarone or procainamide. Synchronized cardioversion if unstable.',
      ];
      findings.recommendation = 'ACLS protocol. Unstable → immediate synchronized cardioversion.';
      break;
    case 'brady':
      findings.primaryFinding = 'Sinus bradycardia';
      findings.differential = [
        'Athlete',
        'Hypothyroidism',
        'Medications (β-blockers)',
        'Sick sinus',
        'Hypoxia',
      ];
      findings.pearls = ['If symptomatic → atropine, pacing. Check for reversible causes.'];
      findings.recommendation =
        'Symptomatic? Treat underlying cause. Atropine 0.5 mg IV; consider transcutaneous pacing.';
      break;
    case 'heart_block_1':
      findings.primaryFinding = 'First-degree AV block';
      findings.differential = ['Normal variant', 'Medications', 'Lyme', 'Inferior MI'];
      findings.pearls = ['PR > 200 ms. Usually benign. Monitor.'];
      findings.recommendation =
        'Usually no treatment. Avoid aggravating meds. Repeat EKG if symptomatic.';
      break;
    case 'heart_block_2_type1':
      findings.primaryFinding = 'Second-degree AV block (Mobitz I / Wenckebach)';
      findings.differential = ['Inferior MI', 'Increased vagal tone', 'Medications'];
      findings.pearls = ['PR prolongs until dropped beat. Usually AV nodal; often benign.'];
      findings.recommendation = 'Usually transient. If symptomatic → atropine, temporary pacing.';
      break;
    case 'heart_block_2_type2':
      findings.primaryFinding = 'Second-degree AV block (Mobitz II)';
      findings.urgency = 'urgent';
      findings.differential = ['Anterior MI', 'Infranodal', 'Progresses to 3° block'];
      findings.pearls = [
        'Constant PR, sudden dropped beat. Infranodal; often needs permanent pacemaker.',
      ];
      findings.recommendation =
        'Consult cardiology. High risk of complete heart block. Temporary pacing if unstable.';
      break;
    case 'heart_block_3':
      findings.primaryFinding = 'Third-degree AV block (complete heart block)';
      findings.urgency = 'emergent';
      findings.differential = ['Inferior MI', 'Anterior MI', 'Lyme', 'Idiopathic fibrosis'];
      findings.pearls = ['P and QRS dissociated. Escape rhythm (junctional or ventricular).'];
      findings.recommendation =
        'Temporary pacing. Treat reversible causes. Often needs permanent pacemaker.';
      break;
    case 'sinus':
      findings.primaryFinding = 'Sinus rhythm';
      findings.differential = [];
      findings.pearls = [];
      break;
    case 'pvc':
      findings.primaryFinding = 'PVCs / ventricular ectopy';
      findings.differential = ['Benign', 'CAD', 'CMP', 'Electrolytes', 'Caffeine'];
      findings.pearls = ['> 6/min, couplets, R-on-T → higher risk. Echo if concerning.'];
      findings.recommendation =
        'Treat reversible causes. β-blockers if symptomatic. Workup if high burden.';
      break;
    default:
      findings.primaryFinding = rhythm;
  }

  // ST segment
  if (st === 'elevation' || st === 'tombstones') {
    findings.urgency = 'emergent';
    findings.criteria.push('ST elevation');
    findings.differential = ['STEMI', 'Pericarditis', 'BER', 'LV aneurysm', 'Prinzmetal'];
    findings.pearls.push('STEMI: regional, convex, reciprocal changes. Activate cath lab.');
    findings.recommendation =
      'If STEMI criteria met: aspirin, heparin, activate cath lab. Nitrates avoid if inferior+RV.';
  } else if (st === 'depression') {
    findings.urgency = findings.urgency === 'routine' ? 'urgent' : findings.urgency;
    findings.criteria.push('ST depression');
    findings.differential = ['NSTEMI', 'Demand ischemia', 'Digoxin', 'LVH with strain'];
    findings.pearls.push('ST depression in V4–V6, II, aVF → ischemia. Troponin, consider cath.');
  }

  // T-wave
  if (tWave === 'inverted') {
    findings.criteria.push('T-wave inversion');
    findings.differential = [
      ...findings.differential,
      'Ischemia',
      'PE',
      'LVH',
      'HOCM',
      'CNS event',
    ];
  } else if (tWave === 'peaked') {
    findings.criteria.push('Peaked T-waves');
    findings.differential = [...findings.differential, 'Hyperkalemia', 'Early STEMI', 'BER'];
    findings.pearls.push('Peaked T-waves: check K+. Hyperkalemia → narrow base, tall, tented.');
  }

  // Prolonged QT
  if (qt > 440) {
    findings.urgency = findings.urgency === 'routine' ? 'urgent' : findings.urgency;
    findings.differential = [
      ...findings.differential,
      'Drugs (QT-prolonging)',
      'HypoCa',
      'HypoMg',
      'LQTS',
    ];
    findings.pearls.push(
      'Prolonged QT → Torsades risk. Hold QT-prolonging drugs; correct electrolytes.'
    );
  }

  return findings;
}

export const EKGInterpreter: React.FC<CalculatorProps> = ({ onBack }) => {
  const [rhythm, setRhythm] = useState('');
  const [rate, setRate] = useState('');
  const [pr, setPR] = useState('');
  const [qrs, setQRS] = useState('');
  const [qt, setQT] = useState('');
  const [st, setST] = useState('normal');
  const [tWave, setTWave] = useState('normal');

  const interpretation = useMemo(() => {
    const r = parseInt(rate, 10) || 0;
    const prVal = parseInt(pr, 10) || 0;
    const qrsVal = parseInt(qrs, 10) || 0;
    const qtVal = parseInt(qt, 10) || 0;
    return interpretEKG(rhythm, r, prVal, qrsVal, qtVal, st, tWave);
  }, [rhythm, rate, pr, qrs, qt, st, tWave]);

  const hasInput = rhythm || rate || pr || qrs || qt || st !== 'normal' || tWave !== 'normal';

  const urgencyColors = {
    routine: 'border-data-neutral bg-data-neutral/40',
    urgent: 'border-data-provisional bg-data-provisional/40',
    emergent: 'border-data-fail bg-data-fail/40',
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <CalculatorHeader
          title="EKG Interpreter"
          subtitle="Rhythm, rate, PR, QRS, QT, ST, T-wave → diagnostic interpretation & DDx"
          onBack={onBack}
        />
        <div className="flex items-center gap-2">
          <ResetButton onReset={() => { setRhythm(''); setRate(''); setPR(''); setQRS(''); setQT(''); setST('normal'); setTWave('normal'); }} />
          {interpretation && (
            <CopyResultButton getText={() => {
              const lines = [
                `EKG Interpretation`,
                `Rhythm: ${RHYTHM_OPTIONS.find(o => o.value === rhythm)?.label ?? rhythm} | Rate: ${rate || '—'} bpm | PR: ${pr || '—'} ms | QRS: ${qrs || '—'} ms | QT: ${qt || '—'} ms`,
                `ST: ${ST_OPTIONS.find(o => o.value === st)?.label ?? st} | T-wave: ${T_OPTIONS.find(o => o.value === tWave)?.label ?? tWave}`,
                ``,
                `Primary Finding: ${interpretation.primaryFinding}`,
                `Urgency: ${interpretation.urgency.toUpperCase()}`,
                ...(interpretation.criteria.length ? [``, `Criteria:`, ...interpretation.criteria.map(c => `  • ${c}`)] : []),
                ...(interpretation.differential.length ? [``, `Differential: ${interpretation.differential.join(', ')}`] : []),
                ...(interpretation.pearls.length ? [``, `Pearls:`, ...interpretation.pearls.map(p => `  💡 ${p}`)] : []),
                ``,
                `Recommendation: ${interpretation.recommendation}`,
              ];
              return lines.join('\n');
            }} />
          )}
        </div>
      </div>

      <div className="bg-gradient-to-r from-[var(--color-bg-primary)]/40 to-[var(--color-bg-secondary)]/40 border border-[var(--color-border)] rounded-xl p-4">
        <div className="flex items-center gap-3">
          <Heart className="w-6 h-6 text-[var(--color-accent)]" />
          <div className="text-sm text-[var(--color-text-muted)]">
            Enter key EKG findings for rule-based interpretation. For full ECG patterns and DDx, use
            the <strong className="text-[var(--color-text-primary)]">Knowledge Base</strong>{' '}
            Condition Library.
          </div>
        </div>
      </div>

      <div className="bg-[var(--color-bg-primary)]/50 border border-[var(--color-border)] rounded-2xl p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ClinicalInput
            label="Rhythm"
            value={rhythm}
            onChange={setRhythm}
            type="select"
            options={RHYTHM_OPTIONS}
          />
          <ClinicalInput
            label="Rate"
            value={rate}
            onChange={setRate}
            type="number"
            unit="bpm"
            range="60–100"
            placeholder="75"
            min={20}
            max={300}
          />
          <ClinicalInput
            label="PR interval"
            value={pr}
            onChange={setPR}
            type="number"
            unit="ms"
            range="120–200"
            placeholder="160"
            min={80}
            max={400}
          />
          <ClinicalInput
            label="QRS duration"
            value={qrs}
            onChange={setQRS}
            type="number"
            unit="ms"
            range="<120"
            placeholder="100"
            min={60}
            max={250}
          />
          <ClinicalInput
            label="QTc"
            value={qt}
            onChange={setQT}
            type="number"
            unit="ms"
            range="<440"
            placeholder="420"
            min={300}
            max={600}
          />
          <ClinicalInput
            label="ST segment"
            value={st}
            onChange={setST}
            type="select"
            options={ST_OPTIONS}
          />
          <ClinicalInput
            label="T-wave"
            value={tWave}
            onChange={setTWave}
            type="select"
            options={T_OPTIONS}
          />
        </div>
      </div>

      <AnimatePresence>
        {hasInput && interpretation.primaryFinding && (
          <motion.div
            initial={{ y: 20 }}
            animate={{ y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <div className={`rounded-2xl p-6 border-2 ${urgencyColors[interpretation.urgency]}`}>
              <div className="flex items-start gap-4">
                <Activity
                  className={`w-10 h-10 flex-shrink-0 ${
                    interpretation.urgency === 'emergent'
                      ? 'text-data-fail'
                      : interpretation.urgency === 'urgent'
                        ? 'text-data-provisional'
                        : 'text-data-neutral'
                  }`}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xl font-bold text-[var(--color-text-primary)]">
                      {interpretation.primaryFinding}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${
                        interpretation.urgency === 'emergent'
                          ? 'bg-data-fail/20 text-data-fail'
                          : interpretation.urgency === 'urgent'
                            ? 'bg-data-provisional/20 text-data-provisional'
                            : 'bg-data-neutral/20 text-data-neutral'
                      }`}
                    >
                      {interpretation.urgency}
                    </span>
                  </div>
                  {interpretation.criteria.length > 0 && (
                    <ul className="text-sm text-[var(--color-text-secondary)] list-disc list-inside mb-3">
                      {interpretation.criteria.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  )}
                  {interpretation.pearls.map((p, i) => (
                    <p key={i} className="text-sm text-[var(--color-text-muted)] italic mb-1">
                      {p}
                    </p>
                  ))}
                </div>
              </div>
            </div>

            {interpretation.differential.length > 0 && (
              <div className="bg-[var(--color-bg-primary)]/50 border border-[var(--color-border)] rounded-2xl p-6">
                <h4 className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">
                  Differential
                </h4>
                <ul className="list-disc list-inside space-y-1 text-[var(--color-text-secondary)]">
                  {interpretation.differential.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-4">
              <h4 className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
                Recommendation
              </h4>
              <p className="text-[var(--color-text-primary)]">{interpretation.recommendation}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EKGInterpreter;
