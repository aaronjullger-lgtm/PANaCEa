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
        <Settings className="w-5 h-5 text-slate-700 dark:text-slate-300" />
        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Learning Preferences</h3>
      </div>

      {/* Unit System */}
      <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
        <div className="flex items-start gap-3 mb-3">
          <Beaker className="w-5 h-5 mt-1 text-blue-600" />
          <div className="flex-1">
            <h4 className="font-semibold text-slate-900 dark:text-white">Laboratory Units</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
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
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
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
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }
            `}
          >
            SI Units
            <span className="block text-xs mt-1 opacity-80">mmol/L, g/L</span>
          </button>
        </div>

        {/* Examples */}
        <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded text-xs">
          <p className="font-semibold mb-1">Example conversions:</p>
          <ul className="space-y-1 text-slate-600 dark:text-slate-400">
            <li>• Glucose: {preferences.unitSystem === 'si' ? '5.5 mmol/L' : '100 mg/dL'}</li>
            <li>• Creatinine: {preferences.unitSystem === 'si' ? '88 µmol/L' : '1.0 mg/dL'}</li>
          </ul>
        </div>
      </div>

      {/* Drug Naming Convention */}
      <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
        <div className="flex items-start gap-3 mb-3">
          <Globe className="w-5 h-5 mt-1 text-green-600" />
          <div className="flex-1">
            <h4 className="font-semibold text-slate-900 dark:text-white">Drug Naming Convention</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
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
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
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
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
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
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }
            `}
          >
            <div>International (INN)</div>
            <div className="text-xs mt-1 opacity-80">WHO recommended names</div>
          </button>
        </div>
      </div>

      {/* Smart Watch Sync */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-start gap-3">
          <Watch className="w-5 h-5 mt-1 text-purple-600" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-gray-900 dark:text-white">
                Smart Watch Integration
              </h4>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.enableSmartWatchSync || false}
                  onChange={handleSmartWatchToggle}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
              </label>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Sync study progress and exam countdown to Apple Watch or compatible smart watches
            </p>

            {preferences.enableSmartWatchSync && (
              <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded text-xs">
                <p className="font-semibold text-purple-900 dark:text-purple-200 mb-1">
                  Watch Complications Available:
                </p>
                <ul className="space-y-1 text-purple-800 dark:text-purple-300">
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
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
        <p className="text-sm text-blue-900 dark:text-blue-200 flex items-start gap-2">
          <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
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
