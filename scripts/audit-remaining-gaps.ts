import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function auditRemainingGaps() {
  console.log('=== REMAINING DATABASE GAPS AUDIT ===\n');

  // MedicalContent - MOST IMPORTANT TABLE
  const medicalContent = await prisma.medicalContent.findMany();
  const medNullStats = medicalContent.reduce((acc, item) => {
    if (!item.mnemonic) acc.noMnemonic++;
    if (!item.boardYieldFacts || item.boardYieldFacts.length === 0) acc.noBoardFacts++;
    if (!item.clinicalPearls || item.clinicalPearls.length === 0) acc.noClinicalPearls++;
    if (!item.differentialDiagnosis || item.differentialDiagnosis.length === 0) acc.noDDx++;
    return acc;
  }, { noMnemonic: 0, noBoardFacts: 0, noClinicalPearls: 0, noDDx: 0 });
  
  console.log(`✨ MedicalContent: ${medicalContent.length} records`);
  console.log(`   Missing mnemonic: ${medNullStats.noMnemonic}`);
  console.log(`   Missing boardYieldFacts: ${medNullStats.noBoardFacts}`);
  console.log(`   Missing clinicalPearls: ${medNullStats.noClinicalPearls}`);
  console.log(`   Missing differentialDiagnosis: ${medNullStats.noDDx}\n`);

  // Drug
  const drugs = await prisma.drug.findMany();
  const drugNulls = drugs.reduce((acc, d) => {
    if (!d.boardYieldFacts || d.boardYieldFacts.length === 0) acc.noBoardFacts++;
    if (!d.clinicalPearls || d.clinicalPearls.length === 0) acc.noClinicalPearls++;
    if (!d.blackBoxWarnings || d.blackBoxWarnings.length === 0) acc.noBlackBox++;
    return acc;
  }, { noBoardFacts: 0, noClinicalPearls: 0, noBlackBox: 0 });
  
  console.log(`💊 Drug: ${drugs.length} records`);
  console.log(`   Missing boardYieldFacts: ${drugNulls.noBoardFacts}`);
  console.log(`   Missing clinicalPearls: ${drugNulls.noClinicalPearls}`);
  console.log(`   Missing blackBoxWarnings: ${drugNulls.noBlackBox}\n`);

  // Procedure
  const procedures = await prisma.procedure.findMany();
  const procNulls = procedures.reduce((acc, p) => {
    if (!p.description) acc.noDescription++;
    if (!p.boardYieldFacts || p.boardYieldFacts.length === 0) acc.noBoardFacts++;
    if (!p.indications || p.indications.length === 0) acc.noIndications++;
    if (!p.complications || p.complications.length === 0) acc.noComplications++;
    return acc;
  }, { noDescription: 0, noBoardFacts: 0, noIndications: 0, noComplications: 0 });
  
  console.log(`🔧 Procedure: ${procedures.length} records`);
  console.log(`   Missing description: ${procNulls.noDescription}`);
  console.log(`   Missing boardYieldFacts: ${procNulls.noBoardFacts}`);
  console.log(`   Missing indications: ${procNulls.noIndications}`);
  console.log(`   Missing complications: ${procNulls.noComplications}\n`);

  // HistoryComponent
  const history = await prisma.historyComponent.findMany();
  const histNulls = history.reduce((acc, h) => {
    if (!h.boardYieldFacts || h.boardYieldFacts.length === 0) acc.noBoardFacts++;
    if (!h.description) acc.noDescription++;
    if (!h.clinicalSignificance || h.clinicalSignificance.length === 0) acc.noSignificance++;
    return acc;
  }, { noBoardFacts: 0, noDescription: 0, noSignificance: 0 });
  
  console.log(`📋 HistoryComponent: ${history.length} records`);
  console.log(`   Missing boardYieldFacts: ${histNulls.noBoardFacts}`);
  console.log(`   Missing description: ${histNulls.noDescription}`);
  console.log(`   Missing clinicalSignificance: ${histNulls.noSignificance}\n`);

  // Cases - should be generated
  console.log(`📚 Case Tables (Need Generation):`);
  console.log(`   LabCase: ${await prisma.labCase.count()}`);
  console.log(`   FluidCase: ${await prisma.fluidCase.count()}`);
  console.log(`   PatientEncounterCase: ${await prisma.patientEncounterCase.count()}\n`);

  // Treatment tables
  console.log(`💉 Treatment Tables:`);
  const flt = await prisma.firstLineTreatment.findMany();
  const fltEmpty = flt.filter(t => !t.clinicalPearls || t.clinicalPearls.length === 0).length;
  console.log(`   FirstLineTreatment: ${flt.length} (${fltEmpty} missing clinicalPearls)`);
  
  console.log(`   AntibioticGuideline: ${await prisma.antibioticGuideline.count()}`);
  console.log(`   ClinicalGuideline: ${await prisma.clinicalGuideline.count()}\n`);

  // Imaging & ECG
  const imaging = await prisma.imaging.findMany();
  const imgNulls = imaging.filter(i => !i.boardYieldFacts || i.boardYieldFacts.length === 0).length;
  console.log(`🏥 Imaging: ${imaging.length} records (${imgNulls} missing boardYieldFacts)`);
  
  const ecg = await prisma.eCGFinding.findMany();
  const ecgNulls = ecg.filter(e => !e.boardYieldFacts || e.boardYieldFacts.length === 0).length;
  console.log(`⚡ ECGFinding: ${ecg.length} records (${ecgNulls} missing boardYieldFacts)\n`);

  await prisma.$disconnect();
}

auditRemainingGaps().catch(console.error);
