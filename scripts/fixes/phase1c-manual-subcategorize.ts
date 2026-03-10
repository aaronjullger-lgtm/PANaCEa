#!/usr/bin/env npx tsx
/**
 * Phase 1c (continued): Manual subcategorization for remaining 223 conditions
 * These are direct mappings that don't need AI.
 *
 * Usage: npx tsx scripts/fixes/phase1c-manual-subcategorize.ts [--dry-run]
 */

import { prisma, disconnectPrisma } from '../helpers/prisma-client';

const DRY_RUN = process.argv.includes('--dry-run');

// condition name -> subcategory (exact match, case-insensitive)
const MANUAL_MAP: Record<string, string> = {
  // CV
  'Orthostatic Hypotension': 'Hypertension',

  // DERM
  'Angioedema': 'Drug Reactions',
  'Erythema Infectiosum (Fifth Disease)': 'Infectious Diseases',
  'Erythema Migrans': 'Infectious Diseases',
  'Erythema Nodosum': 'Papulosquamous Disorders',
  'Lacerations': 'Burns / Wound Care',
  'Peau dOrange': 'Neoplasms',
  'Photosensitivity Reactions': 'Drug Reactions',
  'Raynauds Phenomenon': 'Vascular Lesions',

  // ENDO
  'Noonan Syndrome': 'Metabolic / Genetic Disorders',
  'Osteoporosis (Endocrine Related)': 'Parathyroid / Calcium Disorders',
  "Paget's Disease of Bone (Endocrine)": 'Parathyroid / Calcium Disorders',
  'Sturge-Weber Syndrome': 'Metabolic / Genetic Disorders',

  // GI
  'Acetaminophen Toxicity': 'Hepatic Disorders',
  'Beriberi': 'Nutrition',
  'Cannabinoid Hyperemesis Syndrome': 'Gastric Disorders',
  'Carbon Monoxide Poisoning': 'Nutrition',
  'Choledocholithiasis': 'Biliary Disorders',
  'Colic': 'Small Bowel Disorders',
  'Dehydration': 'Nutrition',
  'Duodenal Atresia': 'Small Bowel Disorders',
  'Electrolyte Abnormalities': 'Nutrition',
  'Encopresis': 'Colorectal Disorders',
  'Failure to Thrive': 'Nutrition',
  'Fecal Impaction': 'Colorectal Disorders',
  'Gastrointestinal Bleeding': 'GI Bleeding',
  'GI Malignancy': 'Neoplasms',
  'Insulinoma': 'Pancreatic Disorders',
  'Phenylketonuria (PKU)': 'Nutrition',
  'Pneumoperitoneum': 'Small Bowel Disorders',
  'Pyloric Stenosis': 'Gastric Disorders',
  'Refeeding Syndrome': 'Nutrition',
  'Salicylate Toxicity': 'Hepatic Disorders',
  'Trisomy 21': 'Small Bowel Disorders',

  // GU
  'Erectile Dysfunction': 'Penile / Urethral Disorders',
  'Fournier Gangrene': 'Testicular / Scrotal Disorders',
  'Glomerulonephritis': 'Bladder Disorders',
  'Hydronephrosis': 'Bladder Disorders',
  'Inguinal Hernia': 'Testicular / Scrotal Disorders',
  'Pelvic Floor Dysfunction': 'Pelvic Floor Disorders',
  'Torsion of Appendix Testis': 'Testicular / Scrotal Disorders',
  'Urethral Diverticulum': 'Penile / Urethral Disorders',
  'Urethral Injury': 'Penile / Urethral Disorders',
  'Vesicoureteral Reflux': 'Bladder Disorders',

  // HEENT
  'Amaurosis Fugax': 'Eye - Posterior Segment',
  'Barotrauma': 'Ear - Middle',
  'Blunt Ocular Trauma / Globe Injury': 'Trauma',
  'Dacryoadenitis': 'Eye - Lacrimal',
  'Ectropion': 'Eye - Anterior Segment',
  'Entropion': 'Eye - Anterior Segment',
  'Episcleritis': 'Eye - Anterior Segment',
  'Erythroplakia': 'Dental / Oral',
  'Gingival Hyperplasia': 'Dental / Oral',
  'Herpes Labialis': 'Oropharyngeal - Infectious/Inflammatory',
  'Hollenhorst Plaque': 'Eye - Posterior Segment',
  'Hypopyon': 'Eye - Anterior Segment',
  'Laryngopharyngeal Reflux (LPR)': 'Oropharyngeal - Structural',
  'Leukocoria': 'Eye - Posterior Segment',
  'Ménière Disease': 'Ear - Inner',
  'Nasopharyngeal Carcinoma': 'Oropharyngeal - Structural',
  'Ocular Hypertension': 'Eye - Anterior Segment',
  'Oropharyngeal Carcinoma (Including HPV-Associated)': 'Oropharyngeal - Structural',
  'Otosclerosis': 'Ear - Middle',
  'Presbycusis': 'Ear - Inner',
  'Retinitis Pigmentosa': 'Eye - Posterior Segment',
  'Retinoblastoma': 'Eye - Posterior Segment',
  'Scleritis': 'Eye - Anterior Segment',
  'Sialolithiasis': 'Neck / Salivary',
  'Temporomandibular Joint Disorder (TMJ)': 'Dental / Oral',
  'Tetracycline Staining': 'Dental / Oral',
  'Torus Palatinus': 'Dental / Oral',

  // HEME
  'Anaphylaxis': 'White Blood Cell Disorders',
  'Antithrombin III Deficiency': 'Thrombotic Disorders',
  'Asplenia': 'White Blood Cell Disorders',
  'Disorders of Spleen (Hypersplenism)': 'White Blood Cell Disorders',
  'Hemochromatosis': 'Anemias',
  'Lead Poisoning': 'Anemias',
  'Monoclonal Gammopathy of Undetermined Significance (MGUS)': 'Lymphoproliferative Disorders',
  'Neuroblastoma': 'Neoplasms',
  'Paroxysmal Nocturnal Hemoglobinuria (PNH)': 'Anemias',
  'Prothrombin Gene Mutation': 'Thrombotic Disorders',
  'Secondary Polycythemia': 'Myeloproliferative Disorders',
  'Tumor Lysis Syndrome': 'Neoplasms',
  'Waldenström Macroglobulinemia': 'Lymphoproliferative Disorders',
  'Wilms Tumor': 'Neoplasms',

  // ID
  'Acute Otitis Media (AOM)': 'Bacterial Diseases',
  'Ascariasis': 'Parasitic Diseases',
  'Bartonella henselae': 'Bacterial Diseases',
  'Campylobacter': 'Bacterial Diseases',
  'Cestode Infection': 'Parasitic Diseases',
  'Chancroid': 'Sexually Transmitted Infections',
  'Coronavirus Infections': 'Viral Diseases',
  'Cytomegalovirus (Systemic)': 'Viral Diseases',
  'Erysipelas': 'Bacterial Diseases',
  'Fifth Disease': 'Viral Diseases',
  'Folliculitis': 'Bacterial Diseases',
  'Hand-Foot-and-Mouth Disease': 'Viral Diseases',
  'Impetigo': 'Bacterial Diseases',
  'Lice (Pediculosis)': 'Parasitic Diseases',
  'Meningitis (Bacterial)': 'Bacterial Diseases',
  'Meningococcemia': 'Bacterial Diseases',
  'Mpox': 'Viral Diseases',
  'Mycobacterium avium complex (MAC)': 'Bacterial Diseases',
  'Norovirus': 'Viral Diseases',
  'Prion Diseases (e.g., Creutzfeldt-Jakob Disease)': 'Viral Diseases',
  'Rheumatic Fever': 'Bacterial Diseases',
  'Rotavirus': 'Viral Diseases',
  'Scabies (Parasitic)': 'Parasitic Diseases',
  'Scarlet Fever': 'Bacterial Diseases',
  'Typhoid Fever': 'Bacterial Diseases',
  'Urinary Tract Infection (UTI) / Pyelonephritis': 'Bacterial Diseases',

  // MSK
  'Acromioclavicular (AC) Joint Separation': 'Upper Extremity Disorders',
  'Adhesive Capsulitis': 'Upper Extremity Disorders',
  'Bakers Cyst': 'Lower Extremity Disorders',
  'Enteropathic Arthritis': 'Joint Disorders',
  'Ewing Sarcoma': 'Bone Disorders',
  'Fetal Alcohol Syndrome': 'Pediatric Orthopedics',
  'Gamekeeper/Skier Thumb (UCL Injury)': 'Upper Extremity Disorders',
  'Genu Varum (Bowlegs)': 'Pediatric Orthopedics',
  'Granulomatosis with Polyangiitis (Wegener)': 'Autoimmune / Inflammatory',
  'Henoch-Schönlein Purpura': 'Autoimmune / Inflammatory',
  'Kawasaki Disease': 'Autoimmune / Inflammatory',
  'Lateral Collateral Ligament (LCL) Injury': 'Lower Extremity Disorders',
  'Lyme Arthritis': 'Joint Disorders',
  'Microscopic Polyangiitis': 'Autoimmune / Inflammatory',
  'Osteochondritis Dissecans': 'Joint Disorders',
  'Prosthetic Joint Infection': 'Joint Disorders',
  'Quadriceps Tendon Rupture': 'Lower Extremity Disorders',
  'Septic Tenosynovitis': 'Soft Tissue Disorders',
  "Sever's Disease": 'Pediatric Orthopedics',
  'Sjögren Syndrome': 'Autoimmune / Inflammatory',
  'Torticollis': 'Spinal Disorders',
  'Turner Syndrome': 'Pediatric Orthopedics',

  // NEURO
  'Basilar Skull Fracture': 'Trauma',
  'Complex Regional Pain Syndrome (CRPS)': 'Neuromuscular Disorders',
  'Conus Medullaris Syndrome': 'Spinal Disorders',
  'Diffuse Axonal Injury': 'Trauma',
  'Hydrocephalus (Pediatric)': 'Cognitive Disorders',
  'Increased Intracranial Pressure': 'Trauma',
  'Lyme Neuroborreliosis': 'Infectious Disorders',
  'Meralgia Paresthetica': 'Neuromuscular Disorders',
  'Myasthenic Crisis': 'Neuromuscular Disorders',
  'Neural Tube Defects (Spina Bifida, Anencephaly)': 'Spinal Disorders',
  'Neurofibromatosis Type 1': 'Neuromuscular Disorders',
  'Posterior Column Disease': 'Spinal Disorders',
  'Syncope': 'Cerebrovascular Disorders',
  'Temporal (Giant Cell) Arteritis – Neurologic Manifestations': 'Cerebrovascular Disorders',
  'Tetanus': 'Infectious Disorders',
  'Transverse Myelitis': 'Demyelinating Disorders',
  'Tuberous Sclerosis': 'Neuromuscular Disorders',
  'Upper Motor Neuron Lesion': 'Neuromuscular Disorders',

  // PSYCH
  'Catatonia': 'Psychotic Disorders',
  'Conduct Disorder': 'Neurodevelopmental Disorders',
  'Cyclothymic Disorder': 'Bipolar Disorders',
  'Delirium': 'Cognitive Disorders',
  'Gender Dysphoria': 'Somatic Disorders',
  'Hallucinogen Use Disorder': 'Substance Use Disorders',
  'Hypersomnolence Disorder': 'Sleep Disorders',
  'Intermittent Explosive Disorder': 'Impulse Control Disorders',
  'Major Neurocognitive Disorder (Dementia)': 'Cognitive Disorders',
  'Neuroleptic Malignant Syndrome': 'Psychotic Disorders',
  'Oppositional Defiant Disorder': 'Neurodevelopmental Disorders',
  'Persistent (Chronic) Motor or Vocal Tic Disorder': 'Neurodevelopmental Disorders',
  'Psychogenic Nonepileptic Seizure': 'Somatic Disorders',
  'Schizophreniform Disorder': 'Psychotic Disorders',
  'Sedative-Hypnotic or Anxiolytic Use Disorder': 'Substance Use Disorders',
  'Serotonin Syndrome (Psychiatric Perspective)': 'Substance Use Disorders',
  'Tobacco Use Disorder': 'Substance Use Disorders',

  // PULM
  'Acute Epiglottitis': 'Infectious Disorders',
  'Alpha-1 Antitrypsin Deficiency': 'Obstructive Pulmonary Diseases',
  'Aspirin Exacerbated Respiratory Disease (AERD)': 'Obstructive Pulmonary Diseases',
  'Carcinoid Tumor': 'Neoplasms',
  'EVALI': 'Restrictive Pulmonary Diseases',
  'Foreign Body Aspiration': 'Obstructive Pulmonary Diseases',
  'Granulomatosis with Polyangiitis (GPA) / Wegener\'s': 'Restrictive Pulmonary Diseases',
  'Obesity Hypoventilation Syndrome': 'Restrictive Pulmonary Diseases',
  'Smoke Inhalation Injury': 'Occupational / Environmental',

  // RENAL
  'Analgesic Nephropathy': 'Tubular / Interstitial Disorders',
  'Angiomyolipoma': 'Neoplasms',
  'Calcium Oxalate Stones': 'Obstructive Uropathy',
  'Contrast-Induced Nephropathy': 'Acute Kidney Injury',
  'Cystine Stones': 'Obstructive Uropathy',
  'Diabetic Nephropathy': 'Glomerular Disorders',
  'Ethylene Glycol Poisoning': 'Acid-Base Disorders',
  'Hemolytic Uremic Syndrome (Pediatric Primary)': 'Glomerular Disorders',
  'Horseshoe Kidney': 'Tubular / Interstitial Disorders',
  'Lupus Nephritis': 'Glomerular Disorders',
  'Medullary Sponge Kidney': 'Tubular / Interstitial Disorders',
  'Multiple Myeloma Kidney': 'Tubular / Interstitial Disorders',
  'Oncocytoma': 'Neoplasms',
  'Papillary Necrosis': 'Tubular / Interstitial Disorders',
  'Rhabdomyolysis – Renal Complications': 'Acute Kidney Injury',
  'Struvite Stones': 'Obstructive Uropathy',
  'Thrombotic Microangiopathy (HUS/TTP) – Renal Manifestations': 'Glomerular Disorders',
  'Uric Acid Stones': 'Obstructive Uropathy',

  // REPRO
  'Anembryonic Pregnancy': 'Pregnancy',
  'Caput Succedaneum': 'Labor and Delivery',
  'Chorioamnionitis': 'Pregnancy',
  'Chronic Pelvic Pain': 'Gynecologic Disorders',
  'Female Infertility – Anovulation': 'Ovarian Disorders',
  'Female Infertility – Tubal Factor': 'Uterine Disorders',
  'Fetal Macrosomia': 'Pregnancy',
  'Hyaline Membrane Disease': 'Postpartum',
  'Hydatidiform Mole': 'Pregnancy',
  'Hyperprolactinemia (Reproductive Effects)': 'Menstrual Disorders',
  'Incompetent Cervix': 'Cervical Disorders',
  'Intrauterine Growth Restriction (IUGR)': 'Pregnancy',
  'Lichen Sclerosus': 'Gynecologic Disorders',
  'Lichen Simplex Chronicus (Vulvar)': 'Gynecologic Disorders',
  'Male Factor Infertility': 'Male Reproductive',
  'Male Hypogonadism (Reproductive Impact)': 'Male Reproductive',
  'Male Infertility (Sperm Abnormalities)': 'Male Reproductive',
  'Meconium Aspiration': 'Postpartum',
  'Mittelschmerz': 'Ovarian Disorders',
  'Multiple Gestation (Twin Pregnancy)': 'Pregnancy',
  'Necrotizing Enterocolitis': 'Postpartum',
  'Oligomenorrhea': 'Menstrual Disorders',
  'Polymenorrhea': 'Menstrual Disorders',
  'Post-term Pregnancy': 'Pregnancy',
  'Sexual Assault / Trauma': 'Gynecologic Disorders',
  'Sudden Infant Death Syndrome (SIDS)': 'Postpartum',
  'Urinary Incontinence (Stress, Urge, Overflow)': 'Pelvic Floor Disorders',
  'Vulvodynia': 'Gynecologic Disorders',
};

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Phase 1c (manual): Subcategorize Remaining Conditions    ║');
  console.log(`║  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}                                            ║`);
  console.log('╚════════════════════════════════════════════════════════════╝');

  const uncategorized = await prisma.medicalContent.findMany({
    where: { subcategory: 'Uncategorized' },
    select: { id: true, condition: true, system: true, conditionId: true },
  });

  console.log(`\nRemaining uncategorized: ${uncategorized.length}\n`);

  let matched = 0;
  let unmatched = 0;

  for (const mc of uncategorized) {
    const subcategory = MANUAL_MAP[mc.condition];
    if (subcategory) {
      if (!DRY_RUN) {
        await prisma.medicalContent.update({
          where: { id: mc.id },
          data: { subcategory },
        });
        try {
          await prisma.condition.update({
            where: { id: mc.conditionId },
            data: { subcategory },
          });
        } catch { /* ignore */ }
      }
      console.log(`  ✅ "${mc.condition}" (${mc.system}) -> "${subcategory}"`);
      matched++;
    } else {
      console.log(`  ❓ UNMATCHED: "${mc.condition}" (${mc.system})`);
      unmatched++;
    }
  }

  console.log('\n════════════════════════════════════════');
  console.log(`Matched: ${matched}`);
  console.log(`Unmatched: ${unmatched}`);

  await disconnectPrisma();
}

main().catch(async (e) => {
  console.error('❌ Fatal error:', e);
  await disconnectPrisma();
  process.exit(1);
});
