// guidelineRegistry.ts
/**
 * Clinical Guideline Registry
 *
 * Bare-bones registry of evidence-based clinical guidelines. AI generates:
 * - Full guideline summary
 * - Key recommendations
 * - Evidence level
 * - When to apply
 * - Updates and revisions
 */

export interface GuidelineMeta {
  name: string;
  organization: string; // AHA, ACC, USPSTF, CDC, IDSA, etc.
  category: string; // Screening, Treatment, Prevention, Diagnosis
  year?: number; // Year of guideline
}

export const GUIDELINE_REGISTRY: GuidelineMeta[] = [
  // Cardiovascular - AHA/ACC
  { name: 'STEMI Management', organization: 'AHA/ACC', category: 'Treatment', year: 2023 },
  { name: 'Heart Failure Management', organization: 'AHA/ACC', category: 'Treatment', year: 2022 },
  {
    name: 'Atrial Fibrillation Management',
    organization: 'AHA/ACC/HRS',
    category: 'Treatment',
    year: 2023,
  },
  {
    name: 'Hypertension Management (JNC 8)',
    organization: 'JNC',
    category: 'Treatment',
    year: 2014,
  },
  { name: 'Cholesterol Management', organization: 'ACC/AHA', category: 'Treatment', year: 2018 },
  { name: 'Valvular Heart Disease', organization: 'AHA/ACC', category: 'Treatment', year: 2020 },

  // Preventive - USPSTF
  { name: 'Breast Cancer Screening', organization: 'USPSTF', category: 'Screening', year: 2024 },
  {
    name: 'Colorectal Cancer Screening',
    organization: 'USPSTF',
    category: 'Screening',
    year: 2021,
  },
  { name: 'Lung Cancer Screening', organization: 'USPSTF', category: 'Screening', year: 2021 },
  { name: 'Cervical Cancer Screening', organization: 'USPSTF', category: 'Screening', year: 2018 },
  {
    name: 'Prostate Cancer Screening (PSA)',
    organization: 'USPSTF',
    category: 'Screening',
    year: 2018,
  },
  {
    name: 'Abdominal Aortic Aneurysm Screening',
    organization: 'USPSTF',
    category: 'Screening',
    year: 2019,
  },
  { name: 'Osteoporosis Screening', organization: 'USPSTF', category: 'Screening', year: 2018 },
  { name: 'Depression Screening', organization: 'USPSTF', category: 'Screening', year: 2023 },
  { name: 'Diabetes Screening', organization: 'USPSTF', category: 'Screening', year: 2021 },
  { name: 'Hypertension Screening', organization: 'USPSTF', category: 'Screening', year: 2021 },

  // Infectious Disease - CDC/IDSA
  { name: 'Pneumonia Treatment (CAP)', organization: 'IDSA', category: 'Treatment', year: 2019 },
  { name: 'UTI Treatment', organization: 'IDSA', category: 'Treatment', year: 2011 },
  { name: 'HIV Treatment', organization: 'DHHS', category: 'Treatment', year: 2023 },
  { name: 'Tuberculosis Treatment', organization: 'CDC', category: 'Treatment', year: 2016 },
  { name: 'COVID-19 Treatment', organization: 'NIH', category: 'Treatment', year: 2024 },
  {
    name: 'Immunization Schedule (Adult)',
    organization: 'CDC',
    category: 'Prevention',
    year: 2024,
  },
  {
    name: 'Immunization Schedule (Pediatric)',
    organization: 'CDC',
    category: 'Prevention',
    year: 2024,
  },
  { name: 'Influenza Vaccination', organization: 'CDC', category: 'Prevention', year: 2024 },
  { name: 'STI Treatment', organization: 'CDC', category: 'Treatment', year: 2021 },
  {
    name: 'Sepsis Management (Surviving Sepsis)',
    organization: 'Surviving Sepsis Campaign',
    category: 'Treatment',
    year: 2021,
  },

  // Pulmonary
  { name: 'Asthma Management (GINA)', organization: 'GINA', category: 'Treatment', year: 2023 },
  { name: 'COPD Management (GOLD)', organization: 'GOLD', category: 'Treatment', year: 2024 },
  { name: 'Pulmonary Embolism Treatment', organization: 'ACCP', category: 'Treatment', year: 2016 },
  {
    name: 'Community-Acquired Pneumonia',
    organization: 'ATS/IDSA',
    category: 'Treatment',
    year: 2019,
  },

  // Endocrine
  { name: 'Diabetes Management (ADA)', organization: 'ADA', category: 'Treatment', year: 2024 },
  {
    name: 'Thyroid Dysfunction Management',
    organization: 'ATA',
    category: 'Treatment',
    year: 2016,
  },
  { name: 'Osteoporosis Management', organization: 'AACE', category: 'Treatment', year: 2020 },

  // Gastroenterology
  { name: 'GERD Management', organization: 'ACG', category: 'Treatment', year: 2013 },
  { name: 'H. pylori Treatment', organization: 'ACG', category: 'Treatment', year: 2017 },
  { name: 'Inflammatory Bowel Disease', organization: 'ACG', category: 'Treatment', year: 2019 },
  { name: 'Diverticulitis Management', organization: 'AGA', category: 'Treatment', year: 2015 },
  { name: 'Acute Pancreatitis', organization: 'ACG', category: 'Treatment', year: 2013 },

  // Nephrology
  {
    name: 'Chronic Kidney Disease Management',
    organization: 'KDIGO',
    category: 'Treatment',
    year: 2024,
  },
  { name: 'Acute Kidney Injury', organization: 'KDIGO', category: 'Treatment', year: 2012 },

  // Neurology
  { name: 'Stroke Management (Acute)', organization: 'AHA/ASA', category: 'Treatment', year: 2019 },
  { name: 'Seizure/Epilepsy Management', organization: 'AAN', category: 'Treatment', year: 2018 },
  { name: 'Migraine Treatment', organization: 'AAN', category: 'Treatment', year: 2021 },
  {
    name: 'Dementia Screening and Management',
    organization: 'AAN',
    category: 'Treatment',
    year: 2018,
  },

  // Obstetrics
  { name: 'Prenatal Care', organization: 'ACOG', category: 'Prevention', year: 2023 },
  { name: 'Gestational Diabetes', organization: 'ACOG', category: 'Treatment', year: 2018 },
  { name: 'Preeclampsia Management', organization: 'ACOG', category: 'Treatment', year: 2019 },

  // Psychiatry
  {
    name: 'Major Depressive Disorder Treatment',
    organization: 'APA',
    category: 'Treatment',
    year: 2010,
  },
  { name: 'Bipolar Disorder Management', organization: 'APA', category: 'Treatment', year: 2002 },
  { name: 'Schizophrenia Treatment', organization: 'APA', category: 'Treatment', year: 2020 },

  // Emergency Medicine
  { name: 'Acute Coronary Syndrome', organization: 'AHA', category: 'Treatment', year: 2023 },
  { name: 'Cardiac Arrest (ACLS)', organization: 'AHA', category: 'Treatment', year: 2020 },
  {
    name: 'Anaphylaxis Management',
    organization: 'ACAAI/AAAAI',
    category: 'Treatment',
    year: 2020,
  },

  // Anticoagulation
  {
    name: 'Anticoagulation for Atrial Fibrillation',
    organization: 'AHA/ACC',
    category: 'Treatment',
    year: 2023,
  },
  { name: 'VTE Treatment and Prevention', organization: 'ACCP', category: 'Treatment', year: 2016 },
  {
    name: 'Perioperative Anticoagulation',
    organization: 'ACCP',
    category: 'Treatment',
    year: 2012,
  },
];

export function buildGuidelineId(guideline: GuidelineMeta): string {
  return `${guideline.name}_${guideline.organization}_${guideline.year || 'current'}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_');
}
