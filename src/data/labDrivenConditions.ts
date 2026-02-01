// src/data/labDrivenConditions.ts
// Top 300 most lab-driven diagnosis conditions for PANCE preparation

/**
 * Conditions that are primarily diagnosed or monitored through laboratory tests
 * Organized by category for generation and selection
 */
export const LAB_DRIVEN_CONDITIONS = [
  // Hematology (40)
  'Iron Deficiency Anemia',
  'Vitamin B12 Deficiency',
  'Folate Deficiency Anemia',
  'Hemolytic Anemia',
  'Sickle Cell Disease',
  'Sickle Cell Crisis',
  'Thalassemia Major',
  'Thalassemia Minor',
  'Polycythemia Vera',
  'Thrombocytopenia',
  'Immune Thrombocytopenic Purpura (ITP)',
  'Thrombotic Thrombocytopenic Purpura (TTP)',
  'Acute Lymphoblastic Leukemia (ALL)',
  'Acute Myeloid Leukemia (AML)',
  'Chronic Lymphocytic Leukemia (CLL)',
  'Chronic Myeloid Leukemia (CML)',
  'Aplastic Anemia',
  'Hemophilia A',
  'Hemophilia B',
  'Von Willebrand Disease',
  'Disseminated Intravascular Coagulation (DIC)',
  'G6PD Deficiency',
  'Hereditary Spherocytosis',
  'Pernicious Anemia',
  'Anemia of Chronic Disease',
  'Myelodysplastic Syndrome',
  'Multiple Myeloma',
  'Waldenstrom Macroglobulinemia',
  'Essential Thrombocythemia',
  'Paroxysmal Nocturnal Hemoglobinuria',
  'Autoimmune Hemolytic Anemia',
  'Cold Agglutinin Disease',
  'Warm Autoimmune Hemolytic Anemia',
  'Methemoglobinemia',
  'Lead Poisoning',
  'Sideroblastic Anemia',
  'Megaloblastic Anemia',
  'Microangiopathic Hemolytic Anemia',
  'Hemochromatosis',
  'Acute Intermittent Porphyria',

  // Metabolic/Endocrine (60)
  'Diabetic Ketoacidosis (DKA)',
  'Hyperosmolar Hyperglycemic State (HHS)',
  'Type 1 Diabetes Mellitus',
  'Type 2 Diabetes Mellitus',
  'Hypoglycemia',
  'Hypothyroidism',
  'Hyperthyroidism',
  'Thyroid Storm',
  'Myxedema Coma',
  'Graves Disease',
  'Hashimoto Thyroiditis',
  'Addison Disease',
  'Cushing Syndrome',
  'Cushing Disease',
  'Primary Hyperaldosteronism (Conn Syndrome)',
  'Pheochromocytoma',
  'Hyperparathyroidism',
  'Hypoparathyroidism',
  'SIADH (Syndrome of Inappropriate ADH)',
  'Diabetes Insipidus',
  'Metabolic Acidosis',
  'Metabolic Alkalosis',
  'Respiratory Acidosis',
  'Respiratory Alkalosis',
  'Hypercalcemia',
  'Hypocalcemia',
  'Tumor Lysis Syndrome',
  'Osteomalacia',
  'Rickets',
  'Vitamin D Deficiency',
  'Acromegaly',
  'Growth Hormone Deficiency',
  'Prolactinoma',
  'Adrenal Insufficiency',
  'Congenital Adrenal Hyperplasia',
  'Hyperglycemia',
  'Insulinoma',
  'Gestational Diabetes',
  'Prediabetes',
  'Hyperthyroidism in Pregnancy',
  'Hypothyroidism in Pregnancy',
  'Polycystic Ovary Syndrome (PCOS)',
  'Hypogonadism',
  'Klinefelter Syndrome',
  'Turner Syndrome',
  'Familial Hypercholesterolemia',
  'Hypertriglyceridemia',
  'Mixed Dyslipidemia',
  'Metabolic Syndrome',
  'Wilson Disease',
  'Phenylketonuria',
  'Galactosemia',
  'Glycogen Storage Disease',
  'Fabry Disease',
  'Gaucher Disease',
  'Maple Syrup Urine Disease',
  'Homocystinuria',
  'Mucopolysaccharidoses',
  'Porphyria Cutanea Tarda',
  'Variegate Porphyria',

  // Renal/Electrolyte (40)
  'Acute Kidney Injury (AKI)',
  'Chronic Kidney Disease (CKD)',
  'End-Stage Renal Disease',
  'Nephrotic Syndrome',
  'Nephritic Syndrome',
  'Glomerulonephritis',
  'IgA Nephropathy',
  'Membranous Nephropathy',
  'Minimal Change Disease',
  'Focal Segmental Glomerulosclerosis',
  'Rapidly Progressive Glomerulonephritis',
  'Goodpasture Syndrome',
  'Alport Syndrome',
  'Diabetic Nephropathy',
  'Hypertensive Nephropathy',
  'Acute Tubular Necrosis',
  'Interstitial Nephritis',
  'Rhabdomyolysis',
  'Hyperkalemia',
  'Hypokalemia',
  'Hypernatremia',
  'Hyponatremia',
  'Hypercalcemia of Malignancy',
  'Milk-Alkali Syndrome',
  'Hypermagnesemia',
  'Hypomagnesemia',
  'Hyperphosphatemia',
  'Hypophosphatemia',
  'Renal Tubular Acidosis Type 1',
  'Renal Tubular Acidosis Type 2',
  'Renal Tubular Acidosis Type 4',
  'Bartter Syndrome',
  'Gitelman Syndrome',
  'Liddle Syndrome',
  'Fanconi Syndrome',
  'Contrast-Induced Nephropathy',
  'Hepatorenal Syndrome',
  'Polycystic Kidney Disease',
  'Medullary Sponge Kidney',
  'Renal Cell Carcinoma',

  // Hepatic (30)
  'Acute Hepatitis A',
  'Acute Hepatitis B',
  'Acute Hepatitis C',
  'Chronic Hepatitis B',
  'Chronic Hepatitis C',
  'Autoimmune Hepatitis',
  'Primary Biliary Cholangitis',
  'Primary Sclerosing Cholangitis',
  'Alcoholic Hepatitis',
  'Alcoholic Liver Disease',
  'Non-Alcoholic Fatty Liver Disease (NAFLD)',
  'Non-Alcoholic Steatohepatitis (NASH)',
  'Cirrhosis',
  'Hepatic Encephalopathy',
  'Acute Liver Failure',
  'Drug-Induced Liver Injury',
  'Acetaminophen Toxicity',
  'Gilbert Syndrome',
  'Crigler-Najjar Syndrome',
  'Dubin-Johnson Syndrome',
  'Rotor Syndrome',
  'Budd-Chiari Syndrome',
  'Portal Vein Thrombosis',
  'Hemochromatosis',
  'Alpha-1 Antitrypsin Deficiency',
  'Wilson Disease',
  'Hepatocellular Carcinoma',
  'Cholangiocarcinoma',
  'Cholestasis',
  'Intrahepatic Cholestasis of Pregnancy',

  // Cardiac (20)
  'Acute Myocardial Infarction (STEMI)',
  'Non-ST Elevation Myocardial Infarction (NSTEMI)',
  'Unstable Angina',
  'Acute Coronary Syndrome',
  'Heart Failure',
  'Acute Decompensated Heart Failure',
  'Myocarditis',
  'Pericarditis',
  'Endocarditis',
  'Pulmonary Embolism',
  'Deep Vein Thrombosis',
  'Atrial Fibrillation',
  'Dilated Cardiomyopathy',
  'Hypertrophic Cardiomyopathy',
  'Restrictive Cardiomyopathy',
  'Cardiac Tamponade',
  'Aortic Dissection',
  'Atherosclerosis',
  'Hyperlipidemia',
  'Familial Hypercholesterolemia',

  // Infectious Disease (40)
  'Sepsis',
  'Septic Shock',
  'Bacterial Meningitis',
  'Viral Meningitis',
  'Encephalitis',
  'HIV/AIDS',
  'Opportunistic Infections in HIV',
  'Pneumocystis Jirovecii Pneumonia',
  'Tuberculosis',
  'Latent Tuberculosis Infection',
  'Acute Infectious Mononucleosis',
  'Cytomegalovirus (CMV) Infection',
  'Toxoplasmosis',
  'Malaria',
  'Lyme Disease',
  'Rocky Mountain Spotted Fever',
  'Ehrlichiosis',
  'Babesiosis',
  'Syphilis',
  'Gonorrhea',
  'Chlamydia',
  'Pelvic Inflammatory Disease',
  'Urinary Tract Infection',
  'Pyelonephritis',
  'Prostatitis',
  'Bacterial Pneumonia',
  'Atypical Pneumonia',
  'Legionnaires Disease',
  'Influenza',
  'COVID-19',
  'Hepatitis A',
  'Hepatitis B',
  'Hepatitis C',
  'Hepatitis D',
  'Hepatitis E',
  'Infectious Gastroenteritis',
  'Clostridioides Difficile Infection',
  'Helicobacter Pylori Infection',
  'Cellulitis',
  'Osteomyelitis',

  // Rheumatologic/Autoimmune (25)
  'Rheumatoid Arthritis',
  'Systemic Lupus Erythematosus (SLE)',
  'Sjogren Syndrome',
  'Systemic Sclerosis (Scleroderma)',
  'Mixed Connective Tissue Disease',
  'Polymyositis',
  'Dermatomyositis',
  'Antiphospholipid Syndrome',
  'Granulomatosis with Polyangiitis (Wegener)',
  'Microscopic Polyangiitis',
  'Eosinophilic Granulomatosis with Polyangiitis (Churg-Strauss)',
  'Polyarteritis Nodosa',
  'Giant Cell Arteritis',
  'Takayasu Arteritis',
  'Henoch-Schonlein Purpura',
  'Kawasaki Disease',
  'Behcet Disease',
  'Adult-Onset Still Disease',
  'Polymyalgia Rheumatica',
  'Ankylosing Spondylitis',
  'Reactive Arthritis',
  'Psoriatic Arthritis',
  'Gout',
  'Pseudogout (CPPD)',
  'Celiac Disease',

  // Gastrointestinal (20)
  'Acute Pancreatitis',
  'Chronic Pancreatitis',
  'Pancreatic Insufficiency',
  'Inflammatory Bowel Disease',
  'Crohn Disease',
  'Ulcerative Colitis',
  'Celiac Disease',
  'Lactose Intolerance',
  'Malabsorption Syndrome',
  'Tropical Sprue',
  'Whipple Disease',
  'Gastroparesis',
  'Gastroesophageal Reflux Disease (GERD)',
  'Peptic Ulcer Disease',
  'Zollinger-Ellison Syndrome',
  'Colorectal Cancer',
  'Pancreatic Cancer',
  'Gastric Cancer',
  'Esophageal Cancer',
  'Small Intestinal Bacterial Overgrowth (SIBO)',

  // Oncology (15)
  'Breast Cancer',
  'Lung Cancer',
  'Prostate Cancer',
  'Colorectal Cancer',
  'Pancreatic Cancer',
  'Hepatocellular Carcinoma',
  'Ovarian Cancer',
  'Cervical Cancer',
  'Endometrial Cancer',
  'Renal Cell Carcinoma',
  'Bladder Cancer',
  'Testicular Cancer',
  'Thyroid Cancer',
  'Lymphoma (Hodgkin)',
  'Lymphoma (Non-Hodgkin)',

  // Toxicology (10)
  'Acetaminophen Overdose',
  'Salicylate Toxicity',
  'Methanol Poisoning',
  'Ethylene Glycol Poisoning',
  'Carbon Monoxide Poisoning',
  'Lead Poisoning',
  'Mercury Poisoning',
  'Iron Overdose',
  'Lithium Toxicity',
  'Digoxin Toxicity',
];

/**
 * Get conditions by category for targeted generation
 */
export function getConditionsByCategory(category: string): string[] {
  // This is a simplified version - could be enhanced with explicit categorization
  return LAB_DRIVEN_CONDITIONS.filter((condition) => {
    const lowerCondition = condition.toLowerCase();
    const lowerCategory = category.toLowerCase();

    switch (lowerCategory) {
      case 'hematology':
        return (
          lowerCondition.includes('anemia') ||
          lowerCondition.includes('leukemia') ||
          lowerCondition.includes('thrombocyt') ||
          lowerCondition.includes('hemophilia') ||
          lowerCondition.includes('polycythemia') ||
          lowerCondition.includes('sickle') ||
          lowerCondition.includes('thalassemia') ||
          lowerCondition.includes('myeloma')
        );
      case 'metabolic':
      case 'endocrine':
        return (
          lowerCondition.includes('diabetes') ||
          lowerCondition.includes('thyroid') ||
          lowerCondition.includes('acidosis') ||
          lowerCondition.includes('alkalosis') ||
          lowerCondition.includes('addison') ||
          lowerCondition.includes('cushing') ||
          lowerCondition.includes('calcium') ||
          lowerCondition.includes('parathyroid')
        );
      case 'renal':
        return (
          lowerCondition.includes('kidney') ||
          lowerCondition.includes('renal') ||
          lowerCondition.includes('nephro') ||
          lowerCondition.includes('kalemia') ||
          lowerCondition.includes('natremia') ||
          lowerCondition.includes('glomerulo')
        );
      case 'hepatic':
        return (
          lowerCondition.includes('hepat') ||
          lowerCondition.includes('liver') ||
          lowerCondition.includes('cirrhosis') ||
          lowerCondition.includes('cholang')
        );
      case 'cardiac':
        return (
          lowerCondition.includes('myocardial') ||
          lowerCondition.includes('heart') ||
          lowerCondition.includes('cardiac') ||
          lowerCondition.includes('angina') ||
          lowerCondition.includes('embolism') ||
          lowerCondition.includes('cardiomyopathy')
        );
      default:
        return false;
    }
  });
}

/**
 * Get random condition from the database
 */
export function getRandomCondition(): string {
  const idx = Math.floor(Math.random() * LAB_DRIVEN_CONDITIONS.length);
  return LAB_DRIVEN_CONDITIONS[idx] ?? '';
}

/**
 * Get random conditions (avoiding duplicates in the same batch)
 */
export function getRandomConditions(count: number): string[] {
  const shuffled = [...LAB_DRIVEN_CONDITIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, LAB_DRIVEN_CONDITIONS.length));
}
