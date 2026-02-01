import React from 'react';
import { Settings, Globe, Beaker, Watch, Lightbulb } from 'lucide-react';
import type { UnitSystem, DrugNamingConvention, UserPreferences } from '@/types';

interface UserPreferencesPanelProps {
  preferences: UserPreferences;
  onUpdate: (preferences: UserPreferences) => void;
}

const UserPreferencesPanel: React.FC<UserPreferencesPanelProps> = ({ preferences, onUpdate }) => {
  const handleUnitSystemChange = (unitSystem: UnitSystem) => {
    onUpdate({ ...preferences, unitSystem });
  };

  const handleDrugNamingChange = (drugNaming: DrugNamingConvention) => {
    onUpdate({ ...preferences, drugNaming });
  };

  const handleSmartWatchToggle = () => {
    onUpdate({ ...preferences, enableSmartWatchSync: !preferences.enableSmartWatchSync });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="w-5 h-5 text-[var(--color-text-muted)]" />
        <h3 className="text-xl font-bold text-[var(--color-text-primary)]">Learning Preferences</h3>
      </div>

      {/* Unit System */}
      <div className="bg-[var(--color-bg-secondary)] rounded-lg p-4 border border-[var(--color-border)]">
        <div className="flex items-start gap-3 mb-3">
          <Beaker className="w-5 h-5 mt-1 text-[var(--color-accent)]" />
          <div className="flex-1">
            <h4 className="font-semibold text-[var(--color-text-primary)]">Laboratory Units</h4>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              Choose between US standard and international (SI) units for lab values
            </p>
          </div>
        </div>

        <div className="flex gap-2 mt-3">
          <button
            onClick={() => handleUnitSystemChange('us')}
            className={`
              flex-1 py-2 px-4 rounded-lg font-medium transition-colors
              ${
                preferences.unitSystem === 'us' || !preferences.unitSystem
                  ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                  : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)]/80'
              }
            `}
          >
            US Standard
            <span className="block text-xs mt-1 opacity-80">mg/dL, g/dL</span>
          </button>
          <button
            onClick={() => handleUnitSystemChange('si')}
            className={`
              flex-1 py-2 px-4 rounded-lg font-medium transition-colors
              ${
                preferences.unitSystem === 'si'
                  ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                  : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)]/80'
              }
            `}
          >
            SI Units
            <span className="block text-xs mt-1 opacity-80">mmol/L, g/L</span>
          </button>
        </div>

        {/* Examples */}
        <div className="mt-3 p-3 bg-[var(--color-bg-tertiary)]/60 rounded text-xs">
          <p className="font-semibold mb-1">Example conversions:</p>
          <ul className="space-y-1 text-[var(--color-text-muted)]">
            <li>• Glucose: {preferences.unitSystem === 'si' ? '5.5 mmol/L' : '100 mg/dL'}</li>
            <li>• Creatinine: {preferences.unitSystem === 'si' ? '88 µmol/L' : '1.0 mg/dL'}</li>
          </ul>
        </div>
      </div>

      {/* Drug Naming Convention */}
      <div className="bg-[var(--color-bg-secondary)] rounded-lg p-4 border border-[var(--color-border)]">
        <div className="flex items-start gap-3 mb-3">
          <Globe className="w-5 h-5 mt-1 text-[var(--color-data-pass)]" />
          <div className="flex-1">
            <h4 className="font-semibold text-[var(--color-text-primary)]">
              Drug Naming Convention
            </h4>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              Select regional drug names (e.g., Acetaminophen vs Paracetamol)
            </p>
          </div>
        </div>

        <div className="space-y-2 mt-3">
          <button
            onClick={() => handleDrugNamingChange('us')}
            className={`
              w-full py-2 px-4 rounded-lg font-medium transition-colors text-left
              ${
                preferences.drugNaming === 'us' || !preferences.drugNaming
                  ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                  : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)]/80'
              }
            `}
          >
            <div>United States (USAN)</div>
            <div className="text-xs mt-1 opacity-80">Acetaminophen, Albuterol, Epinephrine</div>
          </button>
          <button
            onClick={() => handleDrugNamingChange('uk')}
            className={`
              w-full py-2 px-4 rounded-lg font-medium transition-colors text-left
              ${
                preferences.drugNaming === 'uk'
                  ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                  : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)]/80'
              }
            `}
          >
            <div>United Kingdom (BAN)</div>
            <div className="text-xs mt-1 opacity-80">Paracetamol, Salbutamol, Adrenaline</div>
          </button>
          <button
            onClick={() => handleDrugNamingChange('global')}
            className={`
              w-full py-2 px-4 rounded-lg font-medium transition-colors text-left
              ${
                preferences.drugNaming === 'global'
                  ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                  : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)]/80'
              }
            `}
          >
            <div>International (INN)</div>
            <div className="text-xs mt-1 opacity-80">WHO recommended names</div>
          </button>
        </div>
      </div>

      {/* Smart Watch Sync */}
      <div className="bg-[var(--color-bg-secondary)] rounded-lg p-4 border border-[var(--color-border)]">
        <div className="flex items-start gap-3">
          <Watch className="w-5 h-5 mt-1 text-[var(--color-accent)]" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-[var(--color-text-primary)]">
                Smart Watch Integration
              </h4>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.enableSmartWatchSync || false}
                  onChange={handleSmartWatchToggle}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[var(--color-bg-tertiary)] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[var(--color-accent)]/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-[var(--color-bg-primary)] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--color-bg-primary)] after:border-[var(--color-border)] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-accent)]"></div>
              </label>
            </div>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              Sync study progress and exam countdown to Apple Watch or compatible smart watches
            </p>

            {preferences.enableSmartWatchSync && (
              <div className="mt-3 p-3 bg-[var(--color-bg-tertiary)]/60 rounded text-xs">
                <p className="font-semibold text-[var(--color-text-primary)] mb-1">
                  Watch Complications Available:
                </p>
                <ul className="space-y-1 text-[var(--color-text-muted)]">
                  <li>• Days until exam countdown</li>
                  <li>• Daily question goal progress ring</li>
                  <li>• Current study streak</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-4 bg-[var(--color-accent)]/10 rounded-lg border border-[var(--color-accent)]/20">
        <p className="text-sm text-[var(--color-text-secondary)] flex items-start gap-2">
          <Lightbulb className="w-4 h-4 text-[var(--color-data-provisional)] flex-shrink-0 mt-0.5" />
          <span>
            <span className="font-semibold">Tip:</span> Your preferences are saved locally and apply
            to all study modes and questions.
          </span>
        </p>
      </div>
    </div>
  );
};

export default UserPreferencesPanel;
