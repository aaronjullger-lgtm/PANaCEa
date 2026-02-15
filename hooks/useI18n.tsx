/**
 * React hooks for internationalization
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  createContext,
  useContext,
  ReactNode,
} from 'react';
import { getI18nService, I18nService } from '@/services/i18n/i18nService';
import { LanguageCode, RegionCode, LocaleConfig } from '@/config/locales';

/**
 * Main i18n hook
 */
export function useI18n() {
  const [i18n] = useState(() => getI18nService());
  const [locale, setLocale] = useState(i18n.getCurrentLocale());
  const [isLoading, setIsLoading] = useState(false);

  // Subscribe to locale changes
  useEffect(() => {
    const unsubscribe = i18n.subscribe((newLocale) => {
      setLocale(newLocale);
    });

    return unsubscribe;
  }, [i18n]);

  // Load translations for current locale
  useEffect(() => {
    const loadTranslations = async () => {
      setIsLoading(true);
      try {
        await i18n.loadTranslations(locale);
      } catch (error) {
        console.error('Failed to load translations:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTranslations();
  }, [i18n, locale]);

  const changeLocale = useCallback(
    (language: LanguageCode, region: RegionCode) => {
      return i18n.setLocale(language, region);
    },
    [i18n]
  );

  const changeLocaleByString = useCallback(
    (localeString: string) => {
      return i18n.setLocaleByString(localeString);
    },
    [i18n]
  );

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      return i18n.t(key, params);
    },
    [i18n]
  );

  const translateMedicalTerm = useCallback(
    (term: string, targetLanguage?: LanguageCode, sourceLanguage?: LanguageCode) => {
      return i18n.translateMedicalTerm(term, targetLanguage, sourceLanguage);
    },
    [i18n]
  );

  const localizeDrugName = useCallback(
    (drugName: string) => {
      return i18n.localizeDrugName(drugName);
    },
    [i18n]
  );

  const formatMedicalValue = useCallback(
    (value: number, unit: string) => {
      return i18n.formatMedicalValue(value, unit);
    },
    [i18n]
  );

  const formatDate = useCallback(
    (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => {
      return i18n.formatDate(date, options);
    },
    [i18n]
  );

  const formatNumber = useCallback(
    (value: number, options?: Intl.NumberFormatOptions) => {
      return i18n.formatNumber(value, options);
    },
    [i18n]
  );

  const supportedLocales = useMemo(() => i18n.getSupportedLocales(), [i18n]);

  return {
    // State
    locale,
    isLoading,
    supportedLocales,

    // Actions
    changeLocale,
    changeLocaleByString,

    // Translation functions
    t,
    translateMedicalTerm,
    localizeDrugName,
    formatMedicalValue,
    formatDate,
    formatNumber,

    // Service instance (for advanced use)
    i18nService: i18n,
  };
}

/**
 * Hook for translating medical terms
 */
export function useMedicalTranslation() {
  const { translateMedicalTerm, localizeDrugName, formatMedicalValue } = useI18n();

  return {
    translateMedicalTerm,
    localizeDrugName,
    formatMedicalValue,
  };
}

/**
 * Hook for locale switching
 */
export function useLocaleSwitcher() {
  const { locale, changeLocale, changeLocaleByString, supportedLocales } = useI18n();
  const [isChanging, setIsChanging] = useState(false);

  const switchLocale = useCallback(
    async (language: LanguageCode, region: RegionCode) => {
      setIsChanging(true);
      try {
        const success = changeLocale(language, region);
        if (!success) {
          console.warn(`Failed to switch to locale ${language}-${region}`);
        }
        return success;
      } finally {
        setIsChanging(false);
      }
    },
    [changeLocale]
  );

  const switchLocaleByString = useCallback(
    async (localeString: string) => {
      setIsChanging(true);
      try {
        const success = changeLocaleByString(localeString);
        if (!success) {
          console.warn(`Failed to switch to locale ${localeString}`);
        }
        return success;
      } finally {
        setIsChanging(false);
      }
    },
    [changeLocaleByString]
  );

  return {
    currentLocale: locale,
    supportedLocales,
    switchLocale,
    switchLocaleByString,
    isChanging,
  };
}

/**
 * Hook for formatted values
 */
export function useFormattedValues() {
  const { formatDate, formatNumber, formatMedicalValue } = useI18n();

  return {
    formatDate,
    formatNumber,
    formatMedicalValue,
  };
}

/**
 * Higher-order component for withTranslation
 */
export function withTranslation<T extends object>(
  WrappedComponent: React.ComponentType<
    T & { t: (key: string, params?: Record<string, string | number>) => string }
  >
) {
  return function WithTranslationComponent(props: T) {
    const { t } = useI18n();
    return <WrappedComponent {...props} t={t} />;
  };
}

/**
 * Context provider for i18n (alternative to hook)
 */
interface I18nContextType {
  t: (key: string, params?: Record<string, string | number>) => string;
  locale: LocaleConfig;
  changeLocale: (language: LanguageCode, region: RegionCode) => boolean;
  supportedLocales: LocaleConfig[];
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const i18n = useI18n();

  const value: I18nContextType = {
    t: i18n.t,
    locale: i18n.locale,
    changeLocale: i18n.changeLocale,
    supportedLocales: i18n.supportedLocales,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18nContext() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18nContext must be used within an I18nProvider');
  }
  return context;
}
