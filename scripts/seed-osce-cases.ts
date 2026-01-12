/**
 * Seed OSCE Patient Encounter Cases
 * Run: npx ts-node scripts/seed-osce-cases.ts
 */

import { prisma, disconnect } from './_shared/db.js';

const osceCases = [
  {
    id: 'osce-chest-pain-mi',
    patientName: 'John Mitchell',
    chiefComplaint: 'Crushing chest pain for 2 hours',
    age: 58,
    sex: 'male',
    vitalSigns: {
      bp: '160/95',
      hr: 98,
      rr: 22,
      temp: '98.6°F',
      spo2: '96%'
    },
    historyData: {
      hpi: 'Substernal crushing chest pain radiating to left arm for 2 hours. Associated with diaphoresis and nausea. Worse with exertion, no relief with rest.',
      pmh: ['HTN', 'Hyperlipidemia', 'Type 2 DM'],
      psh: 'Appendectomy age 25',
      medications: ['Lisinopril 10mg', 'Metformin 500mg BID', 'Atorvastatin 20mg'],
      allergies: 'NKDA',
      social: 'Smokes 1 PPD x 30 years, drinks socially',
      family: 'Father MI at 55, mother HTN'
    },
    physicalExamData: {
      general: 'Anxious, diaphoretic male in moderate distress',
      cardiovascular: 'Tachycardic, S1/S2 regular, no murmurs/gallops',
      pulmonary: 'Clear to auscultation bilaterally',
      abdomen: 'Soft, non-tender'
    },
    labData: {
      troponin: '0.85 ng/mL (elevated)',
      bnp: '450 pg/mL',
      ecg: 'ST elevation in leads V1-V4'
    },
    essentialQuestions: [
      'When did the pain start?',
      'Does the pain radiate anywhere?',
      'Have you had any sweating or nausea?',
      'Do you have a history of heart problems?',
      'Have you taken any medications for this?'
    ],
    helpfulQuestions: [
      'What were you doing when it started?',
      'Is this the worst chest pain of your life?',
      'Any family history of heart disease?'
    ],
    unnecessaryQuestions: [
      'What did you eat for breakfast?',
      'Do you have any pets?',
      'What is your occupation?'
    ],
    correctDiagnosis: 'ST-Elevation Myocardial Infarction (STEMI)',
    differentialDiagnoses: ['Unstable Angina', 'Aortic Dissection', 'Pulmonary Embolism', 'Pericarditis'],
    idealWorkup: ['Troponin', 'ECG', 'CXR', 'BMP', 'CBC'],
    teachingPoints: [
      'STEMI requires emergent PCI within 90 minutes',
      'Classic presentation: substernal crushing pain with radiation, diaphoresis',
      'Time is muscle - door-to-balloon time critical'
    ]
  },
  {
    id: 'osce-appendicitis',
    patientName: 'Sarah Chen',
    chiefComplaint: 'Right lower abdominal pain for 12 hours',
    age: 24,
    sex: 'female',
    vitalSigns: {
      bp: '118/72',
      hr: 102,
      rr: 18,
      temp: '101.2°F',
      spo2: '99%'
    },
    historyData: {
      hpi: 'Pain started periumbilically, now localized to RLQ. Associated with nausea, 1 episode of vomiting. No appetite. Pain worse with movement.',
      pmh: 'None',
      psh: 'None',
      medications: 'Oral contraceptives',
      allergies: 'Penicillin (rash)',
      social: 'Non-smoker, occasional alcohol',
      family: 'Mother with Crohn disease'
    },
    physicalExamData: {
      general: 'Young woman lying still, appears uncomfortable',
      abdomen: 'RLQ tenderness, positive McBurney point, guarding, positive Rovsing sign, positive psoas sign',
      cardiovascular: 'Regular rate and rhythm',
      pulmonary: 'Clear bilaterally'
    },
    labData: {
      wbc: '14,500/μL with left shift',
      hcg: 'Negative',
      ua: 'Normal'
    },
    essentialQuestions: [
      'Where exactly is the pain?',
      'Has the location of pain changed?',
      'Any nausea or vomiting?',
      'When was your last menstrual period?',
      'Could you be pregnant?'
    ],
    helpfulQuestions: [
      'Does coughing or walking make it worse?',
      'Have you had any fever?',
      'Any changes in bowel habits?'
    ],
    unnecessaryQuestions: [
      'Do you have any dental problems?',
      'What is your favorite food?',
      'Do you exercise regularly?'
    ],
    correctDiagnosis: 'Acute Appendicitis',
    differentialDiagnoses: ['Ovarian Cyst', 'Ectopic Pregnancy', 'Mesenteric Adenitis', 'PID'],
    idealWorkup: ['CBC', 'CMP', 'UA', 'Pregnancy test', 'CT abdomen/pelvis'],
    teachingPoints: [
      'Classic migration of pain from periumbilical to RLQ',
      'McBurney point tenderness is hallmark finding',
      'Always rule out pregnancy in women of childbearing age'
    ]
  },
  {
    id: 'osce-pneumonia',
    patientName: 'Robert Williams',
    chiefComplaint: 'Cough and fever for 5 days',
    age: 72,
    sex: 'male',
    vitalSigns: {
      bp: '105/68',
      hr: 108,
      rr: 26,
      temp: '102.8°F',
      spo2: '89%'
    },
    historyData: {
      hpi: 'Productive cough with yellow-green sputum x 5 days. Associated fever, chills, pleuritic chest pain. Worsening shortness of breath.',
      pmh: ['COPD', 'CHF', 'Type 2 DM'],
      psh: 'CABG 2018',
      medications: ['Albuterol inhaler', 'Furosemide 40mg', 'Metformin 1000mg BID'],
      allergies: 'Sulfa drugs',
      social: 'Former smoker (quit 5 years ago), 40 pack-years',
      family: 'Non-contributory'
    },
    physicalExamData: {
      general: 'Elderly male in respiratory distress',
      pulmonary: 'Decreased breath sounds RLL, crackles, dullness to percussion',
      cardiovascular: 'Tachycardic, regular rhythm',
      extremities: 'No edema'
    },
    labData: {
      wbc: '18,200/μL',
      procalcitonin: '2.4 ng/mL',
      cxr: 'RLL consolidation with air bronchograms'
    },
    essentialQuestions: [
      'Describe your cough - is it productive?',
      'What color is the sputum?',
      'How long have you had the fever?',
      'Are you short of breath?',
      'Do you have any chest pain with breathing?'
    ],
    helpfulQuestions: [
      'Have you been around anyone sick?',
      'Are your symptoms getting worse?',
      'Have you been vaccinated for pneumonia?'
    ],
    unnecessaryQuestions: [
      'Do you have any skin rashes?',
      'Any problems with your vision?',
      'Do you have any joint pain?'
    ],
    correctDiagnosis: 'Community-Acquired Pneumonia',
    differentialDiagnoses: ['COPD Exacerbation', 'CHF Exacerbation', 'Pulmonary Embolism', 'Lung Cancer'],
    idealWorkup: ['CXR', 'CBC', 'BMP', 'Procalcitonin', 'Blood cultures', 'Sputum culture'],
    teachingPoints: [
      'CURB-65 score guides disposition (Confusion, Uremia, RR, BP, age 65+)',
      'Elderly may present atypically without fever',
      'S. pneumoniae most common cause in community-acquired pneumonia'
    ]
  }
];

async function main() {
  console.log('Seeding OSCE cases...');
  
  for (const caseData of osceCases) {
    await prisma.patientEncounterCase.upsert({
      where: { id: caseData.id },
      update: { ...caseData, updatedAt: new Date() },
      create: { ...caseData, updatedAt: new Date() }
    });
    console.log(`✓ Created/updated case: ${caseData.patientName}`);
  }
  
  console.log(`\n✅ Seeded ${osceCases.length} OSCE cases`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
