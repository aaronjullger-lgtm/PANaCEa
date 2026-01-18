import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

const BUZZWORD_DATA = {
  // CARDIOLOGY
  'Patent Ductus Arteriosus': { buzzword: "Continuous 'machinery' murmur", category: 'Cardio' },
  'Mitral Valve Prolapse': { buzzword: 'Mid-systolic click', category: 'Cardio' },
  'Mitral Stenosis': { buzzword: 'Opening snap', category: 'Cardio' },
  'Aortic Stenosis': {
    buzzword: 'Harsh systolic crescendo-decrescendo (RUSB)',
    category: 'Cardio',
  },
  'Aortic Regurgitation': { buzzword: 'Diastolic blowing murmur (LUSB)', category: 'Cardio' },
  'Mitral Regurgitation': { buzzword: "Holosystolic 'blowing' murmur (Apex)", category: 'Cardio' },
  'Atrial Flutter': { buzzword: "'Sawtooth' waves", category: 'Cardio (ECG)' },
  'Atrial Fibrillation': {
    buzzword: 'Irregularly irregular + No P waves',
    category: 'Cardio (ECG)',
  },
  'Acute Pericarditis': {
    buzzword: 'Diffuse ST elevation + PR depression',
    category: 'Cardio (ECG)',
  },
  'Pericardial Effusion': {
    buzzword: 'Electrical Alternans / Water Bottle Heart',
    category: 'Cardio',
  },
  'Tetralogy of Fallot': { buzzword: "'Boot-shaped' heart", category: 'Cardio (XR)' },
  'Coarctation of the Aorta': { buzzword: "Rib notching + '3 sign'", category: 'Cardio (XR)' },
  'Infective Endocarditis': {
    buzzword: 'Janeway Lesions / Osler Nodes / Roth Spots',
    category: 'Cardio (Clinical)',
  },

  // PULMONOLOGY
  Croup: { buzzword: "'Steeple' sign (Neck XR)", category: 'Pulm' },
  Epiglottitis: { buzzword: "'Thumbprint' sign (Lat Neck XR)", category: 'Pulm' },
  'Cystic Fibrosis': { buzzword: 'Sweat Chloride Test > 60', category: 'Pulm' },
  Sarcoidosis: { buzzword: 'Non-caseating granulomas', category: 'Pulm' },
  Tuberculosis: { buzzword: 'Caseating granulomas / Ghon complex', category: 'Pulm' },
  Pneumothorax: { buzzword: 'Visceral pleural line / Deep Sulcus Sign', category: 'Pulm' },
  'Klebsiella Pneumonia': { buzzword: 'Currant jelly sputum', category: 'Pulm' },

  // GI
  Achalasia: { buzzword: "'Bird's beak' appearance", category: 'GI' },
  Intussusception: { buzzword: 'Currant jelly stool + Sausage mass', category: 'GI' },
  'Pyloric Stenosis': { buzzword: 'Olive-shaped mass / String sign', category: 'GI' },
  Cholecystitis: { buzzword: "Murphy's Sign", category: 'GI' },
  'Acute Cholangitis': { buzzword: 'Charcot’s Triad (Fever, RUQ Pain, Jaundice)', category: 'GI' },
  "Wilson's Disease": { buzzword: 'Kayser-Fleischer rings', category: 'GI' },

  // MSK / RHEUM
  'Ankylosing Spondylitis': { buzzword: "'Bamboo spine' / HLA-B27", category: 'Rheum' },
  Gout: { buzzword: 'Negatively birefringent needle crystals', category: 'Rheum' },
  Pseudogout: { buzzword: 'Positively birefringent rhomboid crystals', category: 'Rheum' },
  Osteosarcoma: { buzzword: "'Sunburst' pattern / Codman's Triangle", category: 'Ortho' },
  'Ewing Sarcoma': { buzzword: "'Onion skin' appearance", category: 'Ortho' },

  // NEURO
  'Subarachnoid Hemorrhage': {
    buzzword: "'Thunderclap' headache / Star pattern",
    category: 'Neuro',
  },
  'Multiple Sclerosis': {
    buzzword: 'Dawson’s Fingers / Oligoclonal bands / Lhermitte’s',
    category: 'Neuro',
  },
  'Guillain-Barre Syndrome': { buzzword: 'Ascending paralysis', category: 'Neuro' },

  // DERM
  Varicella: { buzzword: "'Dewdrop on a rose petal'", category: 'Derm' },
  'Lyme Disease': { buzzword: "Bull's-eye rash (Erythema Migrans)", category: 'Derm' },
  'Pityriasis Rosea': { buzzword: 'Herald Patch / Christmas tree pattern', category: 'Derm' },
  'Basal Cell Carcinoma': { buzzword: 'Pearly papule + telangiectasia', category: 'Derm' },

  // ENDO
  Hypercalcemia: {
    buzzword: "'Stones, bones, abdominal groans, psychiatric moans'",
    category: 'Endo',
  },
  "Graves' Disease": { buzzword: 'Exophthalmos + Pretibial Myxedema', category: 'Endo' },
};

async function main() {
  console.log('Seeding buzzwords from registry to database...');

  let createdCount = 0;
  let updatedCount = 0;

  for (const [condition, entry] of Object.entries(BUZZWORD_DATA)) {
    // Check if exists
    const existing = await prisma.buzzword.findFirst({
      where: { condition: condition },
    });

    if (existing) {
      // Update existing
      await prisma.buzzword.update({
        where: { id: existing.id },
        data: {

          id: uuidv4(),

          updatedAt: new Date(),

          buzzword: entry.buzzword,
          system: entry.category,
        },
      });
      updatedCount++;
    } else {
      // Create new
      await prisma.buzzword.create({
        data: {

          id: uuidv4(),

          updatedAt: new Date(),

          condition: condition,
          buzzword: entry.buzzword,
          system: entry.category,
        },
      });
      createdCount++;
    }
  }

  console.log(`Seeding complete. Created: ${createdCount}, Updated: ${updatedCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
