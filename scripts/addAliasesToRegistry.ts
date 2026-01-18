// scripts/addAliasesToRegistry.ts
// Script to add aliases to existing conditions in conditionRegistry.ts

import fs from 'fs';
import path from 'path';

const REGISTRY_FILE = path.resolve('conditionRegistry.ts');
const JSON_FILE = path.resolve('conditionContent.correct.json');

// Map of condition names to their aliases
const CONDITION_ALIASES: Record<string, string[]> = {
  // PSYCH
  'Major Depressive Disorder': ['MDD', 'Clinical Depression', 'Unipolar Depression'],
  'Persistent Depressive Disorder (Dysthymia)': ['Dysthymia', 'Chronic Depression'],
  'Bipolar I Disorder': ['Bipolar I', 'Manic Depression'],
  'Bipolar II Disorder': ['Bipolar II'],
  'Cyclothymic Disorder': ['Cyclothymia'],
  'Premenstrual Dysphoric Disorder (PMDD)': ['PMDD'],
  'Depression with Peripartum Onset': ['Postpartum Depression', 'Peripartum Depression'],
  'Generalized Anxiety Disorder': ['GAD'],
  'Panic Disorder': ['Panic Attack Disorder'],
  'Social Anxiety Disorder (Social Phobia)': ['Social Phobia', 'Social Anxiety'],
  'Specific Phobia': ['Simple Phobia'],
  'Posttraumatic Stress Disorder (PTSD)': ['PTSD', 'Post-Traumatic Stress'],
  'Acute Stress Disorder': ['ASD'],
  'Adjustment Disorder': ['Adjustment Reaction'],
  'Obsessive-Compulsive Disorder (OCD)': ['OCD'],
  'Body Dysmorphic Disorder': ['BDD', 'Dysmorphophobia'],
  Schizophrenia: ['Paranoid Schizophrenia', 'Schizophrenic Disorder'],
  'Schizoaffective Disorder': ['Schizoaffective'],
  'Brief Psychotic Disorder': ['Brief Reactive Psychosis'],
  'Delusional Disorder': ['Paranoid Disorder'],
  'Somatic Symptom Disorder': ['Somatization Disorder'],
  'Illness Anxiety Disorder (Hypochondriasis)': ['Hypochondriasis', 'Health Anxiety'],
  'Conversion Disorder (Functional Neurological Symptom Disorder)': [
    'Conversion Disorder',
    'Functional Neurological Disorder',
  ],
  'Factitious Disorder Imposed on Self': ['Munchausen Syndrome'],
  'Factitious Disorder Imposed on Another': ['Munchausen by Proxy'],
  'Attention-Deficit/Hyperactivity Disorder (ADHD)': ['ADHD', 'ADD', 'Attention Deficit Disorder'],
  'Autism Spectrum Disorder': ['ASD', 'Autism'],
  'Intellectual Disability (Intellectual Developmental Disorder)': [
    'Mental Retardation',
    'Intellectual Developmental Disorder',
  ],
  'Anorexia Nervosa': ['Anorexia'],
  'Bulimia Nervosa': ['Bulimia'],
  'Binge-Eating Disorder': ['BED'],
  'Paranoid Personality Disorder': ['Paranoid PD'],
  'Schizoid Personality Disorder': ['Schizoid PD'],
  'Schizotypal Personality Disorder': ['Schizotypal PD'],
  'Antisocial Personality Disorder': ['ASPD', 'Sociopathy'],
  'Borderline Personality Disorder': ['BPD'],
  'Histrionic Personality Disorder': ['Histrionic PD'],
  'Narcissistic Personality Disorder': ['NPD'],
  'Avoidant Personality Disorder': ['Avoidant PD'],
  'Dependent Personality Disorder': ['Dependent PD'],
  'Obsessive-Compulsive Personality Disorder': ['OCPD'],
  'Alcohol Use Disorder': ['Alcoholism', 'Alcohol Dependence'],
  'Delirium Tremens': ['DTs', 'Alcohol Withdrawal Delirium'],
  'Opioid Use Disorder': ['Opioid Addiction', 'Opioid Dependence'],
  'Tobacco Use Disorder': ['Nicotine Dependence', 'Smoking Addiction'],

  // HEENT
  'Acute Angle-Closure Glaucoma': ['Angle Closure Glaucoma', 'Closed Angle Glaucoma'],
  'Open-Angle Glaucoma': ['Primary Open Angle Glaucoma', 'POAG'],
  'Age-Related Macular Degeneration – Dry': ['Dry AMD', 'Dry Macular Degeneration'],
  'Age-Related Macular Degeneration – Wet': ['Wet AMD', 'Wet Macular Degeneration'],
  'Retinal Detachment': ['Detached Retina'],
  'Conjunctivitis – Bacterial': ['Bacterial Conjunctivitis', 'Pink Eye'],
  'Conjunctivitis – Viral': ['Viral Conjunctivitis'],
  'Conjunctivitis – Allergic': ['Allergic Conjunctivitis'],
  'Corneal Ulcer / Keratitis': ['Corneal Ulcer', 'Keratitis'],
  'Herpes Simplex Keratitis': ['HSV Keratitis', 'Dendritic Ulcer'],
  Pterygium: ["Surfer's Eye"],
  'Otitis Media – Acute': ['Acute Otitis Media', 'AOM', 'Middle Ear Infection'],
  'Acoustic Neuroma (Vestibular Schwannoma)': ['Vestibular Schwannoma', 'Acoustic Neuroma'],
  'Meniere Disease': ["Meniere's Disease", 'Endolymphatic Hydrops'],
  Labyrinthitis: ['Vestibular Labyrinthitis'],
  'Vestibular Neuritis': ['Vestibular Neuronitis'],
  'Allergic Rhinitis': ['Hay Fever', 'Seasonal Allergies'],
  'Acute Bacterial Rhinosinusitis': ['Acute Sinusitis', 'Sinus Infection'],
  'Chronic Rhinosinusitis': ['Chronic Sinusitis'],
  'Pharyngitis – Streptococcal': ['Strep Throat', 'Streptococcal Pharyngitis'],
  'Peritonsillar Abscess': ['Quinsy', 'PTA'],
  'Oral Candidiasis (Thrush)': ['Thrush', 'Oral Thrush'],

  // CV
  'Atrial Fibrillation': ['AFib', 'AF', 'A-Fib'],
  'Atrial Flutter': ['AFL', 'A-Flutter'],
  'Ventricular Tachycardia': ['VT', 'V-Tach'],
  'Ventricular Fibrillation': ['VF', 'V-Fib'],
  'Acute Coronary Syndrome (ACS)': ['ACS', 'Heart Attack'],
  'Myocardial Infarction – STEMI': ['STEMI', 'ST Elevation MI'],
  'Myocardial Infarction – NSTEMI': ['NSTEMI', 'Non-ST Elevation MI'],
  'Stable Angina': ['Angina Pectoris', 'Exertional Angina'],
  'Prinzmetal (Variant) Angina': ['Variant Angina', 'Vasospastic Angina'],
  'Essential Hypertension': ['Primary Hypertension', 'High Blood Pressure'],
  'Congestive Heart Failure': ['CHF', 'Heart Failure'],
  'Aortic Stenosis': ['AS', 'Aortic Valve Stenosis'],
  'Aortic Regurgitation': ['AR', 'Aortic Insufficiency'],
  'Mitral Stenosis': ['MS', 'Mitral Valve Stenosis'],
  'Mitral Regurgitation': ['MR', 'Mitral Insufficiency'],
  'Mitral Valve Prolapse': ['MVP'],
  'Deep Venous Thrombosis (DVT)': ['DVT', 'Deep Vein Thrombosis'],
  'Pulmonary Embolism': ['PE'],
  'Aortic Aneurysm': ['AAA', 'Abdominal Aortic Aneurysm'],
  'Aortic Dissection': ['Dissecting Aortic Aneurysm'],
  'Peripheral Arterial Disease': ['PAD', 'Peripheral Vascular Disease'],
  'Infective Endocarditis': ['Bacterial Endocarditis', 'IE'],
  Pericarditis: ['Pericardial Inflammation'],

  // PULM
  Asthma: ['Bronchial Asthma', 'Reactive Airway Disease'],
  'Chronic Obstructive Pulmonary Disease': ['COPD', 'Chronic Bronchitis', 'Emphysema'],
  'Pneumonia – Community-Acquired': ['CAP', 'Community Acquired Pneumonia'],
  'Pneumonia – Hospital-Acquired': ['HAP', 'Nosocomial Pneumonia'],
  Tuberculosis: ['TB', 'Mycobacterium tuberculosis'],
  Pneumothorax: ['Collapsed Lung'],
  'Pleural Effusion': ['Fluid Around Lung'],
  'Pulmonary Fibrosis': ['IPF', 'Idiopathic Pulmonary Fibrosis'],
  Sarcoidosis: ['Pulmonary Sarcoidosis'],

  // GI
  'Gastroesophageal Reflux Disease': ['GERD', 'Acid Reflux'],
  'Peptic Ulcer Disease': ['PUD', 'Stomach Ulcer', 'Duodenal Ulcer'],
  'Acute Pancreatitis': ['Pancreatitis'],
  'Chronic Pancreatitis': ['Chronic Pancreatitis'],
  Cholecystitis: ['Gallbladder Inflammation'],
  Cholelithiasis: ['Gallstones'],
  Appendicitis: ['Acute Appendicitis'],
  Diverticulitis: ['Diverticular Disease'],
  "Inflammatory Bowel Disease – Crohn's": ["Crohn's Disease", 'Crohn Disease'],
  'Inflammatory Bowel Disease – Ulcerative Colitis': ['Ulcerative Colitis', 'UC'],
  'Irritable Bowel Syndrome': ['IBS', 'Spastic Colon'],
  'Celiac Disease': ['Celiac Sprue', 'Gluten Enteropathy'],
  Cirrhosis: ['Liver Cirrhosis'],
  'Hepatitis A': ['HAV'],
  'Hepatitis B': ['HBV', 'Hep B'],
  'Hepatitis C': ['HCV', 'Hep C'],
  'Colorectal Cancer': ['Colon Cancer', 'CRC'],

  // ENDO
  'Type 1 Diabetes Mellitus': ['T1DM', 'Type 1 Diabetes', 'Juvenile Diabetes'],
  'Type 2 Diabetes Mellitus': ['T2DM', 'Type 2 Diabetes', 'Adult-Onset Diabetes'],
  'Diabetic Ketoacidosis': ['DKA'],
  'Hyperosmolar Hyperglycemic State': ['HHS', 'HONK'],
  Hyperthyroidism: ['Thyrotoxicosis', 'Overactive Thyroid'],
  Hypothyroidism: ['Underactive Thyroid', 'Myxedema'],
  'Graves Disease': ["Graves' Disease", 'Diffuse Toxic Goiter'],
  'Hashimoto Thyroiditis': ["Hashimoto's Thyroiditis", 'Chronic Lymphocytic Thyroiditis'],
  'Thyroid Nodule': ['Thyroid Mass'],
  'Cushing Syndrome': ["Cushing's Syndrome", 'Hypercortisolism'],
  'Addison Disease (Primary Adrenal Insufficiency)': [
    "Addison's Disease",
    'Primary Adrenal Insufficiency',
  ],
  'Primary Hyperparathyroidism': ['Hyperparathyroidism'],
  Hypoparathyroidism: ['Low Parathyroid'],
  'Syndrome of Inappropriate ADH': ['SIADH'],

  // MSK
  Osteoarthritis: ['OA', 'Degenerative Joint Disease'],
  'Rheumatoid Arthritis': ['RA'],
  Gout: ['Gouty Arthritis', 'Crystal Arthropathy'],
  Pseudogout: ['Calcium Pyrophosphate Deposition Disease', 'CPPD'],
  'Systemic Lupus Erythematosus': ['SLE', 'Lupus'],
  'Ankylosing Spondylitis': ['AS', "Bechterew's Disease"],
  'Psoriatic Arthritis': ['PsA'],
  'Reactive Arthritis': ["Reiter's Syndrome"],
  Osteoporosis: ['Bone Loss', 'Porous Bones'],
  'Rotator Cuff Tear': ['RCT', 'Rotator Cuff Injury'],
  'Carpal Tunnel Syndrome': ['CTS'],
  'Plantar Fasciitis': ['Heel Spur Syndrome'],
  'Achilles Tendinopathy': ['Achilles Tendinitis'],
  'Low Back Pain': ['LBP', 'Lumbago'],
  'Herniated Disc': ['Slipped Disc', 'Disc Herniation'],
  'Spinal Stenosis': ['Lumbar Stenosis'],

  // NEURO
  'Ischemic Stroke': ['CVA', 'Cerebrovascular Accident'],
  'Hemorrhagic Stroke': ['Intracerebral Hemorrhage'],
  'Transient Ischemic Attack': ['TIA', 'Mini-Stroke'],
  'Subarachnoid Hemorrhage': ['SAH'],
  'Subdural Hematoma': ['SDH'],
  'Epidural Hematoma': ['EDH'],
  'Bacterial Meningitis': ['Meningitis'],
  'Viral Meningitis': ['Aseptic Meningitis'],
  Encephalitis: ['Brain Inflammation'],
  'Multiple Sclerosis': ['MS'],
  'Parkinson Disease': ["Parkinson's Disease", 'PD'],
  'Alzheimer Disease': ["Alzheimer's Disease", 'AD'],
  Epilepsy: ['Seizure Disorder'],
  Migraine: ['Migraine Headache'],
  'Tension-Type Headache': ['Tension Headache'],
  'Cluster Headache': ['Histamine Headache'],
  'Bell Palsy': ["Bell's Palsy", 'Facial Palsy'],
  'Trigeminal Neuralgia': ['Tic Douloureux'],
  'Amyotrophic Lateral Sclerosis (ALS)': ['ALS', "Lou Gehrig's Disease"],

  // RENAL
  'Acute Kidney Injury (General)': ['AKI', 'Acute Renal Failure'],
  'Chronic Kidney Disease': ['CKD', 'Chronic Renal Failure'],
  Nephrolithiasis: ['Kidney Stones', 'Renal Calculi'],
  Pyelonephritis: ['Kidney Infection'],
  'Polycystic Kidney Disease (PKD)': ['PKD', 'ADPKD'],
  'Renal Cell Carcinoma': ['RCC', 'Kidney Cancer'],

  // GU
  'Benign Prostatic Hyperplasia': ['BPH', 'Enlarged Prostate'],
  'Acute Prostatitis': ['Prostatitis'],
  Epididymitis: ['Epididymal Infection'],
  'Testicular Torsion': ['Torsion of Testis'],
  Hydrocele: ['Scrotal Swelling'],
  Varicocele: ['Scrotal Varicose Veins'],
  'Urinary Tract Infection – Lower (Cystitis)': ['UTI', 'Bladder Infection', 'Cystitis'],

  // REPRO
  'Polycystic Ovary Syndrome': ['PCOS'],
  Endometriosis: ['Endo'],
  'Pelvic Inflammatory Disease': ['PID'],
  'Ectopic Pregnancy': ['Tubal Pregnancy'],
  Preeclampsia: ['Toxemia', 'Pregnancy-Induced Hypertension'],
  Eclampsia: ['Seizures in Pregnancy'],
  'Placenta Previa': ['Low-Lying Placenta'],
  'Placental Abruption': ['Abruptio Placentae'],
  'Gestational Diabetes': ['GDM'],
  Mastitis: ['Breast Infection'],
  Fibroadenoma: ['Breast Lump'],
  'Fibrocystic Changes': ['Fibrocystic Breast Disease'],

  // HEME
  'Iron Deficiency Anemia': ['IDA', 'Iron Deficiency'],
  'Vitamin B12 Deficiency Anemia': ['B12 Deficiency', 'Cobalamin Deficiency'],
  'Folate Deficiency Anemia': ['Folic Acid Deficiency'],
  'Sickle Cell Disease': ['SCD', 'Sickle Cell Anemia'],
  Thalassemia: ['Mediterranean Anemia'],
  'G6PD Deficiency': ['Glucose-6-Phosphate Dehydrogenase Deficiency', 'Favism'],
  'Aplastic Anemia': ['Bone Marrow Failure'],
  'Hereditary Spherocytosis': ['HS'],
  'Polycythemia Vera': ['PV', 'Primary Polycythemia'],
  'Disseminated Intravascular Coagulation': ['DIC'],

  // ID
  'HIV/AIDS': ['HIV', 'AIDS', 'Human Immunodeficiency Virus'],
  Influenza: ['Flu', 'Seasonal Flu'],
  'COVID-19': ['Coronavirus', 'SARS-CoV-2'],
  'Herpes Simplex Virus': ['HSV', 'Herpes'],
  'Herpes Zoster': ['Shingles', 'Zoster'],
  Varicella: ['Chickenpox', 'VZV'],
  'Infectious Mononucleosis': ['Mono', 'EBV', 'Kissing Disease'],
  'Clostridium difficile Infection': ['C. diff', 'CDI'],
  Sepsis: ['Septicemia', 'Blood Poisoning'],
  Cellulitis: ['Skin Infection'],
  Osteomyelitis: ['Bone Infection'],

  // DERM
  'Atopic Dermatitis': ['Eczema', 'Atopic Eczema'],
  'Contact Dermatitis (Irritant/Allergic)': ['Contact Dermatitis', 'Allergic Contact Dermatitis'],
  'Seborrheic Dermatitis': ['Dandruff', 'Cradle Cap'],
  Psoriasis: ['Plaque Psoriasis'],
  'Acne Vulgaris': ['Acne', 'Pimples'],
  Rosacea: ['Acne Rosacea'],
  Urticaria: ['Hives', 'Wheals'],
  'Stevens-Johnson Syndrome (SJS)': ['SJS'],
  'Toxic Epidermal Necrolysis (TEN)': ['TEN', 'Lyell Syndrome'],
  Impetigo: ['School Sores'],
  // "Cellulitis": ["Skin Infection"], // Duplicate
  'Herpes Zoster (Shingles)': ['Shingles', 'Zoster'],
  Scabies: ['Sarcoptes scabiei', 'Itch Mite'],
  'Tinea Corporis': ['Ringworm', 'Body Ringworm'],
  'Tinea Pedis': ["Athlete's Foot"],
  'Tinea Capitis': ['Scalp Ringworm'],
  'Basal Cell Carcinoma': ['BCC'],
  'Squamous Cell Carcinoma': ['SCC'],
  Melanoma: ['Malignant Melanoma'],
};

function main() {
  console.log('🚀 Adding aliases to conditionRegistry.ts');

  let content = fs.readFileSync(REGISTRY_FILE, 'utf8');
  let aliasesAdded = 0;

  for (const [conditionName, aliases] of Object.entries(CONDITION_ALIASES)) {
    // Find the condition in the registry (escape special regex characters)
    const escapedName = conditionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Pattern to find condition without aliases
    const patternNoAlias = new RegExp(`(\\{[^}]*condition:\\s*"${escapedName}"\\s*)\\}`, 'g');

    // Check if this condition exists and doesn't already have aliases
    if (patternNoAlias.test(content)) {
      const aliasesStr = aliases.map((a) => `"${a}"`).join(', ');
      content = content.replace(patternNoAlias, `$1, aliases: [${aliasesStr}] }`);
      aliasesAdded++;
      console.log(`  ✅ Added aliases to: ${conditionName}`);
    }
  }

  fs.writeFileSync(REGISTRY_FILE, content, 'utf8');
  console.log(`\n🎉 Complete! Added aliases to ${aliasesAdded} conditions.`);
}

main();
