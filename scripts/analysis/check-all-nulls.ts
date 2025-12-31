import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTableNulls() {
  try {
    console.log('🔍 Checking NULL/Empty Fields Across All Tables\n');
    console.log('='.repeat(80));

    // MedicalContent - MOST IMPORTANT
    console.log('\n📚 MedicalContent Table:');
    const mcTotal = await prisma.medicalContent.count();
    const mcNoMnemonic = await prisma.medicalContent.count({ where: { OR: [{ mnemonic: null }, { mnemonic: '' }] } });
    const mcNoClinicalPearls = await prisma.medicalContent.count({ where: { clinical_pearls: null } });
    const mcNoDifferentials = await prisma.medicalContent.count({ where: { differentials: null } });
    const mcNoOverview = await prisma.medicalContent.count({ where: { OR: [{ overview: null }, { overview: '' }] } });
    const mcNoEpidemiology = await prisma.medicalContent.count({ where: { OR: [{ epidemiology: null }, { epidemiology: '' }] } });
    const mcNoEtiology = await prisma.medicalContent.count({ where: { OR: [{ etiology: null }, { etiology: '' }] } });
    const mcNoPathophysiology = await prisma.medicalContent.count({ where: { OR: [{ pathophysiology: null }, { pathophysiology: '' }] } });
    const mcNoSymptoms = await prisma.medicalContent.count({ where: { OR: [{ symptoms: null }, { symptoms: '' }] } });
    const mcNoPhysicalExam = await prisma.medicalContent.count({ where: { OR: [{ physicalExam: null }, { physicalExam: '' }] } });
    const mcNoDiagnostics = await prisma.medicalContent.count({ where: { OR: [{ diagnostics: null }, { diagnostics: '' }] } });
    const mcNoTreatment = await prisma.medicalContent.count({ where: { OR: [{ treatment: null }, { treatment: '' }] } });
    const mcNoComplications = await prisma.medicalContent.count({ where: { OR: [{ complications: null }, { complications: '' }] } });
    const mcNoPrognosis = await prisma.medicalContent.count({ where: { OR: [{ prognosis: null }, { prognosis: '' }] } });
    const mcNoClassicTriad = await prisma.medicalContent.count({ where: { classic_triad: null } });
    const mcNoFirstLineRx = await prisma.medicalContent.count({ where: { OR: [{ first_line_rx: null }, { first_line_rx: '' }] } });
    const mcNoGoldStandardDx = await prisma.medicalContent.count({ where: { OR: [{ gold_standard_dx: null }, { gold_standard_dx: '' }] } });
    const mcNoBestInitialTest = await prisma.medicalContent.count({ where: { OR: [{ best_initial_test: null }, { best_initial_test: '' }] } });
    
    console.log(`  Total: ${mcTotal}`);
    console.log(`  Missing mnemonic: ${mcNoMnemonic}`);
    console.log(`  Missing clinical_pearls: ${mcNoClinicalPearls}`);
    console.log(`  Missing differentials: ${mcNoDifferentials}`);
    console.log(`  Missing overview: ${mcNoOverview}`);
    console.log(`  Missing epidemiology: ${mcNoEpidemiology}`);
    console.log(`  Missing etiology: ${mcNoEtiology}`);
    console.log(`  Missing pathophysiology: ${mcNoPathophysiology}`);
    console.log(`  Missing symptoms: ${mcNoSymptoms}`);
    console.log(`  Missing physicalExam: ${mcNoPhysicalExam}`);
    console.log(`  Missing diagnostics: ${mcNoDiagnostics}`);
    console.log(`  Missing treatment: ${mcNoTreatment}`);
    console.log(`  Missing complications: ${mcNoComplications}`);
    console.log(`  Missing prognosis: ${mcNoPrognosis}`);
    console.log(`  Missing classic_triad: ${mcNoClassicTriad}`);
    console.log(`  Missing first_line_rx: ${mcNoFirstLineRx}`);
    console.log(`  Missing gold_standard_dx: ${mcNoGoldStandardDx}`);
    console.log(`  Missing best_initial_test: ${mcNoBestInitialTest}`);

    // ConditionECGFinding links
    console.log('\n📊 ConditionECGFinding Links:');
    const conditions = await prisma.medicalContent.count();
    const ecgFindings = await prisma.eCGFinding.count();
    const conditionECGLinks = await prisma.conditionECGFinding.count();
    console.log(`  Conditions: ${conditions}`);
    console.log(`  ECG Findings: ${ecgFindings}`);
    console.log(`  Condition-ECG Links: ${conditionECGLinks}`);
    console.log(`  Potential missing links: Many conditions likely missing ECG associations`);

    // ConditionLabTest links
    console.log('\n🧪 ConditionLabTest Links:');
    const labTests = await prisma.labTest.count();
    const conditionLabLinks = await prisma.conditionLabTest.count();
    console.log(`  Lab Tests: ${labTests}`);
    console.log(`  Condition-Lab Links: ${conditionLabLinks}`);
    console.log(`  Potential missing links: Many conditions likely missing lab test associations`);

    // ConditionImagingFinding links
    console.log('\n🔬 ConditionImagingFinding Links:');
    const imagingFindings = await prisma.imagingFinding.count();
    const conditionImagingLinks = await prisma.conditionImagingFinding.count();
    console.log(`  Imaging Findings: ${imagingFindings}`);
    console.log(`  Condition-Imaging Links: ${conditionImagingLinks}`);

    // ConditionPhysicalExam links
    console.log('\n👨‍⚕️ ConditionPhysicalExam Links:');
    const peFindings = await prisma.physicalExamFinding.count();
    const conditionPELinks = await prisma.conditionPhysicalExam.count();
    console.log(`  PE Findings: ${peFindings}`);
    console.log(`  Condition-PE Links: ${conditionPELinks}`);

    // PharmacologyAgent
    console.log('\n💊 PharmacologyAgent:');
    const pharma = await prisma.pharmacologyAgent.findMany({
      select: {
        id: true,
        clinicalPearls: true,
        boardYieldFacts: true,
        mnemonic: true,
      },
    });
    const pharmaStats = {
      total: pharma.length,
      noClinicalPearls: pharma.filter(p => !p.clinicalPearls || p.clinicalPearls.length === 0).length,
      noBoardFacts: pharma.filter(p => !p.boardYieldFacts || p.boardYieldFacts.length === 0).length,
      noMnemonic: pharma.filter(p => !p.mnemonic || p.mnemonic.trim() === '').length,
    };
    console.log(`  Total: ${pharmaStats.total}`);
    console.log(`  Missing clinicalPearls: ${pharmaStats.noClinicalPearls}`);
    console.log(`  Missing boardYieldFacts: ${pharmaStats.noBoardFacts}`);
    console.log(`  Missing mnemonic: ${pharmaStats.noMnemonic}`);

    // ECGFinding
    console.log('\n📈 ECGFinding:');
    const ecg = await prisma.eCGFinding.findMany({
      select: {
        id: true,
        clinicalPearls: true,
        boardYieldFacts: true,
        sensitivity: true,
        specificity: true,
      },
    });
    const ecgStats = {
      total: ecg.length,
      noClinicalPearls: ecg.filter(e => !e.clinicalPearls || e.clinicalPearls.length === 0).length,
      noBoardFacts: ecg.filter(e => !e.boardYieldFacts || e.boardYieldFacts.length === 0).length,
      noSensitivity: ecg.filter(e => e.sensitivity === null).length,
      noSpecificity: ecg.filter(e => e.specificity === null).length,
    };
    console.log(`  Total: ${ecgStats.total}`);
    console.log(`  Missing clinicalPearls: ${ecgStats.noClinicalPearls}`);
    console.log(`  Missing boardYieldFacts: ${ecgStats.noBoardFacts}`);
    console.log(`  Missing sensitivity: ${ecgStats.noSensitivity}`);
    console.log(`  Missing specificity: ${ecgStats.noSpecificity}`);

    // ImagingFinding
    console.log('\n🔬 ImagingFinding:');
    const imaging = await prisma.imagingFinding.findMany({
      select: {
        id: true,
        clinicalPearls: true,
        boardYieldFacts: true,
        sensitivity: true,
        specificity: true,
      },
    });
    const imagingStats = {
      total: imaging.length,
      noClinicalPearls: imaging.filter(i => !i.clinicalPearls || i.clinicalPearls.length === 0).length,
      noBoardFacts: imaging.filter(i => !i.boardYieldFacts || i.boardYieldFacts.length === 0).length,
      noSensitivity: imaging.filter(i => i.sensitivity === null).length,
      noSpecificity: imaging.filter(i => i.specificity === null).length,
    };
    console.log(`  Total: ${imagingStats.total}`);
    console.log(`  Missing clinicalPearls: ${imagingStats.noClinicalPearls}`);
    console.log(`  Missing boardYieldFacts: ${imagingStats.noBoardFacts}`);
    console.log(`  Missing sensitivity: ${imagingStats.noSensitivity}`);
    console.log(`  Missing specificity: ${imagingStats.noSpecificity}`);

    // DifferentialDiagnosis
    console.log('\n🩺 DifferentialDiagnosis:');
    const ddx = await prisma.differentialDiagnosis.findMany({
      select: {
        id: true,
        clinicalPearls: true,
        boardYieldFacts: true,
      },
    });
    const ddxStats = {
      total: ddx.length,
      noClinicalPearls: ddx.filter(d => !d.clinicalPearls || d.clinicalPearls.length === 0).length,
      noBoardFacts: ddx.filter(d => !d.boardYieldFacts || d.boardYieldFacts.length === 0).length,
    };
    console.log(`  Total: ${ddxStats.total}`);
    console.log(`  Missing clinicalPearls: ${ddxStats.noClinicalPearls}`);
    console.log(`  Missing boardYieldFacts: ${ddxStats.noBoardFacts}`);

    // Procedure
    console.log('\n🔧 Procedure:');
    const procedures = await prisma.procedure.findMany({
      select: {
        id: true,
        clinicalPearls: true,
        mnemonic: true,
      },
    });
    const procStats = {
      total: procedures.length,
      noClinicalPearls: procedures.filter(p => !p.clinicalPearls || p.clinicalPearls.length === 0).length,
      noMnemonic: procedures.filter(p => !p.mnemonic || p.mnemonic.trim() === '').length,
    };
    console.log(`  Total: ${procStats.total}`);
    console.log(`  Missing clinicalPearls: ${procStats.noClinicalPearls}`);
    console.log(`  Missing mnemonic: ${procStats.noMnemonic}`);

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Analysis Complete\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTableNulls();
