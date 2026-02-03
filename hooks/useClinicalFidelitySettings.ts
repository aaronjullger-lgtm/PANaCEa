/**
 * Shared clinical fidelity settings (EMR, raw labs, etc.) for Patient Encounter and Settings modal.
 * Persists to localStorage under StorageKeys.CLINICAL_FIDELITY.
 */

import { useState, useCallback, useEffect } from 'react';
import { StorageKeys } from '@/lib/storage/storageRegistry';

export interface ClinicalFidelitySettings {
  emrInterface: boolean;
  writeOrders: boolean;
  rawLabValues: boolean;
  multimediaAuscultation: boolean;
}

const DEFAULT: ClinicalFidelitySettings = {
  emrInterface: false,
  writeOrders: false,
  rawLabValues: false,
  multimediaAuscultation: false,
};

function load(): ClinicalFidelitySettings {
  if (typeof window === 'undefined') return DEFAULT;
  try {
    const saved = localStorage.getItem(StorageKeys.CLINICAL_FIDELITY);
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<ClinicalFidelitySettings>;
      return { ...DEFAULT, ...parsed };
    }
  } catch {
    /* ignore */
  }
  return DEFAULT;
}

export function useClinicalFidelitySettings(): {
  settings: ClinicalFidelitySettings;
  setSettings: React.Dispatch<React.SetStateAction<ClinicalFidelitySettings>>;
  toggle: (key: keyof ClinicalFidelitySettings) => void;
  update: (updates: Partial<ClinicalFidelitySettings>) => void;
} {
  const [settings, setSettings] = useState<ClinicalFidelitySettings>(load);

  useEffect(() => {
    const handler = () => setSettings(load());
    window.addEventListener('storage', handler);
    window.addEventListener('panceai_clinical_fidelity_changed', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('panceai_clinical_fidelity_changed', handler);
    };
  }, []);

  const persist = useCallback((next: ClinicalFidelitySettings) => {
    try {
      localStorage.setItem(StorageKeys.CLINICAL_FIDELITY, JSON.stringify(next));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('panceai_clinical_fidelity_changed'));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(
    (key: keyof ClinicalFidelitySettings) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: !prev[key] };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const update = useCallback(
    (updates: Partial<ClinicalFidelitySettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...updates };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  return { settings, setSettings, toggle, update };
}
