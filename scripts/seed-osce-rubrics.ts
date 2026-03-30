/**
 * Seed OSCE Case Rubrics
 * Creates CaseRubric entries for all 10 OSCE cases with clinically rigorous checklists.
 * Each rubric includes history, exam, diagnostic reasoning, management, and communication items.
 * Red flags mark items that represent patient safety failures if missed.
 *
 * Run: npx ts-node scripts/seed-osce-rubrics.ts
 */

import { prisma, disconnectPrisma } from './helpers/prisma-client';

type ChecklistItem = { item: string; isRedFlag: boolean };

const caseRubrics = [
  {
    caseId: 'osce-chest-pain-mi',
    checklist: [
      // History taking
      { item: 'Ask onset, duration, quality, and character of chest pain', isRedFlag: false },
      { item: 'Ask about radiation of pain (arms, neck, jaw)', isRedFlag: false },
      { item: 'Assess associated symptoms: diaphoresis, nausea, dyspnea, palpitations', isRedFlag: false },
      { item: 'Review past medical history (prior MI, HTN, DM, hyperlipidemia)', isRedFlag: false },
      { item: 'Medication reconciliation and allergy verification', isRedFlag: false },
      { item: 'Social history: tobacco, alcohol, cocaine use', isRedFlag: false },
      // Physical exam
      { item: 'Assess vital signs and perfusion (BP, HR, respiratory status)', isRedFlag: false },
      { item: 'Cardiovascular exam: rate, rhythm, murmurs, rubs, gallops', isRedFlag: false },
      { item: 'Lung exam: crackles suggesting pulmonary edema', isRedFlag: false },
      // Diagnostic reasoning
      { item: 'Order 12-lead ECG immediately', isRedFlag: true },
      { item: 'Order serial troponin (high-sensitivity preferred)', isRedFlag: true },
      { item: 'Order chest X-ray', isRedFlag: false },
      { item: 'Obtain baseline metabolic panel and CBC', isRedFlag: false },
      // Management
      { item: 'Initiate dual antiplatelet therapy (aspirin + P2Y12 inhibitor)', isRedFlag: true },
      { item: 'Administer anticoagulation (unfractionated heparin or LMWH)', isRedFlag: true },
      { item: 'Arrange emergent cardiac catheterization for STEMI (door-to-balloon <90 min)', isRedFlag: true },
      // Communication
      { item: 'Provide patient education on MI, treatment goals, and risk factors', isRedFlag: false },
      { item: 'Obtain informed consent for invasive procedures', isRedFlag: false },
    ],
  },
  {
    caseId: 'osce-appendicitis',
    checklist: [
      // History taking
      { item: 'Characterize pain: location, onset, migration pattern', isRedFlag: false },
      { item: 'Ask about associated nausea, vomiting, diarrhea, constipation', isRedFlag: false },
      { item: 'Review fever history and symptom timeline', isRedFlag: false },
      { item: 'Menstrual history and pregnancy status in females of childbearing age', isRedFlag: true },
      { item: 'Recent illnesses or exposures to gastroenteritis', isRedFlag: false },
      // Physical exam
      { item: 'Obtain vital signs including temperature', isRedFlag: false },
      { item: 'Palpate McBurney point (1/3 distance from ASIS to umbilicus)', isRedFlag: false },
      { item: 'Perform Rovsing sign (RLQ pain with LLQ palpation)', isRedFlag: false },
      { item: 'Perform psoas sign (pain with hip flexion)', isRedFlag: false },
      { item: 'Perform obturator sign (pain with hip internal rotation)', isRedFlag: false },
      { item: 'Assess for peritoneal signs (guarding, rebound, rigidity)', isRedFlag: false },
      // Diagnostic reasoning
      { item: 'Order pregnancy test (beta-hCG) in all women of childbearing age', isRedFlag: true },
      { item: 'Order urinalysis to rule out urinary causes', isRedFlag: false },
      { item: 'Order CBC with differential (assess for leukocytosis, left shift)', isRedFlag: false },
      { item: 'Order CT abdomen/pelvis as imaging (gold standard)', isRedFlag: true },
      // Management
      { item: 'NPO status and establish IV access', isRedFlag: false },
      { item: 'Initiate prophylactic antibiotics if appendicitis confirmed', isRedFlag: true },
      { item: 'Arrange emergent surgical consultation', isRedFlag: true },
      // Communication
      { item: 'Explain findings to patient and discuss surgical intervention', isRedFlag: false },
      { item: 'Discuss risks and benefits of appendectomy vs conservative management', isRedFlag: false },
    ],
  },
  {
    caseId: 'osce-pneumonia',
    checklist: [
      // History taking
      { item: 'Characterize cough: productive vs dry, sputum color and quantity', isRedFlag: false },
      { item: 'Assess fever duration and associated chills', isRedFlag: false },
      { item: 'Ask about dyspnea, pleuritic chest pain', isRedFlag: false },
      { item: 'Review PMH: COPD, asthma, CHF, immunosuppression, recent hospitalization', isRedFlag: false },
      { item: 'Medication review including recent antibiotics', isRedFlag: false },
      { item: 'Vaccination status (pneumococcal, influenza)', isRedFlag: false },
      // Physical exam
      { item: 'Vital signs with emphasis on oxygenation (SpO2, respiratory rate)', isRedFlag: false },
      { item: 'Targeted lung exam: crackles, consolidation, decreased breath sounds', isRedFlag: false },
      { item: 'Assess for signs of respiratory distress (accessory muscle use, work of breathing)', isRedFlag: false },
      // Diagnostic reasoning
      { item: 'Order chest X-ray (assess for consolidation, extent, complications)', isRedFlag: true },
      { item: 'Order CBC with differential and procalcitonin', isRedFlag: false },
      { item: 'Order blood cultures before antibiotics (in hospitalized patients)', isRedFlag: true },
      { item: 'Obtain sputum culture and gram stain if productive', isRedFlag: false },
      { item: 'Consider respiratory viral testing (influenza, COVID-19)', isRedFlag: false },
      // Management
      { item: 'Calculate CURB-65 or qSOFA to guide disposition', isRedFlag: true },
      { item: 'Initiate appropriate antibiotics (duration, spectrum per local resistance patterns)', isRedFlag: true },
      { item: 'Provide supplemental oxygen to maintain SpO2 >90%', isRedFlag: true },
      // Communication
      { item: 'Explain diagnosis, treatment duration, and when to follow up', isRedFlag: false },
      { item: 'Counsel on smoking cessation if applicable', isRedFlag: false },
    ],
  },
  {
    caseId: 'osce-dvt-pe',
    checklist: [
      // History taking
      { item: 'Assess leg swelling onset, unilateral vs bilateral, associated pain', isRedFlag: false },
      { item: 'Ask about recent immobilization, travel, surgery, or trauma', isRedFlag: false },
      { item: 'Screen for PE symptoms: dyspnea, chest pain, palpitations, syncope', isRedFlag: true },
      { item: 'Review VTE risk factors: OCPs, HRT, malignancy, prior VTE, thrombophilia', isRedFlag: false },
      { item: 'Family history of VTE or thrombophilia', isRedFlag: false },
      // Physical exam
      { item: 'Measure leg circumference bilaterally at same location', isRedFlag: false },
      { item: 'Assess for warmth, erythema, edema, tenderness', isRedFlag: false },
      { item: 'Perform Homan sign (though low sensitivity)', isRedFlag: false },
      { item: 'Assess for signs of PE: tachycardia, tachypnea, hypoxia, hemodynamic instability', isRedFlag: true },
      // Diagnostic reasoning
      { item: 'Order D-dimer (high sensitivity for DVT/PE exclusion)', isRedFlag: false },
      { item: 'Order compression ultrasound (gold standard for DVT diagnosis)', isRedFlag: true },
      { item: 'If PE suspected, order CT pulmonary angiography (CTPA)', isRedFlag: true },
      { item: 'Order troponin and BNP if PE suspected to assess severity', isRedFlag: false },
      { item: 'Obtain baseline coagulation studies and creatinine', isRedFlag: false },
      // Management
      { item: 'Initiate anticoagulation immediately if high clinical suspicion (do not wait for imaging)', isRedFlag: true },
      { item: 'Determine anticoagulation choice: LMWH, UFH, DOACs based on presentation', isRedFlag: true },
      { item: 'Assess for contraindications to anticoagulation (bleeding risk)', isRedFlag: false },
      // Communication
      { item: 'Explain VTE diagnosis and anticoagulation plan', isRedFlag: false },
      { item: 'Discuss duration of therapy (provoked vs unprovoked event)', isRedFlag: false },
      { item: 'Counsel on bleeding precautions and when to seek care', isRedFlag: false },
    ],
  },
  {
    caseId: 'osce-dka',
    checklist: [
      // History taking
      { item: 'Confirm diabetes history and insulin access/adherence', isRedFlag: true },
      { item: 'Assess for precipitants: missed insulin, infection, trauma, stress, new-onset DM', isRedFlag: false },
      { item: 'Ask about polyuria, polydipsia, nausea, vomiting, abdominal pain', isRedFlag: false },
      { item: 'Assess for confusion, lethargy, difficulty concentrating (assess for altered mental status)', isRedFlag: false },
      // Physical exam
      { item: 'Vital signs including orthostatics', isRedFlag: false },
      { item: 'Assess for Kussmaul respirations (deep, regular, rapid)', isRedFlag: false },
      { item: 'Check for fruity-smelling breath (acetone)', isRedFlag: false },
      { item: 'Perform volume status assessment: mucous membranes, skin turgor, JVD', isRedFlag: false },
      { item: 'Targeted exam for precipitants (infection, trauma)', isRedFlag: false },
      // Diagnostic reasoning
      { item: 'Stat glucose (point-of-care)', isRedFlag: true },
      { item: 'Stat venous blood gas or ABG (assess pH and HCO3)', isRedFlag: true },
      { item: 'Stat serum and urine ketones (beta-hydroxybutyrate preferred)', isRedFlag: true },
      { item: 'Stat BMP: glucose, potassium (beware of pseudohyperkalemia from cellular shift), electrolytes, BUN, Cr', isRedFlag: true },
      { item: 'CBC and blood cultures (assess for infection as trigger)', isRedFlag: false },
      { item: 'Urinalysis and urine culture (UTI is common precipitant)', isRedFlag: false },
      { item: 'Lipase to rule out pancreatitis', isRedFlag: false },
      // Management
      { item: 'Initiate aggressive IV fluid resuscitation (avoid hyperosmolarity)', isRedFlag: true },
      { item: 'Start insulin infusion AFTER potassium >3.3 mEq/L (avoid hypokalemia)', isRedFlag: true },
      { item: 'Replace electrolytes (especially potassium) based on labs', isRedFlag: true },
      { item: 'Monitor for complications: hypoglycemia, hypokalemia, cerebral edema', isRedFlag: true },
      // Communication
      { item: 'Explain DKA pathophysiology and insulin importance', isRedFlag: false },
      { item: 'Assess social factors: financial access, adherence barriers', isRedFlag: false },
    ],
  },
  {
    caseId: 'osce-stroke',
    checklist: [
      // History taking
      { item: 'Establish exact time of symptom onset or last known well', isRedFlag: true },
      { item: 'Ask about focal neurologic deficits: weakness, numbness, speech difficulty, vision changes', isRedFlag: false },
      { item: 'Screen for stroke risk factors: Afib, prior CVA, HTN, DM, smoking, CAD', isRedFlag: false },
      { item: 'Ask about recent head trauma, falls, or procedures', isRedFlag: false },
      { item: 'Review current medications (anticoagulants, antiplatelets, thrombolytics)', isRedFlag: false },
      // Physical exam
      { item: 'Vital signs (BP, HR, rhythm assessment for Afib)', isRedFlag: false },
      { item: 'Complete neuro exam: mental status, CN, motor, sensory, cerebellar, gait', isRedFlag: false },
      { item: 'Calculate NIHSS or perform formal stroke scale', isRedFlag: false },
      { item: 'Assess for neck rigidity, fever (meningitis concern)', isRedFlag: false },
      // Diagnostic reasoning
      { item: 'Stat non-contrast CT head (rule out hemorrhage before thrombolytics)', isRedFlag: true },
      { item: 'Stat serum glucose (hypoglycemia can mimic stroke)', isRedFlag: true },
      { item: 'Stat ECG (assess for Afib, other arrhythmias as source)', isRedFlag: true },
      { item: 'CBC, BMP, PT/INR, CBC, coagulation studies', isRedFlag: false },
      { item: 'Consider CTA or MR angiography if indicated by presentation', isRedFlag: false },
      // Management
      { item: 'Activate stroke alert for rapid assessment', isRedFlag: true },
      { item: 'If presentation within 4.5 hours and no contraindications, offer IV thrombolysis (tPA)', isRedFlag: true },
      { item: 'Consider mechanical thrombectomy if large vessel occlusion and appropriate window', isRedFlag: true },
      { item: 'Aspirin at discharge (avoid in hemorrhagic stroke)', isRedFlag: false },
      { item: 'Anticoagulation if cardioembolic source identified', isRedFlag: true },
      // Communication
      { item: 'Explain time-critical nature of stroke ("time is brain")', isRedFlag: false },
      { item: 'Discuss thrombolytic risks (bleeding) vs benefits', isRedFlag: false },
      { item: 'Provide rehabilitation and recovery expectations', isRedFlag: false },
    ],
  },
  {
    caseId: 'osce-ectopic',
    checklist: [
      // History taking
      { item: 'Last menstrual period date and menstrual history regularity', isRedFlag: true },
      { item: 'Sexual activity and contraception use/reliability', isRedFlag: false },
      { item: 'Prior pelvic inflammatory disease, STIs, pelvic surgery, or IUD use', isRedFlag: false },
      { item: 'Onset of pain: acute vs gradual, unilateral vs diffuse', isRedFlag: false },
      { item: 'Associated symptoms: vaginal bleeding, nausea, syncope, shoulder pain', isRedFlag: true },
      // Physical exam
      { item: 'Vital signs including orthostatics (assess for hemorrhagic shock)', isRedFlag: true },
      { item: 'Abdominal exam: tenderness, rebound, guarding, peritoneal signs', isRedFlag: false },
      { item: 'Adnexal exam: palpable mass, tenderness on cervical motion', isRedFlag: false },
      { item: 'Assess for signs of shock: cool skin, delayed capillary refill, altered mental status', isRedFlag: true },
      // Diagnostic reasoning
      { item: 'Urine or serum pregnancy test (beta-hCG) STAT', isRedFlag: true },
      { item: 'Quantitative hCG (level helps stage pregnancy, assess for viable IUP)', isRedFlag: true },
      { item: 'Transvaginal ultrasound (gold standard to identify IUP vs ectopic)', isRedFlag: true },
      { item: 'Type and screen (prepare for possible transfusion)', isRedFlag: true },
      { item: 'CBC (assess baseline hemoglobin for hemorrhage), BMP', isRedFlag: false },
      { item: 'RhoGAM if patient is Rh-negative (prevent sensitization)', isRedFlag: true },
      // Management
      { item: 'Establish IV access and initiate fluid resuscitation if hemodynamically unstable', isRedFlag: true },
      { item: 'Arrange immediate OB/GYN surgery consultation', isRedFlag: true },
      { item: 'Coordinate surgical intervention (salpingostomy vs salpingectomy)', isRedFlag: true },
      // Communication
      { item: 'Explain ectopic pregnancy diagnosis with compassion', isRedFlag: false },
      { item: 'Discuss treatment options: surgery vs methotrexate (if appropriate)', isRedFlag: false },
      { item: 'Provide information on future pregnancy risks and follow-up', isRedFlag: false },
    ],
  },
  {
    caseId: 'osce-asthma',
    checklist: [
      // History taking
      { item: 'Ask about known asthma history, prior exacerbations, ICU admissions, intubations', isRedFlag: false },
      { item: 'Assess trigger for current exacerbation (exercise, allergen, infection, cold air)', isRedFlag: false },
      { item: 'Ask about access to rescue inhaler and frequency of use', isRedFlag: false },
      { item: 'Review controller medications (if any)', isRedFlag: false },
      { item: 'Screen for anaphylaxis features (urticaria, angioedema, hypotension)', isRedFlag: false },
      // Physical exam
      { item: 'Vital signs with particular attention to respiratory rate and oxygen saturation', isRedFlag: true },
      { item: 'Assess work of breathing: retractions (intercostal, suprasternal, subcostal)', isRedFlag: true },
      { item: 'Lung exam: diffuse wheezing, silent chest (ominous), air movement quality', isRedFlag: false },
      { item: 'Ability to speak full sentences (triphasic speech indicates severe distress)', isRedFlag: true },
      { item: 'Assess for pulsus paradoxus (systolic BP drop >10 mmHg with inspiration)', isRedFlag: false },
      { item: 'Skin: cyanosis (lips, fingertips), pallor', isRedFlag: true },
      // Diagnostic reasoning
      { item: 'Pulse oximetry continuous monitoring', isRedFlag: true },
      { item: 'Peak flow measurement (if cooperative and not severely ill)', isRedFlag: false },
      { item: 'Chest X-ray (rule out pneumothorax, foreign body, other complications)', isRedFlag: false },
      { item: 'ABG if severe (assess for hypercapnia indicating fatigue)', isRedFlag: true },
      // Management
      { item: 'Supplemental oxygen to maintain SpO2 92-95% (avoid high-flow oxygen)', isRedFlag: true },
      { item: 'Albuterol nebulizer (continuous in severe cases, every 20 min x 3 doses then reassess)', isRedFlag: true },
      { item: 'Ipratropium (anticholinergic) nebulizer combined with albuterol', isRedFlag: true },
      { item: 'Systemic corticosteroids (methylprednisolone or prednisone)', isRedFlag: true },
      { item: 'IV magnesium sulfate if severe or inadequate response', isRedFlag: false },
      { item: 'Consider ICU admission if respiratory failure risk, hypercapnia, or altered mental status', isRedFlag: true },
      // Communication
      { item: 'Explain severity assessment and treatment plan', isRedFlag: false },
      { item: 'Discuss asthma action plan and when to use rescue vs controller inhalers', isRedFlag: false },
    ],
  },
  {
    caseId: 'osce-urosepsis',
    checklist: [
      // History taking
      { item: 'Ask about fever, dysuria, frequency, urgency, flank pain', isRedFlag: false },
      { item: 'History of recurrent UTIs or urologic abnormalities', isRedFlag: false },
      { item: 'Recent urologic procedure, catheterization, or instrumentation', isRedFlag: false },
      { item: 'Assess for nonspecific symptoms in elderly: delirium, weakness, falls', isRedFlag: true },
      { item: 'Review medications (especially immunosuppressants), PMH (DM, CKD, malignancy)', isRedFlag: false },
      // Physical exam
      { item: 'Vital signs including temperature, BP, HR (assess for sepsis criteria)', isRedFlag: true },
      { item: 'Mental status assessment (delirium is sentinel sign in elderly)', isRedFlag: true },
      { item: 'CVA tenderness (costovertebral angle percussion)', isRedFlag: false },
      { item: 'Suprapubic tenderness and bladder distension', isRedFlag: false },
      { item: 'Assess perfusion: skin color, capillary refill, peripheral edema, urine output', isRedFlag: true },
      // Diagnostic reasoning
      { item: 'Urinalysis with microscopy (leukocyte esterase, nitrites, WBC, bacteria)', isRedFlag: false },
      { item: 'Blood cultures x2 BEFORE antibiotics (establish source of bacteremia)', isRedFlag: true },
      { item: 'Urine culture (identify pathogen and sensitivities)', isRedFlag: true },
      { item: 'CBC with differential (leukocytosis, left shift)', isRedFlag: false },
      { item: 'BMP including creatinine (assess for AKI, electrolyte abnormalities)', isRedFlag: true },
      { item: 'Lactate level (prognostic marker for sepsis severity)', isRedFlag: true },
      { item: 'Consider imaging (renal ultrasound, CT abdomen/pelvis) if obstruction concern', isRedFlag: true },
      // Management
      { item: 'Initiate IV fluid resuscitation (30 mL/kg in first 3 hours)', isRedFlag: true },
      { item: 'Broad-spectrum IV antibiotics within 1 hour (do not delay for cultures)', isRedFlag: true },
      { item: 'De-escalate antibiotics once culture results and sensitivities known', isRedFlag: false },
      { item: 'Consider urologic intervention if obstruction present (Foley, nephrostomy)', isRedFlag: true },
      { item: 'Monitor and manage sepsis-related complications (AKI, DIC)', isRedFlag: true },
      // Communication
      { item: 'Explain sepsis diagnosis and urgency of treatment', isRedFlag: false },
      { item: 'Discuss source control and antibiotic course', isRedFlag: false },
    ],
  },
  {
    caseId: 'osce-chf',
    checklist: [
      // History taking
      { item: 'Onset of dyspnea: acute vs gradual, at rest vs exertional, orthopnea, PND', isRedFlag: false },
      { item: 'Associated symptoms: chest pain, palpitations, syncope, leg swelling', isRedFlag: false },
      { item: 'Recent weight gain (key marker of volume overload)', isRedFlag: true },
      { item: 'Known heart failure history and ejection fraction (systolic vs diastolic)', isRedFlag: false },
      { item: 'Medication adherence: diuretics, ACE-I/ARB, beta-blockers, MRAs', isRedFlag: true },
      { item: 'Precipitants: non-adherence, dietary sodium, infection, ischemia, new arrhythmia', isRedFlag: false },
      // Physical exam
      { item: 'Vital signs including BP (assess for hypotension limiting therapy)', isRedFlag: false },
      { item: 'Assess JVD and hepatojugular reflex (volume overload markers)', isRedFlag: false },
      { item: 'Lung exam: crackles, rales, dullness at bases (pulmonary edema)', isRedFlag: false },
      { item: 'Cardiac exam: rate, rhythm, S3 gallop (pathologic), murmurs', isRedFlag: false },
      { item: 'Hepatomegaly, ascites, peripheral edema (volume overload)', isRedFlag: false },
      // Diagnostic reasoning
      { item: 'BNP or NT-proBNP (confirm volume overload diagnosis)', isRedFlag: true },
      { item: 'BMP including creatinine (assess renal function before ACE/ARB/MRA)', isRedFlag: true },
      { item: 'CBC (check for anemia contributing to symptoms)', isRedFlag: false },
      { item: 'Troponin (assess for acute ischemia as precipitant)', isRedFlag: true },
      { item: 'Chest X-ray (assess for pulmonary edema, infiltrates)', isRedFlag: false },
      { item: 'ECG (assess for new ischemia, arrhythmia)', isRedFlag: false },
      { item: 'Echocardiography to assess EF and valvular disease (if not recent)', isRedFlag: false },
      // Management
      { item: 'Diuresis: IV diuretics (furosemide) to reduce volume overload', isRedFlag: true },
      { item: 'Initiate ACE-I/ARB if not already on (target dose)', isRedFlag: true },
      { item: 'Beta-blocker optimization (may need holding if hypotensive)', isRedFlag: false },
      { item: 'Aldosterone antagonist if EF <40% and no contraindications', isRedFlag: true },
      { item: 'Sodium restriction and fluid restriction counseling', isRedFlag: false },
      { item: 'Address precipitants (infection, ischemia, non-adherence)', isRedFlag: true },
      // Communication
      { item: 'Explain acute decompensation and need for diuresis', isRedFlag: false },
      { item: 'Counsel on medication adherence and sodium/fluid restriction', isRedFlag: false },
      { item: 'Provide signs/symptoms of worsening and when to seek care', isRedFlag: false },
    ],
  },
];

async function main() {
  console.log('Seeding OSCE Case Rubrics...\n');

  for (const rubric of caseRubrics) {
    await prisma.caseRubric.upsert({
      where: { caseId: rubric.caseId },
      update: {
        checklist: rubric.checklist as object,
        updatedAt: new Date(),
      },
      create: {
        caseId: rubric.caseId,
        checklist: rubric.checklist as object,
      },
    });
    console.log(`✓ Rubric created/updated for case: ${rubric.caseId}`);
  }

  console.log(`\n✅ Successfully seeded ${caseRubrics.length} OSCE case rubrics`);
}

main()
  .catch((e) => {
    console.error('Error seeding OSCE rubrics:', e);
    process.exit(1);
  })
  .finally(() => disconnectPrisma());
