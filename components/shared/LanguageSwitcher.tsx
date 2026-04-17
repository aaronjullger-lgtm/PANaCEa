import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { InlineSpinner } from '@/components/loading';
import { useLocaleSwitcher } from '@/hooks/useI18n';
import { LocaleConfig } from '@/config/locales';
import StandardButton from './StandardButton';

interface LanguageSwitcherProps {
  /** Placement of the dropdown */
  placement?: 'top' | 'bottom' | 'left' | 'right';
  /** Show full language names or codes */
  showFullNames?: boolean;
  /** Show region flags */
  showFlags?: boolean;
  /** Compact mode */
  compact?: boolean;
  /** Custom class name */
  className?: string;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  placement = 'bottom',
  showFullNames = true,
  showFlags = true,
  compact = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { currentLocale, supportedLocales, switchLocale, isChanging } = useLocaleSwitcher();

  const toggleDropdown = () => setIsOpen(!isOpen);
  const closeDropdown = () => setIsOpen(false);

  const handleLocaleSelect = async (locale: LocaleConfig) => {
    if (locale.language === currentLocale.language && locale.region === currentLocale.region) {
      closeDropdown();
      return;
    }

    const success = await switchLocale(locale.language, locale.region);
    if (success) {
      closeDropdown();
    }
  };

  const getPlacementClasses = () => {
    switch (placement) {
      case 'top':
        return 'bottom-full mb-2';
      case 'left':
        return 'right-full mr-2';
      case 'right':
        return 'left-full ml-2';
      case 'bottom':
      default:
        return 'top-full mt-2';
    }
  };

  const getFlagEmoji = (region: string) => {
    // Convert region code to flag emoji
    const codePoints = region
      .toUpperCase()
      .split('')
      .map((char) => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  };

  const getDisplayName = (locale: LocaleConfig) => {
    if (showFullNames) {
      return locale.nativeName;
    }
    return locale.localeString;
  };

  return (
    <div className={`relative ${className}`}>
      {/* Trigger Button */}
      <StandardButton
        variant="ghost"
        size={compact ? 'sm' : 'md'}
        onClick={toggleDropdown}
        className="flex items-center gap-2"
        aria-label="Change language"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {isChanging ? (
          <InlineSpinner size="sm" />
        ) : (
          <>
            <Globe className="w-4 h-4" />
            {showFullNames && !compact && (
              <span className="hidden sm:inline">{currentLocale.language.toUpperCase()}</span>
            )}
            {!compact && (
              <ChevronDown
                className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              />
            )}
          </>
        )}
      </StandardButton>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40" onClick={closeDropdown} />

            {/* Dropdown Menu */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.15 }}
              className={`absolute z-50 min-w-[240px] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-lg ${getPlacementClasses()}`}
              role="dialog"
              aria-label="Language selection"
            >
              <div className="p-2">
                <div className="px-3 py-2">
                  <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">
                    Select Language
                  </h3>
                  <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                    Medical terminology will be translated where available
                  </p>
                </div>

                <div
                  className="max-h-64 overflow-y-auto"
                  role="listbox"
                  aria-label="Available languages"
                >
                  {supportedLocales.map((locale) => {
                    const isCurrent =
                      locale.language === currentLocale.language &&
                      locale.region === currentLocale.region;
                    const isFullySupported = locale.isFullySupported;

                    return (
                      <button
                        key={`${locale.language}-${locale.region}`}
                        onClick={() => handleLocaleSelect(locale)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm transition-colors ${
                          isCurrent
                            ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                            : 'hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]'
                        }`}
                        role="option"
                        disabled={isChanging}
                      >
                        <div className="flex items-center gap-3">
                          {showFlags && (
                            <span
                              className="text-lg"
                              role="img"
                              aria-label={`${locale.region} flag`}
                            >
                              {getFlagEmoji(locale.region)}
                            </span>
                          )}
                          <div className="text-left">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{getDisplayName(locale)}</span>
                              {!isFullySupported && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]">
                                  Beta
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                              {locale.englishName}
                              {locale.medicalSupport !== 'full' && (
                                <span className="ml-1">
                                  • {locale.medicalSupport} medical support
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {isCurrent ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <div className="w-4 h-4" /> // Spacer for alignment
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Footer */}
                <div className="border-t border-[var(--color-border)] mt-2 pt-2 px-3">
                  <div className="flex items-center justify-between text-xs text-[var(--color-text-tertiary)]">
                    <span>Medical Support:</span>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-[var(--color-success)]"></div>
                        <span>Full</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-[var(--color-warning)]"></div>
                        <span>Partial</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-[var(--color-text-tertiary)]"></div>
                        <span>Basic</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * Compact language switcher for mobile/header
 */
export const CompactLanguageSwitcher: React.FC = () => {
  return <LanguageSwitcher compact showFullNames={false} />;
};

/**
 * Full language switcher with detailed information
 */
export const DetailedLanguageSwitcher: React.FC = () => {
  const { currentLocale } = useLocaleSwitcher();

  return (
    <div className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-[var(--color-text-primary)]">
          Language & Region Settings
        </h3>
        <LanguageSwitcher />
      </div>

      <div className="space-y-3">
        <div className="p-3 rounded-md bg-[var(--color-bg-primary)]">
          <div className="text-sm font-medium text-[var(--color-text-secondary)] mb-1">
            Current Settings
          </div>
          <div className="text-sm text-[var(--color-text-primary)]">
            <div className="flex items-center justify-between">
              <span>Language:</span>
              <span className="font-medium">{currentLocale.nativeName}</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span>Region:</span>
              <span className="font-medium">{currentLocale.region}</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span>Medical Support:</span>
              <span
                className={`font-medium ${
                  currentLocale.medicalSupport === 'full'
                    ? 'text-[var(--color-success)]'
                    : currentLocale.medicalSupport === 'partial'
                      ? 'text-[var(--color-warning)]'
                      : 'text-[var(--color-text-tertiary)]'
                }`}
              >
                {currentLocale.medicalSupport.charAt(0).toUpperCase() +
                  currentLocale.medicalSupport.slice(1)}
              </span>
            </div>
          </div>
        </div>

        <div className="text-xs text-[var(--color-text-tertiary)]">
          <p>
            <strong>Note:</strong> Medical terminology translation quality varies by language. Full
            support includes comprehensive medical vocabulary, drug name localization, and unit
            conversions.
          </p>
        </div>
      </div>
    </div>
  );
};
