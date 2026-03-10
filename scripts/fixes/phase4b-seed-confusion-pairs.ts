#!/usr/bin/env npx tsx
/**
 * Phase 4b: Seed ConfusionPair table with commonly confused condition pairs
 *
 * Pre-seeds ~80 classic confusion pairs that PA students commonly mix up.
 * These are "system-level" confusion pairs, not user-specific.
 * Uses a dummy userId since the model requires it.
 *
 * Usage: npx tsx scripts/fixes/phase4b-seed-confusion-pairs.ts [--dry-run]
 */

import { prisma, disconnectPrisma } from '../helpers/prisma-client';
import { v4 as uuidv4 } from 'uuid';

const DRY_RUN = process.argv.includes('--dry-run');

// System user ID for pre-seeded pairs
const SYSTEM_USER_ID = 'system_confusion_seed';

// Classic confusion pairs: [conditionA, conditionB, reason]
const CONFUSION_PAIRS: Array<[string, string, string]> = [
  // Cardiovascular
  ['Myocardial Infarction', 'Pericarditis', 'Both present with chest pain and ST changes on ECG'],
  ['Myocardial Infarction', 'Aortic Dissection', 'Both present with severe chest pain; dissection is a contraindication to thrombolytics'],
  ['Unstable Angina', 'NSTEMI', 'Both are NSTE-ACS; distinguished by troponin elevation'],
  ['Heart Failure', 'COPD Exacerbation', 'Both present with dyspnea and bilateral crackles vs wheezing'],
  ['Atrial Fibrillation', 'Atrial Flutter', 'Both are supraventricular tachycardias; flutter has sawtooth pattern'],
  ['Pericarditis', 'Cardiac Tamponade', 'Tamponade is progression of pericarditis with Beck triad'],
  ['DVT', 'Cellulitis', 'Both cause unilateral leg swelling/redness'],
  ['Aortic Stenosis', 'Hypertrophic Cardiomyopathy', 'Both cause systolic murmur and syncope'],

  // Pulmonary
  ['Pneumonia', 'Pulmonary Embolism', 'Both present with dyspnea, tachycardia, and pleuritic chest pain'],
  ['Asthma', 'COPD', 'Both cause airflow obstruction; asthma is reversible'],
  ['Tension Pneumothorax', 'Cardiac Tamponade', 'Both cause hypotension and JVD; tracheal deviation differentiates'],
  ['Pleural Effusion', 'Pneumonia', 'Both cause dullness to percussion; effusion has decreased breath sounds'],

  // GI
  ["Crohn's Disease", 'Ulcerative Colitis', 'Both are IBD; Crohn is transmural skip lesions, UC is continuous mucosal'],
  ['Cholecystitis', 'Choledocholithiasis', 'Both cause RUQ pain; choledocholithiasis has elevated bilirubin/direct'],
  ['Appendicitis', 'Meckel Diverticulum', 'Both can present as RLQ pain; Meckel is painless rectal bleeding'],
  ['Peptic Ulcer Disease', 'Gastric Cancer', 'Both cause epigastric pain and weight loss; cancer has alarm features'],
  ['Hepatitis B', 'Hepatitis C', 'Both cause chronic hepatitis; HBV is DNA virus with vaccine, HCV is RNA without'],
  ['Small Bowel Obstruction', 'Large Bowel Obstruction', 'Different locations on imaging; LBO has more distension'],
  ['Pancreatitis', 'Cholecystitis', 'Both cause upper abdominal pain; pancreatitis radiates to back with elevated lipase'],

  // MSK
  ['Gout', 'Pseudogout', 'Both cause acute monoarticular arthritis; gout=needle-shaped neg birefringent, CPPD=rhomboid pos birefringent'],
  ['Septic Arthritis', 'Gout', 'Both cause hot swollen joint; septic is emergent, needs aspiration'],
  ['Rheumatoid Arthritis', 'Osteoarthritis', 'RA=symmetric, morning stiffness >30min, MCP/PIP; OA=asymmetric, DIP, bony enlargement'],
  ['ACL Tear', 'MCL Tear', 'Both knee injuries; ACL=positive Lachman, MCL=valgus stress'],
  ['Compartment Syndrome', 'DVT', 'Both cause painful swollen extremity; compartment syndrome is surgical emergency'],
  ['Osteomyelitis', 'Cellulitis', 'Both cause local warmth/erythema; osteomyelitis involves bone on imaging'],

  // Neurologic
  ['Ischemic Stroke', 'Hemorrhagic Stroke', 'Both cause focal neuro deficits; CT distinguishes (hemorrhagic is hyperdense)'],
  ['Epidural Hematoma', 'Subdural Hematoma', 'Epidural=lucid interval, lens-shaped; subdural=crescent, bridging veins'],
  ['Migraine', 'Cluster Headache', 'Both severe headaches; cluster=unilateral orbital with autonomic symptoms, shorter'],
  ['Multiple Sclerosis', 'Guillain-Barré Syndrome', 'Both cause weakness; MS=UMN, relapsing-remitting; GBS=ascending LMN, monophasic'],
  ['Meningitis', 'Encephalitis', 'Both cause fever and headache; encephalitis has altered mental status'],
  ['Myasthenia Gravis', 'Lambert-Eaton Syndrome', 'Both cause weakness; MG worsens with use, LE improves; MG=AChR antibodies, LE=VGCC'],
  ['Parkinson Disease', 'Essential Tremor', 'Both cause tremor; PD=resting, pill-rolling, bradykinesia; ET=action/postural, improves with alcohol'],
  ['Bell Palsy', 'Stroke', 'Both cause facial weakness; Bell=entire face, forehead involved; stroke=lower face only'],

  // Endocrine
  ['Type 1 Diabetes', 'Type 2 Diabetes', 'Both cause hyperglycemia; T1=autoimmune, ketosis-prone; T2=insulin resistance'],
  ['DKA', 'HHS', 'Both hyperglycemic emergencies; DKA=ketoacidosis in T1; HHS=hyperosmolar in T2'],
  ['Hyperthyroidism', 'Hypothyroidism', 'Opposite ends; hyper=weight loss, tachycardia; hypo=weight gain, bradycardia'],
  ["Graves' Disease", 'Toxic Multinodular Goiter', 'Both cause hyperthyroidism; Graves=diffuse uptake, TRAb+; TMG=patchy uptake'],
  ["Addison's Disease", "Cushing's Syndrome", 'Both are adrenal; Addison=insufficiency, hyperpigmentation; Cushing=excess cortisol, moon face'],
  ['Hyperparathyroidism', 'Malignancy-Associated Hypercalcemia', 'Both cause hypercalcemia; hyperPTH=elevated PTH; malignancy=suppressed PTH, elevated PTHrP'],

  // Renal
  ['Nephrotic Syndrome', 'Nephritic Syndrome', 'Nephrotic=massive proteinuria, edema, lipiduria; nephritic=hematuria, HTN, RBC casts'],
  ['Prerenal AKI', 'Intrinsic AKI', 'Both elevate creatinine; prerenal=BUN:Cr >20:1, FeNa <1%; intrinsic=muddy brown casts'],
  ['Kidney Stones', 'Pyelonephritis', 'Both cause flank pain; stones=colicky, hematuria; pyelo=fever, WBC casts'],

  // Psychiatry
  ['Major Depression', 'Bipolar Depression', 'Same presentation in depressive phase; bipolar requires screening for manic episodes'],
  ['Schizophrenia', 'Schizoaffective Disorder', 'Both have psychosis; schizoaffective also has mood episodes'],
  ['Panic Disorder', 'Generalized Anxiety Disorder', 'Panic=discrete attacks with somatic symptoms; GAD=chronic pervasive worry'],
  ['Delirium', 'Dementia', 'Delirium=acute, fluctuating, reversible; dementia=chronic, progressive, irreversible'],
  ['PTSD', 'Acute Stress Disorder', 'Same symptoms; ASD=3 days to 1 month; PTSD=>1 month'],
  ['Anorexia Nervosa', 'Bulimia Nervosa', 'Both are eating disorders; AN=restrictive, low BMI; BN=binge-purge, normal BMI'],

  // HEENT
  ['Acute Angle-Closure Glaucoma', 'Open-Angle Glaucoma', 'Angle-closure=acute emergency, painful, mid-dilated pupil; open-angle=chronic, painless'],
  ['Retinal Detachment', 'Vitreous Detachment', 'Both cause floaters/flashes; retinal detachment has curtain visual field loss'],
  ['Otitis Media', 'Otitis Externa', 'Both cause ear pain; OM=bulging TM; OE=tragus tenderness'],

  // Dermatology
  ['Eczema', 'Psoriasis', 'Both chronic skin conditions; eczema=flexural, pruritic; psoriasis=extensor, silvery scales'],
  ['Melanoma', 'Seborrheic Keratosis', 'Both pigmented lesions; melanoma=ABCDE criteria; SK=stuck-on appearance'],
  ['Herpes Simplex', 'Herpes Zoster', 'Both herpetic; HSV=recurrent grouped vesicles; HZ=dermatomal distribution'],
  ['Stevens-Johnson Syndrome', 'Erythema Multiforme', 'Both mucocutaneous reactions; SJS=more severe, >mucosal involvement; EM=target lesions'],
  ['Cellulitis', 'Erysipelas', 'Both skin infections; erysipelas=sharply demarcated, superficial; cellulitis=deeper, indistinct borders'],

  // Hematology
  ['Iron Deficiency Anemia', 'Anemia of Chronic Disease', 'Both microcytic; IDA=low ferritin; ACD=normal/high ferritin, low TIBC'],
  ['ITP', 'TTP', 'Both cause thrombocytopenia; ITP=isolated; TTP=pentad with schistocytes'],
  ['DIC', 'TTP/HUS', 'Both cause microangiopathic hemolytic anemia; DIC=low fibrinogen; TTP=normal fibrinogen'],
  ['Sickle Cell Disease', 'Thalassemia', 'Both hemoglobinopathies; SCD=qualitative defect; thalassemia=quantitative'],
  ['Hodgkin Lymphoma', 'Non-Hodgkin Lymphoma', 'Both lymphomas; HL=Reed-Sternberg cells, contiguous spread; NHL=more common, noncontiguous'],

  // Infectious Disease
  ['Bacterial Meningitis', 'Viral Meningitis', 'Both cause meningeal signs; bacterial=high PMNs, low glucose; viral=lymphocytes, normal glucose'],
  ['Lyme Disease', 'Rocky Mountain Spotted Fever', 'Both tick-borne; Lyme=erythema migrans, Northeast; RMSF=petechial rash, SE US'],
  ['C. diff Colitis', 'Ulcerative Colitis', 'Both cause bloody diarrhea; C. diff=antibiotic history, toxin assay; UC=chronic, biopsy'],
  ['Community-Acquired Pneumonia', 'Hospital-Acquired Pneumonia', 'Same presentation; HAP has different organisms requiring broader coverage'],

  // Reproductive
  ['Ectopic Pregnancy', 'Threatened Abortion', 'Both cause first-trimester bleeding; ectopic=adnexal mass, no IUP on US'],
  ['Preeclampsia', 'Chronic Hypertension', 'Both cause HTN in pregnancy; preeclampsia=new onset after 20 weeks with proteinuria'],
  ['Placenta Previa', 'Placental Abruption', 'Both cause third-trimester bleeding; previa=painless; abruption=painful, rigid uterus'],
  ['Endometriosis', 'Adenomyosis', 'Both cause dysmenorrhea; endometriosis=ectopic implants; adenomyosis=within myometrium'],
  ['Ovarian Torsion', 'Ruptured Ovarian Cyst', 'Both cause acute pelvic pain; torsion=no blood flow on US; ruptured cyst=free fluid'],
  ['Testicular Torsion', 'Epididymitis', 'Both cause scrotal pain; torsion=absent cremasteric reflex, surgical emergency; epididymitis=positive Prehn sign'],
  ['BPH', 'Prostate Cancer', 'Both cause LUTS; BPH=smooth enlarged; cancer=nodular, elevated PSA'],
];

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Phase 4b: Seed ConfusionPair Table                       ║');
  console.log(`║  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}                                            ║`);
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Ensure system user exists
  if (!DRY_RUN) {
    try {
      await prisma.user.upsert({
        where: { id: SYSTEM_USER_ID },
        update: {},
        create: {
          id: SYSTEM_USER_ID,
          clerkId: 'system_confusion_seed',
          email: 'system@panacea.internal',
          firstName: 'System',
          lastName: 'Seed',
          role: 'ADMIN' as any,
          updatedAt: new Date(),
        },
      });
    } catch (e: any) {
      console.log(`Note: Could not create system user: ${e.message?.substring(0, 80)}`);
    }
  }

  // Load conditions for matching
  const conditions = await prisma.condition.findMany({
    select: { id: true, name: true },
  });

  function findCondition(name: string): string | null {
    const norm = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const match = conditions.find((c) => {
      const cNorm = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      return cNorm === norm || cNorm.includes(norm) || norm.includes(cNorm);
    });
    return match?.id || null;
  }

  // Load MedicalContent for matching
  const mcList = await prisma.medicalContent.findMany({
    select: { id: true, condition: true, conditionId: true },
  });

  function findMCId(name: string): string | null {
    const norm = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const match = mcList.find((m) => {
      const mNorm = m.condition.toLowerCase().replace(/[^a-z0-9]/g, '');
      return mNorm === norm || mNorm.includes(norm) || norm.includes(mNorm);
    });
    return match?.id || null;
  }

  let created = 0;
  let skipped = 0;
  let noMatch = 0;

  for (const [condA, condB, _reason] of CONFUSION_PAIRS) {
    const correctId = findMCId(condA);
    const selectedId = findMCId(condB);
    const condAId = findCondition(condA);
    const condBId = findCondition(condB);

    if (!correctId || !selectedId) {
      console.log(`  ⏭️  No MC match: "${condA}" or "${condB}"`);
      noMatch++;
      continue;
    }

    if (!DRY_RUN) {
      try {
        await prisma.confusionPair.create({
          data: {
            id: uuidv4(),
            userId: SYSTEM_USER_ID,
            realCondition: condA,
            mistakenFor: condB,
            count: 0,
            lastOccurrence: new Date(),
            correctConditionId: correctId,
            selectedConditionId: selectedId,
            realConditionId: condAId,
            mistakenForId: condBId,
          },
        });
        created++;
      } catch {
        skipped++;
      }
    } else {
      created++;
    }

    // Also create the reverse pair
    if (!DRY_RUN) {
      try {
        await prisma.confusionPair.create({
          data: {
            id: uuidv4(),
            userId: SYSTEM_USER_ID,
            realCondition: condB,
            mistakenFor: condA,
            count: 0,
            lastOccurrence: new Date(),
            correctConditionId: selectedId,
            selectedConditionId: correctId,
            realConditionId: condBId,
            mistakenForId: condAId,
          },
        });
        created++;
      } catch {
        skipped++;
      }
    }
  }

  console.log('\n════════════════════════════════════════');
  console.log(`Created: ${created} (pairs + reverses)`);
  console.log(`Skipped: ${skipped}`);
  console.log(`No match: ${noMatch}`);

  await disconnectPrisma();
}

main().catch(async (e) => {
  console.error('❌ Fatal error:', e);
  await disconnectPrisma();
  process.exit(1);
});
