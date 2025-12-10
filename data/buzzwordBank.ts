/**
 * Comprehensive Buzzword Bank for PANaCEa Medical Learning Platform
 * 
 * This file contains high-yield medical buzzwords mapped to their associated conditions.
 * Used in Rapid Recall, Buzzword modes, and question generation.
 */

import type { SystemCode } from '../types';

export interface BuzzwordEntry {
  buzzword: string;
  condition: string;
  system: SystemCode;
  subcategory?: string;
  explanation?: string;
}

/**
 * Master buzzword registry organized by organ system
 */
export const BUZZWORD_BANK: BuzzwordEntry[] = [
  // ========================
  // CARDIOVASCULAR (CV)
  // ========================
  { buzzword: 'Boot-shaped heart', condition: 'Tetralogy of Fallot', system: 'CV', subcategory: 'Congenital Heart Disease', explanation: 'Classic X-ray appearance due to right ventricular hypertrophy' },
  { buzzword: 'Egg on a string', condition: 'Transposition of the Great Arteries', system: 'CV', subcategory: 'Congenital Heart Disease', explanation: 'Narrow mediastinum gives egg-like cardiac silhouette' },
  { buzzword: 'Water hammer pulse', condition: 'Aortic Regurgitation', system: 'CV', subcategory: 'Valvular Disease', explanation: 'Bounding pulse with rapid upstroke and collapse' },
  { buzzword: 'Pulsus parvus et tardus', condition: 'Aortic Stenosis', system: 'CV', subcategory: 'Valvular Disease', explanation: 'Weak and delayed carotid pulse' },
  { buzzword: 'Crescendo-decrescendo murmur', condition: 'Aortic Stenosis', system: 'CV', subcategory: 'Valvular Disease', explanation: 'Systolic ejection murmur at right upper sternal border' },
  { buzzword: 'Holosystolic murmur', condition: 'Mitral Regurgitation', system: 'CV', subcategory: 'Valvular Disease', explanation: 'Pansystolic murmur radiating to axilla' },
  { buzzword: 'Opening snap', condition: 'Mitral Stenosis', system: 'CV', subcategory: 'Valvular Disease', explanation: 'Best heard at apex after S2' },
  { buzzword: 'Irregularly irregular rhythm', condition: 'Atrial Fibrillation', system: 'CV', subcategory: 'ECG', explanation: 'No discernible P waves, varying R-R intervals' },
  { buzzword: 'Sawtooth pattern', condition: 'Atrial Flutter', system: 'CV', subcategory: 'ECG', explanation: 'Flutter waves at 250-350 bpm' },
  { buzzword: 'Torsades de pointes', condition: 'Long QT Syndrome', system: 'CV', subcategory: 'ECG', explanation: 'Polymorphic VT with twisting QRS axis' },
  { buzzword: 'Delta wave', condition: 'Wolff-Parkinson-White Syndrome', system: 'CV', subcategory: 'ECG', explanation: 'Slurred upstroke of QRS due to accessory pathway' },
  { buzzword: 'Tombstone ST elevation', condition: 'STEMI', system: 'CV', subcategory: 'Ischemic Heart Disease', explanation: 'Massive ST elevation suggesting extensive infarction' },
  { buzzword: 'J-point elevation', condition: 'Pericarditis', system: 'CV', subcategory: 'Carditis', explanation: 'Diffuse ST elevation with PR depression' },
  { buzzword: 'Electrical alternans', condition: 'Pericardial Effusion', system: 'CV', subcategory: 'Carditis', explanation: 'Beat-to-beat variation in QRS amplitude' },
  { buzzword: 'Pulsus paradoxus', condition: 'Cardiac Tamponade', system: 'CV', subcategory: 'Carditis', explanation: 'Drop in SBP >10mmHg during inspiration' },
  { buzzword: 'Beck triad', condition: 'Cardiac Tamponade', system: 'CV', subcategory: 'Carditis', explanation: 'Hypotension, JVD, muffled heart sounds' },
  { buzzword: 'Kussmaul sign', condition: 'Constrictive Pericarditis', system: 'CV', subcategory: 'Carditis', explanation: 'Paradoxical rise in JVP with inspiration' },
  { buzzword: 'Janeway lesions', condition: 'Endocarditis', system: 'CV', subcategory: 'Carditis', explanation: 'Painless erythematous lesions on palms and soles' },
  { buzzword: 'Osler nodes', condition: 'Endocarditis', system: 'CV', subcategory: 'Carditis', explanation: 'Painful nodules on fingers and toes' },
  { buzzword: 'Splinter hemorrhages', condition: 'Endocarditis', system: 'CV', subcategory: 'Carditis', explanation: 'Linear lesions under fingernails' },
  { buzzword: 'Roth spots', condition: 'Endocarditis', system: 'CV', subcategory: 'Carditis', explanation: 'Retinal hemorrhages with pale centers' },
  { buzzword: 'Ankle-brachial index <0.9', condition: 'Peripheral Arterial Disease', system: 'CV', subcategory: 'Vascular Disease', explanation: 'Indicates significant peripheral artery stenosis' },
  { buzzword: 'Machine-like murmur', condition: 'Patent Ductus Arteriosus', system: 'CV', subcategory: 'Congenital Heart Disease', explanation: 'Continuous murmur heard best at left upper sternal border' },
  { buzzword: 'Differential cyanosis', condition: 'Patent Ductus Arteriosus', system: 'CV', subcategory: 'Congenital Heart Disease', explanation: 'Lower extremity cyanosis with pink upper extremities' },
  { buzzword: 'Fixed split S2', condition: 'Atrial Septal Defect', system: 'CV', subcategory: 'Congenital Heart Disease', explanation: 'Does not vary with respiration' },

  // ========================
  // PULMONARY (PULM)
  // ========================
  { buzzword: 'Barrel chest', condition: 'COPD/Emphysema', system: 'PULM', subcategory: 'Obstructive', explanation: 'Increased AP diameter due to hyperinflation' },
  { buzzword: 'Pink puffer', condition: 'Emphysema', system: 'PULM', subcategory: 'Obstructive', explanation: 'Thin, pursed-lip breathing, minimal cyanosis' },
  { buzzword: 'Blue bloater', condition: 'Chronic Bronchitis', system: 'PULM', subcategory: 'Obstructive', explanation: 'Overweight, cyanotic, chronic cough' },
  { buzzword: 'Tripod position', condition: 'COPD Exacerbation', system: 'PULM', subcategory: 'Obstructive', explanation: 'Sitting forward with arms braced to optimize breathing' },
  { buzzword: 'Wheezing', condition: 'Asthma', system: 'PULM', subcategory: 'Obstructive', explanation: 'High-pitched whistling sound on expiration' },
  { buzzword: 'Hampton hump', condition: 'Pulmonary Embolism', system: 'PULM', subcategory: 'Pulmonary Circulation', explanation: 'Wedge-shaped opacity on CXR (pulmonary infarction)' },
  { buzzword: 'Westermark sign', condition: 'Pulmonary Embolism', system: 'PULM', subcategory: 'Pulmonary Circulation', explanation: 'Focal oligemia (decreased vascular markings)' },
  { buzzword: 'S1Q3T3', condition: 'Pulmonary Embolism', system: 'PULM', subcategory: 'Pulmonary Circulation', explanation: 'ECG pattern: S in I, Q and inverted T in III' },
  { buzzword: 'Ghon complex', condition: 'Primary Tuberculosis', system: 'PULM', subcategory: 'Infectious', explanation: 'Primary focus in mid-lung zone with hilar lymphadenopathy' },
  { buzzword: 'Ranke complex', condition: 'Healed Primary TB', system: 'PULM', subcategory: 'Infectious', explanation: 'Calcified Ghon complex' },
  { buzzword: 'Cavitation', condition: 'Tuberculosis', system: 'PULM', subcategory: 'Infectious', explanation: 'Air-filled cavity in upper lobes' },
  { buzzword: 'Honeycombing', condition: 'Idiopathic Pulmonary Fibrosis', system: 'PULM', subcategory: 'Interstitial', explanation: 'Clustered cystic spaces with thick walls on CT' },
  { buzzword: 'Ground glass opacities', condition: 'Pneumocystis jirovecii Pneumonia (PCP)', system: 'PULM', subcategory: 'Infectious', explanation: 'Hazy lung opacification without obscuring vessels' },
  { buzzword: 'Steeple sign', condition: 'Croup (Laryngotracheobronchitis)', system: 'PULM', subcategory: 'Infectious', explanation: 'Subglottic narrowing on AP neck X-ray' },
  { buzzword: 'Thumb sign', condition: 'Epiglottitis', system: 'PULM', subcategory: 'Infectious', explanation: 'Swollen epiglottis on lateral neck X-ray' },
  { buzzword: 'Bilateral hilar lymphadenopathy', condition: 'Sarcoidosis', system: 'PULM', subcategory: 'Interstitial', explanation: 'Potato nodes on CXR' },
  { buzzword: 'Non-caseating granulomas', condition: 'Sarcoidosis', system: 'PULM', subcategory: 'Interstitial', explanation: 'Granulomas without central necrosis' },
  { buzzword: 'Silhouette sign', condition: 'Community-Acquired Pneumonia', system: 'PULM', subcategory: 'Infectious', explanation: 'Loss of right heart border silhouette (RML pneumonia)' },
  { buzzword: 'Air bronchograms', condition: 'Pneumonia', system: 'PULM', subcategory: 'Infectious', explanation: 'Air-filled bronchi visible within consolidated lung' },
  { buzzword: 'Meniscus sign', condition: 'Pleural Effusion', system: 'PULM', subcategory: 'Pleural Disease', explanation: 'Concave upper border of pleural fluid on upright CXR' },

  // ========================
  // GASTROINTESTINAL (GI)
  // ========================
  { buzzword: 'Apple core lesion', condition: 'Colorectal Cancer', system: 'GI', subcategory: 'Colon', explanation: 'Napkin-ring constricting lesion on barium enema' },
  { buzzword: 'String sign', condition: 'Crohn Disease', system: 'GI', subcategory: 'Colon', explanation: 'Narrow terminal ileum on barium study' },
  { buzzword: 'Lead pipe colon', condition: 'Ulcerative Colitis', system: 'GI', subcategory: 'Colon', explanation: 'Loss of haustra with featureless colon' },
  { buzzword: 'Skip lesions', condition: 'Crohn Disease', system: 'GI', subcategory: 'Colon', explanation: 'Patchy involvement with normal intervening bowel' },
  { buzzword: 'Cobblestone mucosa', condition: 'Crohn Disease', system: 'GI', subcategory: 'Colon', explanation: 'Deep ulcers with intervening normal mucosa' },
  { buzzword: 'Currant jelly stool', condition: 'Intussusception', system: 'GI', subcategory: 'Small Bowel', explanation: 'Blood and mucus mixture in pediatric bowel obstruction' },
  { buzzword: 'Bird beak sign', condition: 'Sigmoid Volvulus', system: 'GI', subcategory: 'Colon', explanation: 'Tapered end of twisted bowel on contrast study' },
  { buzzword: 'Coffee bean sign', condition: 'Sigmoid Volvulus', system: 'GI', subcategory: 'Colon', explanation: 'Ahaustral sigmoid loop on abdominal X-ray' },
  { buzzword: 'Thumb printing', condition: 'Ischemic Colitis', system: 'GI', subcategory: 'Colon', explanation: 'Mucosal thickening on plain film' },
  { buzzword: 'Double bubble sign', condition: 'Duodenal Atresia', system: 'GI', subcategory: 'Small Bowel', explanation: 'Air in stomach and proximal duodenum' },
  { buzzword: 'Target sign', condition: 'Intussusception', system: 'GI', subcategory: 'Small Bowel', explanation: 'Concentric rings on ultrasound cross-section' },
  { buzzword: 'Pseudokidney sign', condition: 'Intussusception', system: 'GI', subcategory: 'Small Bowel', explanation: 'Longitudinal ultrasound appearance' },
  { buzzword: 'Caput medusae', condition: 'Portal Hypertension', system: 'GI', subcategory: 'Liver', explanation: 'Dilated periumbilical veins' },
  { buzzword: 'Spider angiomata', condition: 'Cirrhosis', system: 'GI', subcategory: 'Liver', explanation: 'Central arteriole with radiating vessels' },
  { buzzword: 'Palmar erythema', condition: 'Cirrhosis', system: 'GI', subcategory: 'Liver', explanation: 'Red discoloration of palms' },
  { buzzword: 'Asterixis', condition: 'Hepatic Encephalopathy', system: 'GI', subcategory: 'Liver', explanation: 'Flapping tremor of extended wrists' },
  { buzzword: 'Murphy sign', condition: 'Cholecystitis', system: 'GI', subcategory: 'Gallbladder', explanation: 'Inspiratory arrest with RUQ palpation' },
  { buzzword: 'Charcot triad', condition: 'Cholangitis', system: 'GI', subcategory: 'Gallbladder', explanation: 'Fever, jaundice, RUQ pain' },
  { buzzword: 'Reynolds pentad', condition: 'Suppurative Cholangitis', system: 'GI', subcategory: 'Gallbladder', explanation: 'Charcot triad plus hypotension and AMS' },
  { buzzword: 'Courvoisier sign', condition: 'Pancreatic Cancer', system: 'GI', subcategory: 'Pancreas', explanation: 'Painless jaundice with palpable gallbladder' },
  { buzzword: 'Grey Turner sign', condition: 'Acute Pancreatitis', system: 'GI', subcategory: 'Pancreas', explanation: 'Flank ecchymosis' },
  { buzzword: 'Cullen sign', condition: 'Acute Pancreatitis', system: 'GI', subcategory: 'Pancreas', explanation: 'Periumbilical ecchymosis' },
  { buzzword: 'Sentinel loop', condition: 'Acute Pancreatitis', system: 'GI', subcategory: 'Pancreas', explanation: 'Isolated dilated loop of small bowel' },
  { buzzword: 'Virchow node', condition: 'Gastric Cancer', system: 'GI', subcategory: 'Stomach', explanation: 'Left supraclavicular lymphadenopathy' },
  { buzzword: 'Sister Mary Joseph nodule', condition: 'GI Malignancy', system: 'GI', subcategory: 'Stomach', explanation: 'Periumbilical metastatic nodule' },
  { buzzword: 'Krukenberg tumor', condition: 'Gastric Cancer', system: 'GI', subcategory: 'Stomach', explanation: 'Bilateral ovarian metastases' },
  { buzzword: 'Succussion splash', condition: 'Gastric Outlet Obstruction', system: 'GI', subcategory: 'Stomach', explanation: 'Splashing sound with abdominal shake' },
  { buzzword: 'Schatzki ring', condition: 'Esophageal Ring', system: 'GI', subcategory: 'Esophagus', explanation: 'Mucosal ring at GE junction' },
  { buzzword: 'Corkscrew esophagus', condition: 'Diffuse Esophageal Spasm', system: 'GI', subcategory: 'Esophagus', explanation: 'Multiple simultaneous contractions on barium swallow' },

  // ========================
  // NEUROLOGICAL (NEURO)
  // ========================
  { buzzword: 'Charcot triad (neuro)', condition: 'Multiple Sclerosis', system: 'NEURO', subcategory: 'Demyelinating', explanation: 'Nystagmus, intention tremor, scanning speech' },
  { buzzword: 'Internuclear ophthalmoplegia', condition: 'Multiple Sclerosis', system: 'NEURO', subcategory: 'Demyelinating', explanation: 'Impaired adduction with contralateral nystagmus' },
  { buzzword: 'Dawson fingers', condition: 'Multiple Sclerosis', system: 'NEURO', subcategory: 'Demyelinating', explanation: 'Periventricular lesions perpendicular to ventricles on MRI' },
  { buzzword: 'Pill-rolling tremor', condition: 'Parkinson Disease', system: 'NEURO', subcategory: 'Movement Disorders', explanation: 'Resting tremor of thumb and forefinger' },
  { buzzword: 'Cogwheel rigidity', condition: 'Parkinson Disease', system: 'NEURO', subcategory: 'Movement Disorders', explanation: 'Ratchet-like resistance to passive movement' },
  { buzzword: 'Festinating gait', condition: 'Parkinson Disease', system: 'NEURO', subcategory: 'Movement Disorders', explanation: 'Short shuffling steps with forward lean' },
  { buzzword: 'Chorea', condition: 'Huntington Disease', system: 'NEURO', subcategory: 'Movement Disorders', explanation: 'Rapid, irregular, unpredictable movements' },
  { buzzword: 'Caudate atrophy', condition: 'Huntington Disease', system: 'NEURO', subcategory: 'Movement Disorders', explanation: 'Box-car ventricles on imaging' },
  { buzzword: 'Kayser-Fleischer rings', condition: 'Wilson Disease', system: 'NEURO', subcategory: 'Movement Disorders', explanation: 'Copper deposits in Descemet membrane' },
  { buzzword: 'Kernig sign', condition: 'Meningitis', system: 'NEURO', subcategory: 'Infectious', explanation: 'Pain with knee extension when hip flexed' },
  { buzzword: 'Brudzinski sign', condition: 'Meningitis', system: 'NEURO', subcategory: 'Infectious', explanation: 'Hip flexion with neck flexion' },
  { buzzword: 'Thunderclap headache', condition: 'Subarachnoid Hemorrhage', system: 'NEURO', subcategory: 'Vascular', explanation: 'Worst headache of life, sudden onset' },
  { buzzword: 'Xanthochromia', condition: 'Subarachnoid Hemorrhage', system: 'NEURO', subcategory: 'Vascular', explanation: 'Yellow CSF from hemoglobin breakdown' },
  { buzzword: 'Uncal herniation', condition: 'Increased Intracranial Pressure', system: 'NEURO', subcategory: 'Trauma', explanation: 'CN III palsy with contralateral hemiparesis' },
  { buzzword: 'Cushing triad', condition: 'Increased Intracranial Pressure', system: 'NEURO', subcategory: 'Trauma', explanation: 'Hypertension, bradycardia, irregular respirations' },
  { buzzword: 'Battle sign', condition: 'Basilar Skull Fracture', system: 'NEURO', subcategory: 'Trauma', explanation: 'Mastoid ecchymosis' },
  { buzzword: 'Raccoon eyes', condition: 'Basilar Skull Fracture', system: 'NEURO', subcategory: 'Trauma', explanation: 'Periorbital ecchymosis' },
  { buzzword: 'CSF rhinorrhea', condition: 'Basilar Skull Fracture', system: 'NEURO', subcategory: 'Trauma', explanation: 'Clear fluid from nose (halo test positive)' },
  { buzzword: 'Lhermitte sign', condition: 'Multiple Sclerosis', system: 'NEURO', subcategory: 'Demyelinating', explanation: 'Electric sensation down spine with neck flexion' },
  { buzzword: 'Positive Romberg', condition: 'Posterior Column Disease', system: 'NEURO', subcategory: 'Sensory', explanation: 'Loss of balance with eyes closed' },
  { buzzword: 'Pronator drift', condition: 'Upper Motor Neuron Lesion', system: 'NEURO', subcategory: 'Motor', explanation: 'Arm pronates and drifts downward with eyes closed' },
  { buzzword: 'Babinski sign', condition: 'Upper Motor Neuron Lesion', system: 'NEURO', subcategory: 'Motor', explanation: 'Upgoing great toe with plantar stimulation' },
  { buzzword: 'Foot drop', condition: 'Peroneal Nerve Palsy', system: 'NEURO', subcategory: 'Peripheral Neuropathy', explanation: 'Weakness of ankle dorsiflexion' },
  { buzzword: 'Wrist drop', condition: 'Radial Nerve Palsy', system: 'NEURO', subcategory: 'Peripheral Neuropathy', explanation: 'Weakness of wrist extension' },
  { buzzword: 'Claw hand', condition: 'Ulnar Nerve Palsy', system: 'NEURO', subcategory: 'Peripheral Neuropathy', explanation: 'MCP hyperextension with IP flexion' },
  { buzzword: 'Ape hand', condition: 'Median Nerve Palsy', system: 'NEURO', subcategory: 'Peripheral Neuropathy', explanation: 'Thenar atrophy with thumb in plane with palm' },
  { buzzword: 'Ascending paralysis', condition: 'Guillain-Barré Syndrome', system: 'NEURO', subcategory: 'Peripheral Neuropathy', explanation: 'Symmetric weakness starting in legs' },
  { buzzword: 'Albuminocytologic dissociation', condition: 'Guillain-Barré Syndrome', system: 'NEURO', subcategory: 'Peripheral Neuropathy', explanation: 'Elevated protein with normal cell count in CSF' },

  // ========================
  // DERMATOLOGY (DERM)
  // ========================
  { buzzword: 'Café-au-lait spots', condition: 'Neurofibromatosis', system: 'DERM', subcategory: 'Neurocutaneous', explanation: 'Light brown macules, >6 and >5mm for NF1' },
  { buzzword: 'Ash leaf spots', condition: 'Tuberous Sclerosis', system: 'DERM', subcategory: 'Neurocutaneous', explanation: 'Hypopigmented macules' },
  { buzzword: 'Shagreen patch', condition: 'Tuberous Sclerosis', system: 'DERM', subcategory: 'Neurocutaneous', explanation: 'Leathery skin plaque on lower back' },
  { buzzword: 'Adenoma sebaceum', condition: 'Tuberous Sclerosis', system: 'DERM', subcategory: 'Neurocutaneous', explanation: 'Facial angiofibromas' },
  { buzzword: 'Butterfly rash', condition: 'Acute Cutaneous Lupus Erythematosus', system: 'DERM', subcategory: 'Autoimmune', explanation: 'Malar rash sparing nasolabial folds' },
  { buzzword: 'Discoid rash', condition: 'Discoid Lupus Erythematosus', system: 'DERM', subcategory: 'Autoimmune', explanation: 'Scarring circular plaques' },
  { buzzword: 'Heliotrope rash', condition: 'Dermatomyositis', system: 'DERM', subcategory: 'Autoimmune', explanation: 'Purple-red eyelid discoloration' },
  { buzzword: 'Gottron papules', condition: 'Dermatomyositis', system: 'DERM', subcategory: 'Autoimmune', explanation: 'Erythematous papules over knuckles' },
  { buzzword: 'Shawl sign', condition: 'Dermatomyositis', system: 'DERM', subcategory: 'Autoimmune', explanation: 'V-shaped rash on chest and back' },
  { buzzword: 'Target lesions', condition: 'Erythema Multiforme', system: 'DERM', subcategory: 'Reactive', explanation: 'Concentric rings like a bullseye' },
  { buzzword: 'Nikolsky sign positive', condition: 'Pemphigus Vulgaris', system: 'DERM', subcategory: 'Bullous', explanation: 'Skin sloughs with lateral pressure' },
  { buzzword: 'Auspitz sign', condition: 'Psoriasis', system: 'DERM', subcategory: 'Papulosquamous', explanation: 'Pinpoint bleeding when scale removed' },
  { buzzword: 'Koebner phenomenon', condition: 'Psoriasis', system: 'DERM', subcategory: 'Papulosquamous', explanation: 'Lesions at sites of trauma' },
  { buzzword: 'Herald patch', condition: 'Pityriasis Rosea', system: 'DERM', subcategory: 'Papulosquamous', explanation: 'Initial large oval plaque' },
  { buzzword: 'Christmas tree pattern', condition: 'Pityriasis Rosea', system: 'DERM', subcategory: 'Papulosquamous', explanation: 'Distribution along Langer lines' },
  { buzzword: 'Dewdrop on a rose petal', condition: 'Varicella', system: 'DERM', subcategory: 'Infectious – Viral', explanation: 'Vesicle on erythematous base' },
  { buzzword: 'Dermatomal distribution', condition: 'Herpes Zoster', system: 'DERM', subcategory: 'Infectious – Viral', explanation: 'Vesicles following nerve distribution' },
  { buzzword: 'Honey-colored crusts', condition: 'Impetigo', system: 'DERM', subcategory: 'Infectious – Bacterial', explanation: 'Characteristic appearance of Staph/Strep infection' },
  { buzzword: 'Umbilicated papules', condition: 'Molluscum Contagiosum', system: 'DERM', subcategory: 'Infectious – Viral', explanation: 'Dome-shaped papules with central depression' },
  { buzzword: 'Burrows', condition: 'Scabies', system: 'DERM', subcategory: 'Infectious – Parasitic', explanation: 'Linear tracks in web spaces' },
  { buzzword: 'Exclamation point hairs', condition: 'Alopecia Areata', system: 'DERM', subcategory: 'Hair Disorders', explanation: 'Broken hairs narrowing toward scalp' },
  { buzzword: 'Wickham striae', condition: 'Lichen Planus', system: 'DERM', subcategory: 'Papulosquamous', explanation: 'White lacy lines on purple papules' },
  { buzzword: 'Five Ps', condition: 'Lichen Planus', system: 'DERM', subcategory: 'Papulosquamous', explanation: 'Purple, polygonal, planar, pruritic papules' },
  { buzzword: 'Spaghetti and meatballs', condition: 'Tinea Versicolor', system: 'DERM', subcategory: 'Infectious – Fungal', explanation: 'KOH prep showing hyphae and yeast' },
  { buzzword: 'Sunburst pattern', condition: 'Osteosarcoma', system: 'MSK', subcategory: 'Oncology', explanation: 'Periosteal reaction on X-ray' },

  // ========================
  // HEMATOLOGY (HEME)
  // ========================
  { buzzword: 'Auer rods', condition: 'Acute Myeloid Leukemia', system: 'HEME', subcategory: 'Leukemia', explanation: 'Pink needle-like inclusions in myeloblasts' },
  { buzzword: 'Smudge cells', condition: 'Chronic Lymphocytic Leukemia', system: 'HEME', subcategory: 'Leukemia', explanation: 'Fragile lymphocytes destroyed on smear' },
  { buzzword: 'Philadelphia chromosome', condition: 'Chronic Myelogenous Leukemia', system: 'HEME', subcategory: 'Leukemia', explanation: 't(9;22) BCR-ABL fusion gene' },
  { buzzword: 'Reed-Sternberg cells', condition: 'Hodgkin Lymphoma', system: 'HEME', subcategory: 'Lymphoma', explanation: 'Owl-eye bilobed nuclei' },
  { buzzword: 'Starry sky pattern', condition: 'Burkitt Lymphoma', system: 'HEME', subcategory: 'Lymphoma', explanation: 'Macrophages among sheets of lymphoma cells' },
  { buzzword: 'Rouleaux formation', condition: 'Multiple Myeloma', system: 'HEME', subcategory: 'Plasma Cell', explanation: 'Stacked RBCs on peripheral smear' },
  { buzzword: 'M-spike', condition: 'Multiple Myeloma', system: 'HEME', subcategory: 'Plasma Cell', explanation: 'Monoclonal protein on SPEP' },
  { buzzword: 'Bence-Jones proteinuria', condition: 'Multiple Myeloma', system: 'HEME', subcategory: 'Plasma Cell', explanation: 'Light chains in urine' },
  { buzzword: 'Punched-out lytic lesions', condition: 'Multiple Myeloma', system: 'HEME', subcategory: 'Plasma Cell', explanation: 'Osteolytic bone lesions without sclerosis' },
  { buzzword: 'Sickle cells', condition: 'Sickle Cell Disease', system: 'HEME', subcategory: 'Hemoglobinopathy', explanation: 'Crescent-shaped RBCs' },
  { buzzword: 'Target cells', condition: 'Thalassemia', system: 'HEME', subcategory: 'Hemoglobinopathy', explanation: 'Bull\'s eye appearance on smear' },
  { buzzword: 'Howell-Jolly bodies', condition: 'Asplenia', system: 'HEME', subcategory: 'Anemia', explanation: 'Nuclear remnants in RBCs' },
  { buzzword: 'Schistocytes', condition: 'Microangiopathic Hemolytic Anemia', system: 'HEME', subcategory: 'Hemolytic', explanation: 'Fragmented RBCs (helmet cells)' },
  { buzzword: 'Spherocytes', condition: 'Hereditary Spherocytosis', system: 'HEME', subcategory: 'Hemolytic', explanation: 'Small round RBCs lacking central pallor' },
  { buzzword: 'Bite cells', condition: 'G6PD Deficiency', system: 'HEME', subcategory: 'Hemolytic', explanation: 'RBCs with peripheral indentation' },
  { buzzword: 'Heinz bodies', condition: 'G6PD Deficiency', system: 'HEME', subcategory: 'Hemolytic', explanation: 'Denatured hemoglobin inclusions' },
  { buzzword: 'Hypersegmented neutrophils', condition: 'Vitamin B12 Deficiency Anemia', system: 'HEME', subcategory: 'Anemia', explanation: '>5 lobes, B12/folate deficiency' },
  { buzzword: 'Tear drop cells', condition: 'Myelofibrosis', system: 'HEME', subcategory: 'Myeloproliferative', explanation: 'Dacrocytes from marrow fibrosis' },
  { buzzword: 'Dry tap', condition: 'Myelofibrosis', system: 'HEME', subcategory: 'Myeloproliferative', explanation: 'Unable to aspirate bone marrow' },

  // ========================
  // ENDOCRINE (ENDO)
  // ========================
  { buzzword: 'Exophthalmos', condition: 'Graves Disease', system: 'ENDO', subcategory: 'Thyroid', explanation: 'Protrusion of eyes' },
  { buzzword: 'Pretibial myxedema', condition: 'Graves Disease', system: 'ENDO', subcategory: 'Thyroid', explanation: 'Non-pitting edema on shins' },
  { buzzword: 'Thyroid bruit', condition: 'Graves Disease', system: 'ENDO', subcategory: 'Thyroid', explanation: 'Vascular hum over hypervascular thyroid' },
  { buzzword: 'Moon facies', condition: 'Cushing Syndrome', system: 'ENDO', subcategory: 'Adrenal', explanation: 'Rounded, plethoric face' },
  { buzzword: 'Buffalo hump', condition: 'Cushing Syndrome', system: 'ENDO', subcategory: 'Adrenal', explanation: 'Dorsocervical fat pad' },
  { buzzword: 'Purple striae', condition: 'Cushing Syndrome', system: 'ENDO', subcategory: 'Adrenal', explanation: 'Wide stretch marks on abdomen' },
  { buzzword: 'Hyperpigmentation', condition: 'Addison Disease', system: 'ENDO', subcategory: 'Adrenal', explanation: 'Bronze skin from elevated ACTH' },
  { buzzword: 'Salt craving', condition: 'Addison Disease', system: 'ENDO', subcategory: 'Adrenal', explanation: 'Due to mineralocorticoid deficiency' },
  { buzzword: 'Fruity breath', condition: 'Diabetic Ketoacidosis', system: 'ENDO', subcategory: 'Diabetes', explanation: 'Acetone from ketone production' },
  { buzzword: 'Kussmaul breathing', condition: 'Diabetic Ketoacidosis', system: 'ENDO', subcategory: 'Diabetes', explanation: 'Deep, rapid respirations for CO2 clearance' },
  { buzzword: 'Chvostek sign', condition: 'Hypocalcemia', system: 'ENDO', subcategory: 'Calcium/Parathyroid', explanation: 'Facial twitching with cheek tap' },
  { buzzword: 'Trousseau sign', condition: 'Hypocalcemia', system: 'ENDO', subcategory: 'Calcium/Parathyroid', explanation: 'Carpopedal spasm with BP cuff inflation' },
  { buzzword: 'Stones, bones, groans, moans', condition: 'Hyperparathyroidism', system: 'ENDO', subcategory: 'Calcium/Parathyroid', explanation: 'Kidney stones, bone pain, constipation, psych symptoms' },
  { buzzword: 'Galactorrhea', condition: 'Prolactinoma', system: 'ENDO', subcategory: 'Pituitary', explanation: 'Milk discharge not associated with pregnancy' },
  { buzzword: 'Bitemporal hemianopsia', condition: 'Pituitary Adenoma', system: 'ENDO', subcategory: 'Pituitary', explanation: 'Loss of peripheral vision from optic chiasm compression' },
  { buzzword: 'Acromegalic facies', condition: 'Acromegaly', system: 'ENDO', subcategory: 'Pituitary', explanation: 'Frontal bossing, prognathism, enlarged hands/feet' },

  // ========================
  // MUSCULOSKELETAL (MSK)
  // ========================
  { buzzword: 'Bamboo spine', condition: 'Ankylosing Spondylitis', system: 'MSK', subcategory: 'Seronegative Spondyloarthropathy', explanation: 'Vertebral fusion on X-ray' },
  { buzzword: 'Pencil-in-cup deformity', condition: 'Psoriatic Arthritis', system: 'MSK', subcategory: 'Arthritis', explanation: 'Erosion with adjacent proliferation' },
  { buzzword: 'Dactylitis', condition: 'Psoriatic Arthritis', system: 'MSK', subcategory: 'Arthritis', explanation: 'Sausage digits' },
  { buzzword: 'Swan neck deformity', condition: 'Rheumatoid Arthritis', system: 'MSK', subcategory: 'Arthritis', explanation: 'PIP hyperextension with DIP flexion' },
  { buzzword: 'Boutonniere deformity', condition: 'Rheumatoid Arthritis', system: 'MSK', subcategory: 'Arthritis', explanation: 'PIP flexion with DIP hyperextension' },
  { buzzword: 'Ulnar deviation', condition: 'Rheumatoid Arthritis', system: 'MSK', subcategory: 'Arthritis', explanation: 'MCP joint deviation toward ulna' },
  { buzzword: 'Heberden nodes', condition: 'Osteoarthritis', system: 'MSK', subcategory: 'Arthritis', explanation: 'Bony nodules at DIP joints' },
  { buzzword: 'Bouchard nodes', condition: 'Osteoarthritis', system: 'MSK', subcategory: 'Arthritis', explanation: 'Bony nodules at PIP joints' },
  { buzzword: 'Tophi', condition: 'Gout', system: 'MSK', subcategory: 'Crystal Disease', explanation: 'Urate crystal deposits in soft tissue' },
  { buzzword: 'Podagra', condition: 'Gout', system: 'MSK', subcategory: 'Crystal Disease', explanation: 'Acute gouty arthritis of great toe' },
  { buzzword: 'Negatively birefringent crystals', condition: 'Gout', system: 'MSK', subcategory: 'Crystal Disease', explanation: 'Yellow under parallel light (urate)' },
  { buzzword: 'Positively birefringent crystals', condition: 'Pseudogout', system: 'MSK', subcategory: 'Crystal Disease', explanation: 'Blue under parallel light (CPPD)' },
  { buzzword: 'Chondrocalcinosis', condition: 'Pseudogout', system: 'MSK', subcategory: 'Crystal Disease', explanation: 'Calcium deposits in cartilage on X-ray' },
  { buzzword: 'Compression fracture', condition: 'Osteoporosis', system: 'MSK', subcategory: 'Metabolic/Bone', explanation: 'Vertebral wedging' },
  { buzzword: 'Dowager hump', condition: 'Osteoporosis', system: 'MSK', subcategory: 'Metabolic/Bone', explanation: 'Thoracic kyphosis from compression fractures' },
  { buzzword: 'Onion skinning', condition: 'Ewing Sarcoma', system: 'MSK', subcategory: 'Oncology', explanation: 'Periosteal layering on X-ray' },
  { buzzword: 'Codman triangle', condition: 'Osteosarcoma', system: 'MSK', subcategory: 'Oncology', explanation: 'Lifted periosteum at tumor margin' },

  // ========================
  // INFECTIOUS DISEASE (ID)
  // ========================
  { buzzword: 'Strawberry tongue', condition: 'Kawasaki Disease', system: 'ID', subcategory: 'Pediatrics', explanation: 'Bright red tongue with prominent papillae' },
  { buzzword: 'Slapped cheek appearance', condition: 'Fifth Disease', system: 'ID', subcategory: 'Pediatrics', explanation: 'Erythema infectiosum facial rash' },
  { buzzword: 'Koplik spots', condition: 'Measles', system: 'ID', subcategory: 'Viral', explanation: 'White spots on buccal mucosa' },
  { buzzword: 'Sandpaper rash', condition: 'Scarlet Fever', system: 'ID', subcategory: 'Bacterial', explanation: 'Fine, rough-textured erythematous rash' },
  { buzzword: 'Pastia lines', condition: 'Scarlet Fever', system: 'ID', subcategory: 'Bacterial', explanation: 'Linear petechiae in skin folds' },
  { buzzword: 'Erythema migrans', condition: 'Lyme Disease', system: 'ID', subcategory: 'Tick-Borne', explanation: 'Bulls-eye expanding rash' },
  { buzzword: 'Rose spots', condition: 'Typhoid Fever', system: 'ID', subcategory: 'Bacterial', explanation: 'Salmon-colored macules on trunk' },
  { buzzword: 'Chancre', condition: 'Syphilis', system: 'ID', subcategory: 'STI', explanation: 'Painless ulcer at site of inoculation' },
  { buzzword: 'Condyloma lata', condition: 'Secondary Syphilis', system: 'ID', subcategory: 'STI', explanation: 'Flat warty lesions in genital area' },
  { buzzword: 'Argyll Robertson pupils', condition: 'Neurosyphilis', system: 'ID', subcategory: 'STI', explanation: 'React to accommodation but not light' },
  { buzzword: 'Owl eye inclusions', condition: 'Cytomegalovirus', system: 'ID', subcategory: 'Viral', explanation: 'Intranuclear inclusions with halo' },
  { buzzword: 'Negri bodies', condition: 'Rabies', system: 'ID', subcategory: 'Viral', explanation: 'Eosinophilic inclusions in neurons' },
  { buzzword: 'Downey cells', condition: 'Infectious Mononucleosis', system: 'ID', subcategory: 'Viral', explanation: 'Atypical lymphocytes' },
  { buzzword: 'Heterophile antibodies', condition: 'Infectious Mononucleosis', system: 'ID', subcategory: 'Viral', explanation: 'Monospot positive' },

  // ========================
  // RENAL (RENAL)
  // ========================
  { buzzword: 'Waxy casts', condition: 'Chronic Kidney Disease', system: 'RENAL', subcategory: 'CKD', explanation: 'Broad, homogeneous casts in urine' },
  { buzzword: 'Muddy brown casts', condition: 'Acute Tubular Necrosis', system: 'RENAL', subcategory: 'AKI', explanation: 'Granular casts from tubular debris' },
  { buzzword: 'Red blood cell casts', condition: 'Glomerulonephritis', system: 'RENAL', subcategory: 'Glomerular', explanation: 'Indicates glomerular bleeding' },
  { buzzword: 'White blood cell casts', condition: 'Pyelonephritis', system: 'RENAL', subcategory: 'Infectious', explanation: 'Indicates kidney infection' },
  { buzzword: 'Fatty casts', condition: 'Nephrotic Syndrome', system: 'RENAL', subcategory: 'Glomerular', explanation: 'Maltese cross under polarized light' },
  { buzzword: 'Struvite stones', condition: 'UTI (Urease Producers)', system: 'RENAL', subcategory: 'Stones', explanation: 'Staghorn calculi from alkaline urine' },
  { buzzword: 'Staghorn calculus', condition: 'Struvite Stones', system: 'RENAL', subcategory: 'Stones', explanation: 'Large branching stone filling renal pelvis' },
  { buzzword: 'Flank pain with hematuria', condition: 'Nephrolithiasis', system: 'RENAL', subcategory: 'Stones', explanation: 'Classic presentation of kidney stones' },
  { buzzword: 'Colicky pain', condition: 'Ureteral Stone', system: 'RENAL', subcategory: 'Stones', explanation: 'Intermittent severe pain from ureteral peristalsis' },
  { buzzword: 'Kimmelstiel-Wilson nodules', condition: 'Diabetic Nephropathy', system: 'RENAL', subcategory: 'CKD', explanation: 'Nodular glomerulosclerosis' },
  { buzzword: 'Linear IgG deposits', condition: 'Anti-GBM Disease', system: 'RENAL', subcategory: 'Glomerular', explanation: 'Smooth linear pattern on immunofluorescence' },
  { buzzword: 'Lumpy bumpy deposits', condition: 'Post-Streptococcal Glomerulonephritis', system: 'RENAL', subcategory: 'Glomerular', explanation: 'Granular subepithelial deposits' },
  { buzzword: 'Spike and dome pattern', condition: 'Membranous Nephropathy', system: 'RENAL', subcategory: 'Glomerular', explanation: 'Subepithelial deposits with basement membrane spikes' },
  { buzzword: 'Wire loop lesions', condition: 'Acute Glomerulonephritis', system: 'RENAL', subcategory: 'Glomerular', explanation: 'Thickened capillary loops with subendothelial deposits (Lupus Nephritis)' },

  // ========================
  // PSYCHIATRY (PSYCH)
  // ========================
  { buzzword: 'Flat affect', condition: 'Schizophrenia', system: 'PSYCH', subcategory: 'Psychotic Disorders', explanation: 'Lack of emotional expression' },
  { buzzword: 'Positive symptoms', condition: 'Schizophrenia', system: 'PSYCH', subcategory: 'Psychotic Disorders', explanation: 'Hallucinations, delusions, disorganization' },
  { buzzword: 'Negative symptoms', condition: 'Schizophrenia', system: 'PSYCH', subcategory: 'Psychotic Disorders', explanation: 'Flat affect, alogia, avolition, anhedonia' },
  { buzzword: 'La belle indifference', condition: 'Conversion Disorder', system: 'PSYCH', subcategory: 'Somatic Symptom & Related Disorders', explanation: 'Inappropriate lack of concern about symptoms' },
  { buzzword: 'Anhedonia', condition: 'Major Depressive Disorder', system: 'PSYCH', subcategory: 'Mood Disorders', explanation: 'Inability to experience pleasure' },
  { buzzword: 'Psychomotor retardation', condition: 'Major Depressive Disorder', system: 'PSYCH', subcategory: 'Mood Disorders', explanation: 'Slowed movements and thinking' },
  { buzzword: 'Flight of ideas', condition: 'Mania', system: 'PSYCH', subcategory: 'Mood Disorders', explanation: 'Rapid shifting between loosely connected topics' },
  { buzzword: 'Pressured speech', condition: 'Mania', system: 'PSYCH', subcategory: 'Mood Disorders', explanation: 'Rapid, difficult to interrupt speech' },
  { buzzword: 'Grandiosity', condition: 'Mania', system: 'PSYCH', subcategory: 'Mood Disorders', explanation: 'Inflated self-esteem or sense of importance' },
  { buzzword: 'Splitting', condition: 'Borderline Personality Disorder', system: 'PSYCH', subcategory: 'Personality Disorders', explanation: 'All-or-nothing thinking about people' },
  { buzzword: 'Echolalia', condition: 'Catatonia', system: 'PSYCH', subcategory: 'Psychotic Disorders', explanation: 'Repetition of words spoken by others' },
  { buzzword: 'Waxy flexibility', condition: 'Catatonia', system: 'PSYCH', subcategory: 'Psychotic Disorders', explanation: 'Maintaining positions placed by examiner' },
  { buzzword: 'Delirium tremens', condition: 'Alcohol Withdrawal', system: 'PSYCH', subcategory: 'Substance Use – Alcohol', explanation: 'Severe withdrawal with tremors, AMS, autonomic instability' },

  // ========================
  // HEENT
  // ========================
  { buzzword: 'Cherry red spot', condition: 'Central Retinal Artery Occlusion', system: 'HEENT', subcategory: 'Eye – Retina', explanation: 'Fovea appears red against pale retina' },
  { buzzword: 'Cotton wool spots', condition: 'Diabetic Retinopathy', system: 'HEENT', subcategory: 'Eye – Retina', explanation: 'White fluffy lesions from nerve fiber infarcts' },
  { buzzword: 'Flame hemorrhages', condition: 'Hypertensive Retinopathy', system: 'HEENT', subcategory: 'Eye – Retina', explanation: 'Hemorrhages in nerve fiber layer' },
  { buzzword: 'Cupping of optic disc', condition: 'Glaucoma', system: 'HEENT', subcategory: 'Eye – Glaucoma', explanation: 'Enlarged cup-to-disc ratio' },
  { buzzword: 'Fixed dilated pupil', condition: 'Acute Angle-Closure Glaucoma', system: 'HEENT', subcategory: 'Eye – Glaucoma', explanation: 'Mid-dilated non-reactive pupil' },
  { buzzword: 'Dendritic ulcer', condition: 'Herpes Simplex Keratitis', system: 'HEENT', subcategory: 'Eye – Cornea & Anterior Segment', explanation: 'Branching pattern on fluorescein staining' },
  { buzzword: 'Ciliary flush', condition: 'Anterior Uveitis', system: 'HEENT', subcategory: 'Eye – Uvea', explanation: 'Circumlimbal injection around iris' },
  { buzzword: 'Cobblestoning', condition: 'Allergic Conjunctivitis', system: 'HEENT', subcategory: 'Eye – Conjunctiva', explanation: 'Giant papillae on tarsal conjunctiva' },
  { buzzword: 'Bulging eardrum', condition: 'Acute Otitis Media', system: 'HEENT', subcategory: 'Ear – Middle', explanation: 'Erythematous, opaque tympanic membrane' },
  { buzzword: 'Pearly white mass', condition: 'Cholesteatoma', system: 'HEENT', subcategory: 'Ear – Middle', explanation: 'Keratinized epithelium in middle ear' },

  // ========================
  // REPRODUCTIVE (REPRO)
  // ========================
  { buzzword: 'Chandelier sign', condition: 'Pelvic Inflammatory Disease', system: 'REPRO', subcategory: 'Gynecology', explanation: 'Severe pain on cervical motion' },
  { buzzword: 'Strawberry cervix', condition: 'Trichomoniasis', system: 'REPRO', subcategory: 'Vaginal Disorders', explanation: 'Punctate hemorrhages on cervix' },
  { buzzword: 'Clue cells', condition: 'Bacterial Vaginosis', system: 'REPRO', subcategory: 'Vaginal Disorders', explanation: 'Epithelial cells coated with bacteria' },
  { buzzword: 'Fishy odor with KOH', condition: 'Bacterial Vaginosis', system: 'REPRO', subcategory: 'Vaginal Disorders', explanation: 'Positive whiff test' },
  { buzzword: 'Cottage cheese discharge', condition: 'Vulvovaginal Candidiasis', system: 'REPRO', subcategory: 'Vaginal Disorders', explanation: 'Thick white curdled discharge' },
  { buzzword: 'Snowstorm on ultrasound', condition: 'Hydatidiform Mole', system: 'REPRO', subcategory: 'Early Pregnancy', explanation: 'Multiple echogenic foci from grape-like vesicles' },
  { buzzword: 'Empty gestational sac', condition: 'Anembryonic Pregnancy', system: 'REPRO', subcategory: 'Early Pregnancy', explanation: 'Blighted ovum without fetal pole' },
  { buzzword: 'Ring of fire', condition: 'Ectopic Pregnancy', system: 'REPRO', subcategory: 'Early Pregnancy', explanation: 'Increased doppler flow around tubal mass' },

  // ========================
  // GENITOURINARY (GU)
  // ========================
  { buzzword: 'Bag of worms', condition: 'Varicocele', system: 'GU', subcategory: 'Testicular', explanation: 'Feeling of dilated veins in scrotum' },
  { buzzword: 'Blue dot sign', condition: 'Testicular Torsion', system: 'GU', subcategory: 'Testicular', explanation: 'Visible blue nodule through scrotal skin (specifically appendage torsion)' },
  { buzzword: 'Bell clapper deformity', condition: 'Testicular Torsion', system: 'GU', subcategory: 'Testicular', explanation: 'Horizontal lie of testis predisposing to torsion' },
  { buzzword: 'High-riding testis', condition: 'Testicular Torsion', system: 'GU', subcategory: 'Testicular', explanation: 'Retracted testis with absent cremasteric reflex' },
  { buzzword: 'Prehn sign negative', condition: 'Testicular Torsion', system: 'GU', subcategory: 'Testicular', explanation: 'No relief with testicular elevation (vs. epididymitis)' },
];

/**
 * Get all buzzwords as a flat dictionary for rapid recall mode
 */
export function getBuzzwordDictionary(): Record<string, string> {
  const dict: Record<string, string> = {};
  for (const entry of BUZZWORD_BANK) {
    dict[entry.buzzword] = entry.condition;
  }
  return dict;
}

/**
 * Get buzzwords filtered by system
 */
export function getBuzzwordsBySystem(system: SystemCode): BuzzwordEntry[] {
  return BUZZWORD_BANK.filter(entry => entry.system === system);
}

/**
 * Get all unique conditions from buzzword bank
 */
export function getAllBuzzwordConditions(): string[] {
  return [...new Set(BUZZWORD_BANK.map(entry => entry.condition))];
}

/**
 * Get random buzzwords for quiz mode
 */
export function getRandomBuzzwords(count: number, excludeSystem?: SystemCode): BuzzwordEntry[] {
  let pool = BUZZWORD_BANK;
  if (excludeSystem) {
    pool = pool.filter(entry => entry.system !== excludeSystem);
  }
  
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Search buzzwords by keyword
 */
export function searchBuzzwords(query: string): BuzzwordEntry[] {
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return [];
  
  return BUZZWORD_BANK.filter(entry => 
    entry.buzzword.toLowerCase().includes(lowerQuery) ||
    entry.condition.toLowerCase().includes(lowerQuery) ||
    (entry.explanation && entry.explanation.toLowerCase().includes(lowerQuery))
  );
}

export default BUZZWORD_BANK;
