/**
 * Internationalization (i18n) Configuration
 *
 * Supports multiple languages and regions for medical education content
 * Includes medical terminology, drug names, and UI translations
 */

export type LanguageCode = 'en' | 'es' | 'fr' | 'de' | 'pt' | 'zh' | 'ja' | 'ko';
export type RegionCode =
  | 'US'
  | 'UK'
  | 'CA'
  | 'AU'
  | 'ES'
  | 'MX'
  | 'FR'
  | 'DE'
  | 'BR'
  | 'CN'
  | 'JP'
  | 'KR';

export interface LocaleConfig {
  /** Language code (ISO 639-1) */
  language: LanguageCode;
  /** Region code (ISO 3166-1 alpha-2) */
  region: RegionCode;
  /** Display name in native language */
  nativeName: string;
  /** Display name in English */
  englishName: string;
  /** Direction of text (ltr or rtl) */
  direction: 'ltr' | 'rtl';
  /** Locale string for formatting */
  localeString: string;
  /** Is this locale fully supported? */
  isFullySupported: boolean;
  /** Medical terminology support level */
  medicalSupport: 'full' | 'partial' | 'basic';
}

export const SUPPORTED_LOCALES: LocaleConfig[] = [
  {
    language: 'en',
    region: 'US',
    nativeName: 'English (US)',
    englishName: 'English (US)',
    direction: 'ltr',
    localeString: 'en-US',
    isFullySupported: true,
    medicalSupport: 'full',
  },
  {
    language: 'en',
    region: 'UK',
    nativeName: 'English (UK)',
    englishName: 'English (UK)',
    direction: 'ltr',
    localeString: 'en-GB',
    isFullySupported: true,
    medicalSupport: 'full',
  },
  {
    language: 'es',
    region: 'ES',
    nativeName: 'Español (España)',
    englishName: 'Spanish (Spain)',
    direction: 'ltr',
    localeString: 'es-ES',
    isFullySupported: true,
    medicalSupport: 'full',
  },
  {
    language: 'es',
    region: 'MX',
    nativeName: 'Español (México)',
    englishName: 'Spanish (Mexico)',
    direction: 'ltr',
    localeString: 'es-MX',
    isFullySupported: true,
    medicalSupport: 'full',
  },
  {
    language: 'fr',
    region: 'FR',
    nativeName: 'Français (France)',
    englishName: 'French (France)',
    direction: 'ltr',
    localeString: 'fr-FR',
    isFullySupported: true,
    medicalSupport: 'full',
  },
  {
    language: 'de',
    region: 'DE',
    nativeName: 'Deutsch (Deutschland)',
    englishName: 'German (Germany)',
    direction: 'ltr',
    localeString: 'de-DE',
    isFullySupported: false,
    medicalSupport: 'partial',
  },
  {
    language: 'pt',
    region: 'BR',
    nativeName: 'Português (Brasil)',
    englishName: 'Portuguese (Brazil)',
    direction: 'ltr',
    localeString: 'pt-BR',
    isFullySupported: false,
    medicalSupport: 'partial',
  },
  {
    language: 'zh',
    region: 'CN',
    nativeName: '中文 (简体)',
    englishName: 'Chinese (Simplified)',
    direction: 'ltr',
    localeString: 'zh-CN',
    isFullySupported: false,
    medicalSupport: 'basic',
  },
  {
    language: 'ja',
    region: 'JP',
    nativeName: '日本語',
    englishName: 'Japanese',
    direction: 'ltr',
    localeString: 'ja-JP',
    isFullySupported: false,
    medicalSupport: 'basic',
  },
];

export interface MedicalTerminology {
  /** English term */
  en: string;
  /** Spanish translation */
  es: string;
  /** French translation */
  fr: string;
  /** German translation */
  de?: string;
  /** Portuguese translation */
  pt?: string;
  /** Chinese translation */
  zh?: string;
  /** Japanese translation */
  ja?: string;
  /** Korean translation */
  ko?: string;
  /** Category (anatomy, symptom, condition, etc.) */
  category: string;
  /** Medical system */
  system?: string;
  /** Notes about translation */
  notes?: string;
}

/**
 * Core medical terminology for internationalization
 * This is a subset - in production, this would be a database table
 */
export const MEDICAL_TERMINOLOGY: MedicalTerminology[] = [
  // Symptoms
  {
    en: 'Chest pain',
    es: 'Dolor de pecho',
    fr: 'Douleur thoracique',
    de: 'Brustschmerzen',
    pt: 'Dor no peito',
    zh: '胸痛',
    ja: '胸痛',
    category: 'symptom',
    system: 'Cardiovascular',
  },
  {
    en: 'Shortness of breath',
    es: 'Falta de aire',
    fr: 'Essoufflement',
    de: 'Kurzatmigkeit',
    pt: 'Falta de ar',
    zh: '呼吸短促',
    ja: '息切れ',
    category: 'symptom',
    system: 'Pulmonary',
  },
  {
    en: 'Headache',
    es: 'Dolor de cabeza',
    fr: 'Mal de tête',
    de: 'Kopfschmerzen',
    pt: 'Dor de cabeça',
    zh: '头痛',
    ja: '頭痛',
    category: 'symptom',
    system: 'Neurological',
  },
  {
    en: 'Fever',
    es: 'Fiebre',
    fr: 'Fièvre',
    de: 'Fieber',
    pt: 'Febre',
    zh: '发烧',
    ja: '発熱',
    category: 'symptom',
    system: 'Infectious Disease',
  },
  {
    en: 'Nausea',
    es: 'Náusea',
    fr: 'Nausée',
    de: 'Übelkeit',
    pt: 'Náusea',
    zh: '恶心',
    ja: '吐き気',
    category: 'symptom',
    system: 'Gastrointestinal',
  },
  {
    en: 'Vomiting',
    es: 'Vómito',
    fr: 'Vomissement',
    de: 'Erbrechen',
    pt: 'Vômito',
    zh: '呕吐',
    ja: '嘔吐',
    category: 'symptom',
    system: 'Gastrointestinal',
  },
  {
    en: 'Diarrhea',
    es: 'Diarrea',
    fr: 'Diarrhée',
    de: 'Durchfall',
    pt: 'Diarréia',
    zh: '腹泻',
    ja: '下痢',
    category: 'symptom',
    system: 'Gastrointestinal',
  },
  {
    en: 'Cough',
    es: 'Tos',
    fr: 'Toux',
    de: 'Husten',
    pt: 'Tosse',
    zh: '咳嗽',
    ja: '咳',
    category: 'symptom',
    system: 'Pulmonary',
  },
  {
    en: 'Dizziness',
    es: 'Mareo',
    fr: 'Vertige',
    de: 'Schwindel',
    pt: 'Tontura',
    zh: '头晕',
    ja: 'めまい',
    category: 'symptom',
    system: 'Neurological',
  },
  {
    en: 'Fatigue',
    es: 'Fatiga',
    fr: 'Fatigue',
    de: 'Müdigkeit',
    pt: 'Fadiga',
    zh: '疲劳',
    ja: '疲労',
    category: 'symptom',
    system: 'General',
  },

  // Anatomy
  {
    en: 'Heart',
    es: 'Corazón',
    fr: 'Cœur',
    de: 'Herz',
    pt: 'Coração',
    zh: '心脏',
    ja: '心臓',
    category: 'anatomy',
    system: 'Cardiovascular',
  },
  {
    en: 'Lung',
    es: 'Pulmón',
    fr: 'Poumon',
    de: 'Lunge',
    pt: 'Pulmão',
    zh: '肺',
    ja: '肺',
    category: 'anatomy',
    system: 'Pulmonary',
  },
  {
    en: 'Liver',
    es: 'Hígado',
    fr: 'Foie',
    de: 'Leber',
    pt: 'Fígado',
    zh: '肝脏',
    ja: '肝臓',
    category: 'anatomy',
    system: 'Gastrointestinal',
  },
  {
    en: 'Kidney',
    es: 'Riñón',
    fr: 'Rein',
    de: 'Niere',
    pt: 'Rim',
    zh: '肾脏',
    ja: '腎臓',
    category: 'anatomy',
    system: 'Renal',
  },
  {
    en: 'Brain',
    es: 'Cerebro',
    fr: 'Cerveau',
    de: 'Gehirn',
    pt: 'Cérebro',
    zh: '大脑',
    ja: '脳',
    category: 'anatomy',
    system: 'Neurological',
  },
  {
    en: 'Stomach',
    es: 'Estómago',
    fr: 'Estomac',
    de: 'Magen',
    pt: 'Estômago',
    zh: '胃',
    ja: '胃',
    category: 'anatomy',
    system: 'Gastrointestinal',
  },

  // Conditions
  {
    en: 'Diabetes',
    es: 'Diabetes',
    fr: 'Diabète',
    de: 'Diabetes',
    pt: 'Diabetes',
    zh: '糖尿病',
    ja: '糖尿病',
    category: 'condition',
    system: 'Endocrine',
  },
  {
    en: 'Hypertension',
    es: 'Hipertensión',
    fr: 'Hypertension',
    de: 'Hypertonie',
    pt: 'Hipertensão',
    zh: '高血压',
    ja: '高血圧',
    category: 'condition',
    system: 'Cardiovascular',
  },
  {
    en: 'Asthma',
    es: 'Asma',
    fr: 'Asthme',
    de: 'Asthma',
    pt: 'Asma',
    zh: '哮喘',
    ja: '喘息',
    category: 'condition',
    system: 'Pulmonary',
  },
  {
    en: 'Pneumonia',
    es: 'Neumonía',
    fr: 'Pneumonie',
    de: 'Lungenentzündung',
    pt: 'Pneumonia',
    zh: '肺炎',
    ja: '肺炎',
    category: 'condition',
    system: 'Pulmonary',
  },
  {
    en: 'Heart attack',
    es: 'Ataque al corazón',
    fr: 'Crise cardiaque',
    de: 'Herzinfarkt',
    pt: 'Ataque cardíaco',
    zh: '心脏病发作',
    ja: '心臓発作',
    category: 'condition',
    system: 'Cardiovascular',
  },
  {
    en: 'Stroke',
    es: 'Accidente cerebrovascular',
    fr: 'Accident vasculaire cérébral',
    de: 'Schlaganfall',
    pt: 'Acidente vascular cerebral',
    zh: '中风',
    ja: '脳卒中',
    category: 'condition',
    system: 'Neurological',
  },
];

/**
 * Get medical term translation
 */
export function getMedicalTermTranslation(
  term: string,
  targetLanguage: LanguageCode = 'en',
  sourceLanguage: LanguageCode = 'en'
): string {
  if (targetLanguage === sourceLanguage) {
    return term;
  }

  const normalizedTerm = term.toLowerCase().trim();
  const terminology = MEDICAL_TERMINOLOGY.find(
    (t) => t[sourceLanguage]?.toLowerCase() === normalizedTerm
  );

  if (terminology && terminology[targetLanguage]) {
    return terminology[targetLanguage];
  }

  // Fallback: return original term
  return term;
}

/**
 * Get all medical terms for a specific category
 */
export function getMedicalTermsByCategory(
  category: string,
  language: LanguageCode = 'en'
): MedicalTerminology[] {
  return MEDICAL_TERMINOLOGY.filter((term) => term.category === category).map((term) => ({
    ...term,
    display: term[language] || term.en,
  }));
}

/**
 * Get locale configuration by language and region
 */
export function getLocaleConfig(
  language: LanguageCode,
  region: RegionCode
): LocaleConfig | undefined {
  return SUPPORTED_LOCALES.find(
    (locale) => locale.language === language && locale.region === region
  );
}

/**
 * Get default locale based on browser settings
 */
export function getBrowserLocale(): LocaleConfig {
  const browserLocale = navigator.language || 'en-US';
  const [language, region] = browserLocale.split('-') as [LanguageCode, RegionCode];

  const locale = getLocaleConfig(language, region);
  if (locale) {
    return locale;
  }

  // Fallback to US English
  return SUPPORTED_LOCALES[0]!;
}

/**
 * Format medical values according to locale
 */
export function formatMedicalValue(value: number, unit: string, locale: LocaleConfig): string {
  // Handle different unit conventions
  if (unit === 'mg/dL' && locale.region === 'UK') {
    // Convert mg/dL to mmol/L for glucose in UK
    if (value > 0) {
      const mmolL = value / 18;
      return `${mmolL.toFixed(1)} mmol/L`;
    }
  }

  // Default formatting
  const formatter = new Intl.NumberFormat(locale.localeString, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  return `${formatter.format(value)} ${unit}`;
}

/**
 * Get drug name localization (extends existing unit-converter functionality)
 */
export function getLocalizedDrugName(drugName: string, locale: LocaleConfig): string {
  // Use existing unit-converter logic for drug names
  const convention = locale.region === 'UK' ? 'uk' : 'us';

  // Import dynamically to avoid circular dependency
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getLocalizedDrugName: getDrugName } = require('@/config/unit-converter');
    return getDrugName(drugName, convention);
  } catch {
    // Fallback if unit-converter not available
    return drugName;
  }
}
