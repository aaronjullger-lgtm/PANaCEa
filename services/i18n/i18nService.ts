/**
 * Internationalization Service
 *
 * Provides comprehensive i18n support for medical education platform
 * Includes translation, locale management, and medical terminology handling
 */

import {
  LanguageCode,
  RegionCode,
  LocaleConfig,
  SUPPORTED_LOCALES,
  getMedicalTermTranslation,
  getLocalizedDrugName,
  formatMedicalValue,
  getLocaleConfig,
} from '@/config/locales';

export interface TranslationDictionary {
  [key: string]: string | TranslationDictionary;
}

export interface I18nConfig {
  /** Default locale */
  defaultLocale: LocaleConfig;
  /** Fallback locale if translation missing */
  fallbackLocale: LocaleConfig;
  /** Enable debug mode */
  debug: boolean;
  /** Cache translations */
  cacheEnabled: boolean;
  /** Auto-detect browser locale */
  autoDetect: boolean;
}

export class I18nService {
  private currentLocale: LocaleConfig;
  private translations: Map<string, TranslationDictionary> = new Map();
  private config: I18nConfig;
  private listeners: Set<(locale: LocaleConfig) => void> = new Set();

  constructor(config?: Partial<I18nConfig>) {
    this.config = {
      defaultLocale: SUPPORTED_LOCALES[0]!, // en-US
      fallbackLocale: SUPPORTED_LOCALES[0]!, // en-US
      debug: process.env.NODE_ENV === 'development',
      cacheEnabled: true,
      autoDetect: true,
      ...config,
    };

    // Initialize with browser locale or default
    this.currentLocale = this.config.autoDetect
      ? this.getBrowserLocale()
      : this.config.defaultLocale;

    // Load core translations
    this.loadCoreTranslations();
  }

  /**
   * Get current locale
   */
  public getCurrentLocale(): LocaleConfig {
    return this.currentLocale;
  }

  /**
   * Get all supported locales
   */
  public getSupportedLocales(): LocaleConfig[] {
    return SUPPORTED_LOCALES;
  }

  /**
   * Set current locale
   */
  public setLocale(language: LanguageCode, region: RegionCode): boolean {
    const locale = getLocaleConfig(language, region);
    if (!locale) {
      if (this.config.debug) {
        console.warn(`Locale ${language}-${region} not supported`);
      }
      return false;
    }

    const previousLocale = this.currentLocale;
    this.currentLocale = locale;

    // Notify listeners
    if (previousLocale.language !== locale.language || previousLocale.region !== locale.region) {
      this.notifyListeners();
    }

    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferredLocale', JSON.stringify({ language, region }));
    }

    if (this.config.debug) {
      console.log(`Locale changed to ${locale.localeString}`);
    }

    return true;
  }

  /**
   * Set locale by locale string (e.g., 'en-US', 'es-ES')
   */
  public setLocaleByString(localeString: string): boolean {
    const [language, region] = localeString.split('-') as [LanguageCode, RegionCode];
    return this.setLocale(language, region);
  }

  /**
   * Translate a key
   */
  public t(key: string, params?: Record<string, string | number>): string {
    const translation = this.getTranslation(key);

    if (!translation) {
      if (this.config.debug) {
        console.warn(`Translation missing for key: ${key}`);
      }
      return key; // Return key as fallback
    }

    // Replace parameters
    if (params) {
      return this.interpolate(translation, params);
    }

    return translation;
  }

  /**
   * Translate medical term
   */
  public translateMedicalTerm(
    term: string,
    targetLanguage?: LanguageCode,
    sourceLanguage?: LanguageCode
  ): string {
    return getMedicalTermTranslation(
      term,
      targetLanguage || this.currentLocale.language,
      sourceLanguage || 'en'
    );
  }

  /**
   * Localize drug name
   */
  public localizeDrugName(drugName: string): string {
    return getLocalizedDrugName(drugName, this.currentLocale);
  }

  /**
   * Format medical value with locale-appropriate units
   */
  public formatMedicalValue(value: number, unit: string): string {
    return formatMedicalValue(value, unit, this.currentLocale);
  }

  /**
   * Format date according to locale
   */
  public formatDate(date: Date | string | number, options?: Intl.DateTimeFormatOptions): string {
    const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;

    const formatter = new Intl.DateTimeFormat(this.currentLocale.localeString, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...options,
    });

    return formatter.format(dateObj);
  }

  /**
   * Format number according to locale
   */
  public formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
    const formatter = new Intl.NumberFormat(this.currentLocale.localeString, options);
    return formatter.format(value);
  }

  /**
   * Subscribe to locale changes
   */
  public subscribe(listener: (locale: LocaleConfig) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Load translations for a specific locale
   */
  public async loadTranslations(locale: LocaleConfig): Promise<void> {
    const localeKey = `${locale.language}-${locale.region}`;

    // Check cache
    if (this.config.cacheEnabled && this.translations.has(localeKey)) {
      return;
    }

    try {
      // In production, this would fetch from API or load from file
      const translations = await this.fetchTranslations(locale);
      this.translations.set(localeKey, translations);

      if (this.config.debug) {
        console.log(`Loaded translations for ${localeKey}`);
      }
    } catch (error) {
      console.error(`Failed to load translations for ${localeKey}:`, error);
    }
  }

  /**
   * Get browser locale
   */
  private getBrowserLocale(): LocaleConfig {
    try {
      if (typeof window === 'undefined') {
        return this.config.defaultLocale;
      }

      // Check localStorage for saved preference
      const saved = localStorage.getItem('preferredLocale');
      if (saved) {
        try {
          const { language, region } = JSON.parse(saved);
          const locale = getLocaleConfig(language, region);
          if (locale) {
            return locale;
          }
        } catch {
          // Invalid saved data
        }
      }

      // Use browser locale
      const browserLocale = navigator.language || 'en-US';
      const [language, region] = browserLocale.split('-') as [LanguageCode, RegionCode];

      const locale = getLocaleConfig(language, region);
      if (locale) {
        return locale;
      }
    } catch (error) {
      console.warn('Failed to detect browser locale:', error);
    }

    return this.config.defaultLocale;
  }

  /**
   * Load core translations
   */
  private loadCoreTranslations(): void {
    // Core UI translations (in production, these would be in separate files)
    const coreTranslations: Record<string, TranslationDictionary> = {
      'en-US': {
        common: {
          loading: 'Loading...',
          error: 'An error occurred',
          retry: 'Retry',
          cancel: 'Cancel',
          save: 'Save',
          delete: 'Delete',
          edit: 'Edit',
          view: 'View',
          search: 'Search',
          filter: 'Filter',
          sort: 'Sort',
          next: 'Next',
          previous: 'Previous',
          submit: 'Submit',
          confirm: 'Confirm',
          close: 'Close',
        },
        navigation: {
          dashboard: 'Dashboard',
          study: 'Study',
          analytics: 'Analytics',
          settings: 'Settings',
          profile: 'Profile',
          help: 'Help',
        },
        medical: {
          diagnosis: 'Diagnosis',
          treatment: 'Treatment',
          symptoms: 'Symptoms',
          medications: 'Medications',
          labs: 'Labs',
          imaging: 'Imaging',
          procedures: 'Procedures',
        },
      },
      'es-ES': {
        common: {
          loading: 'Cargando...',
          error: 'Ocurrió un error',
          retry: 'Reintentar',
          cancel: 'Cancelar',
          save: 'Guardar',
          delete: 'Eliminar',
          edit: 'Editar',
          view: 'Ver',
          search: 'Buscar',
          filter: 'Filtrar',
          sort: 'Ordenar',
          next: 'Siguiente',
          previous: 'Anterior',
          submit: 'Enviar',
          confirm: 'Confirmar',
          close: 'Cerrar',
        },
        navigation: {
          dashboard: 'Panel',
          study: 'Estudio',
          analytics: 'Análisis',
          settings: 'Configuración',
          profile: 'Perfil',
          help: 'Ayuda',
        },
        medical: {
          diagnosis: 'Diagnóstico',
          treatment: 'Tratamiento',
          symptoms: 'Síntomas',
          medications: 'Medicamentos',
          labs: 'Laboratorios',
          imaging: 'Imágenes',
          procedures: 'Procedimientos',
        },
      },
      'fr-FR': {
        common: {
          loading: 'Chargement...',
          error: 'Une erreur est survenue',
          retry: 'Réessayer',
          cancel: 'Annuler',
          save: 'Enregistrer',
          delete: 'Supprimer',
          edit: 'Modifier',
          view: 'Voir',
          search: 'Rechercher',
          filter: 'Filtrer',
          sort: 'Trier',
          next: 'Suivant',
          previous: 'Précédent',
          submit: 'Soumettre',
          confirm: 'Confirmer',
          close: 'Fermer',
        },
        navigation: {
          dashboard: 'Tableau de bord',
          study: 'Étude',
          analytics: 'Analytique',
          settings: 'Paramètres',
          profile: 'Profil',
          help: 'Aide',
        },
        medical: {
          diagnosis: 'Diagnostic',
          treatment: 'Traitement',
          symptoms: 'Symptômes',
          medications: 'Médicaments',
          labs: 'Laboratoires',
          imaging: 'Imagerie',
          procedures: 'Procédures',
        },
      },
    };

    // Load core translations
    Object.entries(coreTranslations).forEach(([localeKey, translations]) => {
      this.translations.set(localeKey, translations);
    });
  }

  /**
   * Fetch translations from API or file
   */
  private async fetchTranslations(locale: LocaleConfig): Promise<TranslationDictionary> {
    const localeKey = `${locale.language}-${locale.region}`;

    // In production, this would be an API call or file import
    // For now, return empty dictionary - translations will be loaded from core
    return {};
  }

  /**
   * Get translation for key
   */
  private getTranslation(key: string): string | null {
    const localeKey = `${this.currentLocale.language}-${this.currentLocale.region}`;
    const translations = this.translations.get(localeKey);

    if (!translations) {
      return null;
    }

    // Navigate nested dictionary (e.g., 'common.loading')
    const keys = key.split('.');
    let current: any = translations;

    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return null;
      }
    }

    return typeof current === 'string' ? current : null;
  }

  /**
   * Interpolate parameters in translation string
   */
  private interpolate(text: string, params: Record<string, string | number>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return params[key] !== undefined ? String(params[key]) : match;
    });
  }

  /**
   * Notify listeners of locale change
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.currentLocale));
  }
}

// Singleton instance
let i18nInstance: I18nService | null = null;

/**
 * Get or create i18n service instance
 */
export function getI18nService(config?: Partial<I18nConfig>): I18nService {
  if (!i18nInstance) {
    i18nInstance = new I18nService(config);
  }
  return i18nInstance;
}

/**
 * Reset i18n service instance (for testing)
 */
export function resetI18nService(): void {
  i18nInstance = null;
}
