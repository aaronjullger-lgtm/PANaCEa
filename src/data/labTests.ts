// src/data/labTests.ts
// Comprehensive database of available laboratory tests

export interface LabTestDefinition {
  name: string;
  category: string;
  commonAbnormalities?: string[];
  typicalUse?: string;
}

/**
 * Complete database of orderable laboratory tests
 * Organized by category for easier navigation
 */
export const LAB_TEST_DATABASE: LabTestDefinition[] = [
  // Basic Panels (Always shown by default)
  { name: "Basic Metabolic Panel (BMP)", category: "Basic Panels", typicalUse: "Electrolytes and renal function" },
  { name: "Complete Blood Count (CBC)", category: "Basic Panels", typicalUse: "Blood cell counts and indices" },
  { name: "Comprehensive Metabolic Panel (CMP)", category: "Basic Panels", typicalUse: "Extended metabolic panel including liver function" },
  
  // Liver Function Tests
  { name: "Liver Function Tests", category: "Hepatic", typicalUse: "Comprehensive liver assessment" },
  { name: "ALT Blood Test", category: "Hepatic", typicalUse: "Liver enzyme" },
  { name: "AST Test", category: "Hepatic", typicalUse: "Liver enzyme" },
  { name: "Alkaline Phosphatase", category: "Hepatic", typicalUse: "Liver and bone marker" },
  { name: "Bilirubin Blood Test", category: "Hepatic", typicalUse: "Liver function and hemolysis" },
  { name: "Albumin Blood Test", category: "Hepatic", typicalUse: "Liver synthetic function" },
  { name: "Gamma-glutamyl Transferase (GGT) Test", category: "Hepatic", typicalUse: "Liver enzyme" },
  { name: "Total Protein and Albumin/Globulin (A/G) Ratio", category: "Hepatic", typicalUse: "Protein status" },
  { name: "Globulin Test", category: "Hepatic", typicalUse: "Protein fractions" },
  { name: "Prealbumin Blood Test", category: "Hepatic", typicalUse: "Nutritional status" },
  
  // Urinalysis
  { name: "Urinalysis", category: "Urinalysis", typicalUse: "Comprehensive urine analysis" },
  { name: "Blood in Urine", category: "Urinalysis", typicalUse: "Hematuria detection" },
  { name: "Protein in Urine", category: "Urinalysis", typicalUse: "Proteinuria detection" },
  { name: "Glucose in Urine Test", category: "Urinalysis", typicalUse: "Glycosuria" },
  { name: "Ketones in Urine", category: "Urinalysis", typicalUse: "Ketosis detection" },
  { name: "Bilirubin in Urine", category: "Urinalysis", typicalUse: "Conjugated hyperbilirubinemia" },
  { name: "Crystals in Urine", category: "Urinalysis", typicalUse: "Stone formation risk" },
  { name: "Epithelial Cells in Urine", category: "Urinalysis", typicalUse: "Specimen quality" },
  { name: "Nitrites in Urine", category: "Urinalysis", typicalUse: "Bacterial infection" },
  { name: "Mucus in Urine", category: "Urinalysis", typicalUse: "Inflammation" },
  { name: "Urobilinogen in Urine", category: "Urinalysis", typicalUse: "Hemolysis and liver function" },
  
  // Toxicology
  { name: "Acetaminophen Level", category: "Toxicology", typicalUse: "Overdose assessment" },
  { name: "Salicylates Level", category: "Toxicology", typicalUse: "Aspirin toxicity" },
  { name: "Alcohol Use Screening Tests", category: "Toxicology", typicalUse: "Alcohol use disorder" },
  { name: "Blood Alcohol Level", category: "Toxicology", typicalUse: "Acute intoxication" },
  { name: "Drug Testing", category: "Toxicology", typicalUse: "Substance use screening" },
  { name: "Drug Use Screening Tests", category: "Toxicology", typicalUse: "Substance abuse" },
  { name: "Opioid Testing", category: "Toxicology", typicalUse: "Opioid use" },
  { name: "Tricyclic Antidepressant (TCA) Screen", category: "Toxicology", typicalUse: "TCA overdose" },
  { name: "Heavy Metal Blood Test", category: "Toxicology", typicalUse: "Metal poisoning" },
  { name: "Therapeutic Drug Monitoring", category: "Toxicology", typicalUse: "Drug levels" },
  
  // Infectious Disease
  { name: "Acid-Fast Bacillus (AFB) Tests", category: "Infectious Disease", typicalUse: "Tuberculosis detection" },
  { name: "Bacteria Culture Test", category: "Infectious Disease", typicalUse: "Bacterial identification" },
  { name: "Bacterial Vaginosis Test", category: "Infectious Disease", typicalUse: "Vaginal infection" },
  { name: "Antibiotic Sensitivity Test", category: "Infectious Disease", typicalUse: "Antimicrobial resistance" },
  { name: "Antibody Serology Tests", category: "Infectious Disease", typicalUse: "Infection immunity" },
  { name: "C. diff Testing", category: "Infectious Disease", typicalUse: "Clostridioides difficile" },
  { name: "Chickenpox and Shingles Tests", category: "Infectious Disease", typicalUse: "Varicella-zoster virus" },
  { name: "Chlamydia Test", category: "Infectious Disease", typicalUse: "Chlamydia trachomatis" },
  { name: "Cytomegalovirus (CMV) Tests", category: "Infectious Disease", typicalUse: "CMV infection" },
  { name: "Dengue Fever Test", category: "Infectious Disease", typicalUse: "Dengue virus" },
  { name: "Flu (Influenza) Test", category: "Infectious Disease", typicalUse: "Influenza virus" },
  { name: "Fungal Culture Test", category: "Infectious Disease", typicalUse: "Fungal identification" },
  { name: "Gonorrhea Test", category: "Infectious Disease", typicalUse: "Neisseria gonorrhoeae" },
  { name: "Gram Stain", category: "Infectious Disease", typicalUse: "Bacterial classification" },
  { name: "Helicobacter Pylori (H. Pylori) Tests", category: "Infectious Disease", typicalUse: "H. pylori infection" },
  { name: "Hepatitis Testing", category: "Infectious Disease", typicalUse: "Hepatitis viruses" },
  { name: "Herpes (HSV) Test", category: "Infectious Disease", typicalUse: "Herpes simplex virus" },
  { name: "HIV Screening Test", category: "Infectious Disease", typicalUse: "HIV infection" },
  { name: "HIV Viral Load", category: "Infectious Disease", typicalUse: "HIV treatment monitoring" },
  { name: "Human Papillomavirus (HPV) Test", category: "Infectious Disease", typicalUse: "HPV infection" },
  { name: "Legionella Tests", category: "Infectious Disease", typicalUse: "Legionnaires' disease" },
  { name: "Lyme Disease Tests", category: "Infectious Disease", typicalUse: "Borrelia burgdorferi" },
  { name: "Malaria Tests", category: "Infectious Disease", typicalUse: "Malaria parasites" },
  { name: "Measles and Mumps Tests", category: "Infectious Disease", typicalUse: "Measles/mumps virus" },
  { name: "Meningococcal Disease Tests", category: "Infectious Disease", typicalUse: "Neisseria meningitidis" },
  { name: "Mononucleosis (Mono) Tests", category: "Infectious Disease", typicalUse: "Epstein-Barr virus" },
  { name: "MRSA Tests", category: "Infectious Disease", typicalUse: "Methicillin-resistant Staphylococcus aureus" },
  { name: "Ova and Parasite Test", category: "Infectious Disease", typicalUse: "Intestinal parasites" },
  { name: "Parainfluenza Tests", category: "Infectious Disease", typicalUse: "Parainfluenza virus" },
  { name: "PCR Tests", category: "Infectious Disease", typicalUse: "Molecular diagnostics" },
  { name: "Pneumococcal Disease Tests", category: "Infectious Disease", typicalUse: "Streptococcus pneumoniae" },
  { name: "Respiratory Pathogens Panel", category: "Infectious Disease", typicalUse: "Respiratory infections" },
  { name: "Respiratory Syncytial Virus (RSV) Tests", category: "Infectious Disease", typicalUse: "RSV infection" },
  { name: "Sexually Transmitted Infection (STI) Tests", category: "Infectious Disease", typicalUse: "STI screening" },
  { name: "Sputum Culture", category: "Infectious Disease", typicalUse: "Respiratory pathogens" },
  { name: "Strep A Test", category: "Infectious Disease", typicalUse: "Group A Streptococcus" },
  { name: "Strep B Test", category: "Infectious Disease", typicalUse: "Group B Streptococcus" },
  { name: "Syphilis Tests", category: "Infectious Disease", typicalUse: "Treponema pallidum" },
  { name: "Trichomoniasis Test", category: "Infectious Disease", typicalUse: "Trichomonas vaginalis" },
  { name: "Tuberculosis Screening", category: "Infectious Disease", typicalUse: "Mycobacterium tuberculosis" },
  { name: "Whooping Cough Tests", category: "Infectious Disease", typicalUse: "Bordetella pertussis" },
  { name: "Yeast Infection Tests", category: "Infectious Disease", typicalUse: "Candida infection" },
  { name: "Zika Virus Test", category: "Infectious Disease", typicalUse: "Zika virus" },
  
  // Endocrine
  { name: "Adrenocorticotropic Hormone (ACTH)", category: "Endocrine", typicalUse: "Adrenal function" },
  { name: "Aldosterone Test", category: "Endocrine", typicalUse: "Hypertension workup" },
  { name: "Anti-Müllerian Hormone Test", category: "Endocrine", typicalUse: "Ovarian reserve" },
  { name: "C-Peptide Test", category: "Endocrine", typicalUse: "Insulin production" },
  { name: "Calcitonin Test", category: "Endocrine", typicalUse: "Medullary thyroid cancer" },
  { name: "Catecholamine Tests", category: "Endocrine", typicalUse: "Pheochromocytoma" },
  { name: "Cortisol Test", category: "Endocrine", typicalUse: "Adrenal function" },
  { name: "DHEA Sulfate Test", category: "Endocrine", typicalUse: "Adrenal androgens" },
  { name: "Diabetes Tests", category: "Endocrine", typicalUse: "Diabetes screening" },
  { name: "Estrogen Levels Test", category: "Endocrine", typicalUse: "Reproductive health" },
  { name: "Follicle-Stimulating Hormone (FSH) Levels Test", category: "Endocrine", typicalUse: "Reproductive function" },
  { name: "Glucagon Blood Test", category: "Endocrine", typicalUse: "Glucagon secretion" },
  { name: "Blood Glucose Test", category: "Endocrine", typicalUse: "Blood sugar" },
  { name: "Growth Hormone Tests", category: "Endocrine", typicalUse: "Growth disorders" },
  { name: "Hemoglobin A1C (HbA1c) Test", category: "Endocrine", typicalUse: "Diabetes control" },
  { name: "IGF-1 (Insulin-like Growth Factor 1) Test", category: "Endocrine", typicalUse: "Growth hormone axis" },
  { name: "Insulin in Blood", category: "Endocrine", typicalUse: "Insulin levels" },
  { name: "Ketones in Blood", category: "Endocrine", typicalUse: "Ketoacidosis" },
  { name: "Luteinizing Hormone (LH) Levels Test", category: "Endocrine", typicalUse: "Reproductive function" },
  { name: "Parathyroid Hormone (PTH) Test", category: "Endocrine", typicalUse: "Calcium metabolism" },
  { name: "Progesterone Test", category: "Endocrine", typicalUse: "Ovulation and pregnancy" },
  { name: "Prolactin Levels", category: "Endocrine", typicalUse: "Pituitary function" },
  { name: "Renin Test", category: "Endocrine", typicalUse: "Hypertension workup" },
  { name: "SHBG Blood Test", category: "Endocrine", typicalUse: "Sex hormone binding" },
  { name: "Testosterone Levels Test", category: "Endocrine", typicalUse: "Androgen status" },
  { name: "Thyroglobulin", category: "Endocrine", typicalUse: "Thyroid cancer monitoring" },
  { name: "Thyroid Antibodies", category: "Endocrine", typicalUse: "Autoimmune thyroid disease" },
  { name: "Thyroxine (T4) Test", category: "Endocrine", typicalUse: "Thyroid function" },
  { name: "Triiodothyronine (T3) Tests", category: "Endocrine", typicalUse: "Thyroid function" },
  { name: "TSH (Thyroid-stimulating hormone) Test", category: "Endocrine", typicalUse: "Thyroid screening" },
  { name: "17-Hydroxyprogesterone", category: "Endocrine", typicalUse: "Congenital adrenal hyperplasia" },
  
  // Hematology
  { name: "Blood Differential", category: "Hematology", typicalUse: "WBC types" },
  { name: "Blood Smear", category: "Hematology", typicalUse: "Blood cell morphology" },
  { name: "Hematocrit Test", category: "Hematology", typicalUse: "RBC volume fraction" },
  { name: "Hemoglobin Test", category: "Hematology", typicalUse: "Oxygen-carrying capacity" },
  { name: "Hemoglobin Electrophoresis", category: "Hematology", typicalUse: "Hemoglobinopathies" },
  { name: "MCV (Mean Corpuscular Volume)", category: "Hematology", typicalUse: "RBC size" },
  { name: "MPV Blood Test", category: "Hematology", typicalUse: "Platelet size" },
  { name: "Platelet Tests", category: "Hematology", typicalUse: "Platelet count and function" },
  { name: "RDW (Red Cell Distribution Width)", category: "Hematology", typicalUse: "RBC size variation" },
  { name: "Red Blood Cell (RBC) Count", category: "Hematology", typicalUse: "RBC number" },
  { name: "Red Blood Cell (RBC) Indices", category: "Hematology", typicalUse: "RBC parameters" },
  { name: "Red Blood Cell Antibody Screen", category: "Hematology", typicalUse: "Blood compatibility" },
  { name: "Reticulocyte Count", category: "Hematology", typicalUse: "RBC production" },
  { name: "White Blood Count (WBC)", category: "Hematology", typicalUse: "Infection and immunity" },
  { name: "G6PD Test", category: "Hematology", typicalUse: "Enzyme deficiency" },
  { name: "Haptoglobin (HP) Test", category: "Hematology", typicalUse: "Hemolysis" },
  { name: "Bone Marrow Tests", category: "Hematology", typicalUse: "Hematologic malignancies" },
  { name: "Ferritin Blood Test", category: "Hematology", typicalUse: "Iron stores" },
  { name: "Iron Tests", category: "Hematology", typicalUse: "Iron status" },
  
  // Coagulation
  { name: "Coagulation Factor Tests", category: "Coagulation", typicalUse: "Clotting factor deficiency" },
  { name: "D-Dimer Test", category: "Coagulation", typicalUse: "Thrombosis screening" },
  { name: "Partial Thromboplastin Time (PTT) Test", category: "Coagulation", typicalUse: "Intrinsic pathway" },
  { name: "Protein C and Protein S Tests", category: "Coagulation", typicalUse: "Thrombophilia" },
  { name: "Prothrombin Time Test and INR (PT/INR)", category: "Coagulation", typicalUse: "Extrinsic pathway" },
  
  // Immunology/Rheumatology
  { name: "Allergy Blood Test", category: "Immunology", typicalUse: "Allergen-specific IgE" },
  { name: "ANA (Antinuclear Antibody) Test", category: "Immunology", typicalUse: "Autoimmune disease" },
  { name: "Antineutrophil Cytoplasmic Antibodies (ANCA) Test", category: "Immunology", typicalUse: "Vasculitis" },
  { name: "C-Reactive Protein (CRP) Test", category: "Immunology", typicalUse: "Inflammation" },
  { name: "CCP Antibody Test", category: "Immunology", typicalUse: "Rheumatoid arthritis" },
  { name: "Complement Blood Test", category: "Immunology", typicalUse: "Complement activity" },
  { name: "Erythrocyte Sedimentation Rate (ESR)", category: "Immunology", typicalUse: "Inflammation" },
  { name: "Immunoglobulins Blood Test", category: "Immunology", typicalUse: "Antibody levels" },
  { name: "Rheumatoid Factor (RF) Test", category: "Immunology", typicalUse: "Rheumatoid arthritis" },
  { name: "Smooth Muscle Antibody (SMA) Test", category: "Immunology", typicalUse: "Autoimmune hepatitis" },
  { name: "Free Light Chains", category: "Immunology", typicalUse: "Multiple myeloma" },
  { name: "Protein Electrophoresis by Immunofixation Blood Test", category: "Immunology", typicalUse: "Monoclonal gammopathy" },
  
  // Electrolytes and Minerals
  { name: "Calcium Blood Test", category: "Electrolytes", typicalUse: "Calcium level" },
  { name: "Calcium in Urine Test", category: "Electrolytes", typicalUse: "Calcium excretion" },
  { name: "Chloride Blood Test", category: "Electrolytes", typicalUse: "Chloride level" },
  { name: "Electrolyte Panel", category: "Electrolytes", typicalUse: "Electrolyte status" },
  { name: "Magnesium Blood Test", category: "Electrolytes", typicalUse: "Magnesium level" },
  { name: "Phosphate in Blood", category: "Electrolytes", typicalUse: "Phosphate level" },
  { name: "Phosphate in Urine", category: "Electrolytes", typicalUse: "Phosphate excretion" },
  { name: "Potassium Blood Test", category: "Electrolytes", typicalUse: "Potassium level" },
  { name: "Sodium Blood Test", category: "Electrolytes", typicalUse: "Sodium level" },
  
  // Renal Function
  { name: "BUN (Blood Urea Nitrogen)", category: "Renal", typicalUse: "Kidney function" },
  { name: "Creatinine Test", category: "Renal", typicalUse: "Kidney function" },
  { name: "Glomerular Filtration Rate (GFR) Test", category: "Renal", typicalUse: "Kidney filtration" },
  { name: "Microalbumin Creatinine Ratio", category: "Renal", typicalUse: "Early kidney disease" },
  { name: "Uric Acid Test", category: "Renal", typicalUse: "Gout and kidney stones" },
  { name: "Kidney Stone Analysis", category: "Renal", typicalUse: "Stone composition" },
  
  // Cardiac
  { name: "Natriuretic Peptide Tests (BNP, NT-proBNP)", category: "Cardiac", typicalUse: "Heart failure" },
  { name: "Cholesterol Levels", category: "Cardiac", typicalUse: "Lipid profile" },
  { name: "Triglycerides Test", category: "Cardiac", typicalUse: "Lipid metabolism" },
  { name: "Lipoprotein (a) Blood Test", category: "Cardiac", typicalUse: "Cardiovascular risk" },
  { name: "Troponin Test", category: "Cardiac", typicalUse: "Myocardial injury" },
  { name: "Creatine Kinase", category: "Cardiac", typicalUse: "Muscle damage" },
  { name: "Homocysteine Test", category: "Cardiac", typicalUse: "Cardiovascular risk" },
  
  // Gastrointestinal
  { name: "Amylase Test", category: "Gastrointestinal", typicalUse: "Pancreatitis" },
  { name: "Lipase Tests", category: "Gastrointestinal", typicalUse: "Pancreatitis" },
  { name: "Calprotectin Stool Test", category: "Gastrointestinal", typicalUse: "Intestinal inflammation" },
  { name: "Fecal Occult Blood Test (FOBT)", category: "Gastrointestinal", typicalUse: "GI bleeding" },
  { name: "Stool Elastase", category: "Gastrointestinal", typicalUse: "Pancreatic insufficiency" },
  { name: "White Blood Cell (WBC) in Stool", category: "Gastrointestinal", typicalUse: "Intestinal inflammation" },
  { name: "Chymotrypsin in Stool", category: "Gastrointestinal", typicalUse: "Pancreatic function" },
  { name: "Celiac Disease Screening", category: "Gastrointestinal", typicalUse: "Celiac disease" },
  
  // Metabolic
  { name: "Anion Gap Blood Test", category: "Metabolic", typicalUse: "Acid-base status" },
  { name: "Arterial Blood Gas (ABG) Test", category: "Metabolic", typicalUse: "Acid-base and oxygenation" },
  { name: "Carbon Dioxide (CO2) in Blood", category: "Metabolic", typicalUse: "Bicarbonate level" },
  { name: "Lactate Test", category: "Metabolic", typicalUse: "Tissue hypoxia" },
  { name: "Lactate Dehydrogenase (LDH) Test", category: "Metabolic", typicalUse: "Cell turnover" },
  { name: "Lactate Dehydrogenase (LDH) Isoenzymes Test", category: "Metabolic", typicalUse: "Organ-specific damage" },
  { name: "Ammonia Levels", category: "Metabolic", typicalUse: "Hepatic encephalopathy" },
  { name: "Osmolality Tests", category: "Metabolic", typicalUse: "Osmolar gap" },
  { name: "Ceruloplasmin Test", category: "Metabolic", typicalUse: "Wilson disease" },
  { name: "Porphyrin Tests", category: "Metabolic", typicalUse: "Porphyria" },
  
  // Vitamins and Nutrition
  { name: "Alpha-Fetoprotein (AFP) Test", category: "Prenatal", typicalUse: "Neural tube defects" },
  { name: "Vitamin B Test", category: "Vitamins", typicalUse: "B vitamin status" },
  { name: "Vitamin D Test", category: "Vitamins", typicalUse: "Vitamin D status" },
  { name: "Vitamin E (Tocopherol) Test", category: "Vitamins", typicalUse: "Vitamin E status" },
  { name: "Folate Deficiency", category: "Vitamins", typicalUse: "Folate level" },
  { name: "Methylmalonic Acid (MMA) Test", category: "Vitamins", typicalUse: "B12 deficiency" },
  
  // Tumor Markers
  { name: "Alpha Fetoprotein (AFP) Tumor Marker Test", category: "Tumor Markers", typicalUse: "Liver cancer" },
  { name: "Beta 2 Microglobulin (B2M) Tumor Marker Test", category: "Tumor Markers", typicalUse: "Multiple myeloma" },
  { name: "CA 19-9 Blood Test (Pancreatic Cancer)", category: "Tumor Markers", typicalUse: "Pancreatic cancer" },
  { name: "CA-125 Blood Test (Ovarian Cancer)", category: "Tumor Markers", typicalUse: "Ovarian cancer" },
  { name: "CEA Test", category: "Tumor Markers", typicalUse: "Colorectal cancer" },
  { name: "HER2 Tumor Marker Test", category: "Tumor Markers", typicalUse: "Breast cancer" },
  { name: "Prostate-Specific Antigen (PSA) Test", category: "Tumor Markers", typicalUse: "Prostate cancer" },
  { name: "Tumor Marker Tests", category: "Tumor Markers", typicalUse: "Cancer monitoring" },
  
  // Genetics
  { name: "BCR-ABL1 Genetic Test", category: "Genetics", typicalUse: "Chronic myeloid leukemia" },
  { name: "BRAF Genetic Test", category: "Genetics", typicalUse: "Melanoma and colorectal cancer" },
  { name: "BRCA Genetic Test", category: "Genetics", typicalUse: "Breast and ovarian cancer risk" },
  { name: "Karyotype Genetic Test", category: "Genetics", typicalUse: "Chromosomal abnormalities" },
  { name: "Lung Cancer Genetic Tests", category: "Genetics", typicalUse: "Targeted therapy" },
  { name: "MTHFR Mutation Test", category: "Genetics", typicalUse: "Folate metabolism" },
  { name: "Pharmacogenetic Tests", category: "Genetics", typicalUse: "Drug metabolism" },
  { name: "PTEN Genetic Test", category: "Genetics", typicalUse: "Cancer syndromes" },
  { name: "TP53 Genetic Test", category: "Genetics", typicalUse: "Li-Fraumeni syndrome" },
  { name: "Alpha-1 Antitrypsin Testing", category: "Genetics", typicalUse: "Alpha-1 antitrypsin deficiency" },
  { name: "Phenylketonuria (PKU) Screening", category: "Genetics", typicalUse: "PKU" },
  { name: "Galactosemia Tests", category: "Genetics", typicalUse: "Galactosemia" },
  { name: "Sweat Test for Cystic Fibrosis", category: "Genetics", typicalUse: "Cystic fibrosis" },
  
  // Miscellaneous
  { name: "CD4 Lymphocyte Count", category: "Miscellaneous", typicalUse: "HIV monitoring" },
  { name: "Procalcitonin Test", category: "Miscellaneous", typicalUse: "Bacterial infection" },
  { name: "Semen Analysis", category: "Miscellaneous", typicalUse: "Male fertility" },
  { name: "Lactose Tolerance Tests", category: "Miscellaneous", typicalUse: "Lactose intolerance" },
  { name: "Xylose Testing", category: "Miscellaneous", typicalUse: "Malabsorption" },
  { name: "Pregnancy Test", category: "Miscellaneous", typicalUse: "Pregnancy detection" },
  { name: "Prenatal Cell-Free DNA Screening", category: "Miscellaneous", typicalUse: "Fetal aneuploidy" },
  { name: "Prenatal Panel", category: "Miscellaneous", typicalUse: "Prenatal screening" },
  { name: "Cord Blood Testing and Banking", category: "Miscellaneous", typicalUse: "Stem cell banking" },
  { name: "Estrogen Receptor, Progesterone Receptor Tests", category: "Miscellaneous", typicalUse: "Breast cancer therapy" },
  { name: "PDL1 (Immunotherapy) Tests", category: "Miscellaneous", typicalUse: "Immunotherapy eligibility" },
  { name: "CSF Immunoglobulin G (IgG) Index", category: "Miscellaneous", typicalUse: "Multiple sclerosis" },
  { name: "Cerebrospinal Fluid (CSF) Analysis", category: "Miscellaneous", typicalUse: "CNS infection" },
  { name: "Pleural Fluid Analysis", category: "Miscellaneous", typicalUse: "Pleural effusion" },
  { name: "Synovial Fluid Analysis", category: "Miscellaneous", typicalUse: "Joint disease" },
  { name: "Amniocentesis (amniotic fluid test)", category: "Miscellaneous", typicalUse: "Prenatal diagnosis" },
  { name: "Chorionic Villus Sampling (CVS)", category: "Miscellaneous", typicalUse: "Prenatal diagnosis" },
];

/**
 * Get all unique test categories
 */
export function getLabCategories(): string[] {
  const categories = new Set(LAB_TEST_DATABASE.map(test => test.category));
  return Array.from(categories).sort();
}

/**
 * Get tests by category
 */
export function getTestsByCategory(category: string): LabTestDefinition[] {
  return LAB_TEST_DATABASE.filter(test => test.category === category);
}

/**
 * Search tests by name
 */
export function searchLabTests(query: string): LabTestDefinition[] {
  const lowerQuery = query.toLowerCase();
  return LAB_TEST_DATABASE.filter(test => 
    test.name.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Default tests that are always shown initially
 */
export const DEFAULT_TESTS = [
  "Basic Metabolic Panel (BMP)",
  "Complete Blood Count (CBC)",
  "Liver Function Tests"
];
