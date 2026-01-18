import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTableNulls() {
  try {
    console.log('🔍 Checking NULL/Empty Fields Across All Tables\n');
    console.log('='.repeat(80));

    // MedicalContent - MOST IMPORTANT
    console.log('\n📚 MedicalContent Table:');
    const mcTotal = await prisma.medicalContent.count();
    const mcNoMnemonic = await prisma.medicalContent.count({
      where: { OR: [{ mnemonic: null }, { mnemonic: '' }] },
    });
    const mcNoClinicalPearls = await prisma.medicalContent.count({
      where: { clinical_pearls: null },
    });
    const mcNoDifferentials = await prisma.medicalContent.count({ where: { differentials: null } });
    const mcNoOverview = await prisma.medicalContent.count({
      where: { OR: [{ overview: null }, { overview: '' }] },
    });
    const mcNoEpidemiology = await prisma.medicalContent.count({
      where: { OR: [{ epidemiology: null }, { epidemiology: '' }] },
    });
    const mcNoEtiology = await prisma.medicalContent.count({
      where: { OR: [{ etiology: null }, { etiology: '' }] },
    });
    const mcNoPathophysiology = await prisma.medicalContent.count({
      where: { OR: [{ pathophysiology: null }, { pathophysiology: '' }] },
    });
    const mcNoSymptoms = await prisma.medicalContent.count({
      where: { OR: [{ symptoms: null }, { symptoms: '' }] },
    });
    const mcNoPhysicalExam = await prisma.medicalContent.count({
      where: { OR: [{ physicalExam: null }, { physicalExam: '' }] },
    });
    const mcNoDiagnostics = await prisma.medicalContent.count({
      where: { OR: [{ diagnostics: null }, { diagnostics: '' }] },
    });
    const mcNoTreatment = await prisma.medicalContent.count({
      where: { OR: [{ treatment: null }, { treatment: '' }] },
    });
    const mcNoComplications = await prisma.medicalContent.count({
      where: { OR: [{ complications: null }, { complications: '' }] },
    });
    const mcNoPrognosis = await prisma.medicalContent.count({
      where: { OR: [{ prognosis: null }, { prognosis: '' }] },
    });
    const mcNoClassicTriad = await prisma.medicalContent.count({ where: { classic_triad: null } });
    const mcNoFirstLineRx = await prisma.medicalContent.count({
      where: { OR: [{ first_line_rx: null }, { first_line_rx: '' }] },
    });
    const mcNoGoldStandardDx = await prisma.medicalContent.count({
      where: { OR: [{ gold_standard_dx: null }, { gold_standard_dx: '' }] },
    });
    const mcNoBestInitialTest = await prisma.medicalContent.count({
      where: { OR: [{ best_initial_test: null }, { best_initial_test: '' }] },
    });

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

    // ECGConditionLink
    console.log('\n📊 ECG Links:');
    const conditions = await prisma.condition.count();
    const ecgPatterns = await prisma.eCGPattern.count();
    const ecgConditionLinks = await prisma.eCGConditionLink.count();
    console.log(`  Conditions: ${conditions}`);
    console.log(`  ECG Patterns: ${ecgPatterns}`);
    console.log(`  ECG-Condition Links: ${ecgConditionLinks}`);

    // LabConditionLink
    console.log('\n🧪 Lab Links:');
    const labTests = await prisma.labTest.count();
    const labConditionLinks = await prisma.labConditionLink.count();
    console.log(`  Lab Tests: ${labTests}`);
    console.log(`  Lab-Condition Links: ${labConditionLinks}`);

    // ImagingConditionLink
    console.log('\n🔬 Imaging Links:');
    const imagingStudies = await prisma.imagingStudy.count();
    const imagingConditionLinks = await prisma.imagingConditionLink.count();
    console.log(`  Imaging Studies: ${imagingStudies}`);
    console.log(`  Imaging-Condition Links: ${imagingConditionLinks}`);

    // Drug
    console.log('\n💊 Drug:');
    const drugs = await prisma.drug.findMany({
      select: {
        id: true,
        clinicalPearls: true,
        boardYieldFacts: true,
        mnemonics: true,
      },
    });
    const drugStats = {
      total: drugs.length,
      noClinicalPearls: drugs.filter((p) => !p.clinicalPearls || p.clinicalPearls.length === 0)
        .length,
      noBoardFacts: drugs.filter((p) => !p.boardYieldFacts || p.boardYieldFacts.length === 0)
        .length,
      noMnemonics: drugs.filter((p) => !p.mnemonics || p.mnemonics.length === 0).length,
    };
    console.log(`  Total: ${drugStats.total}`);
    console.log(`  Missing clinicalPearls: ${drugStats.noClinicalPearls}`);
    console.log(`  Missing boardYieldFacts: ${drugStats.noBoardFacts}`);
    console.log(`  Missing mnemonics: ${drugStats.noMnemonics}`);

    // ECGPattern
    console.log('\n📈 ECGPattern:');
    const ecg = await prisma.eCGPattern.findMany({
      select: {
        id: true,
        clinicalPearls: true,
        boardYieldFacts: true,
      },
    });
    const ecgStats = {
      total: ecg.length,
      noClinicalPearls: ecg.filter((e) => !e.clinicalPearls || e.clinicalPearls.length === 0)
        .length,
      noBoardFacts: ecg.filter((e) => !e.boardYieldFacts || e.boardYieldFacts.length === 0).length,
    };
    console.log(`  Total: ${ecgStats.total}`);
    console.log(`  Missing clinicalPearls: ${ecgStats.noClinicalPearls}`);
    console.log(`  Missing boardYieldFacts: ${ecgStats.noBoardFacts}`);

    // ImagingStudy
    console.log('\n🔬 ImagingStudy:');
    const imaging = await prisma.imagingStudy.findMany({
      select: {
        id: true,
        clinicalPearls: true,
      },
    });
    const imagingStats = {
      total: imaging.length,
      noClinicalPearls: imaging.filter((i) => !i.clinicalPearls || i.clinicalPearls.length === 0)
        .length,
    };
    console.log(`  Total: ${imagingStats.total}`);
    console.log(`  Missing clinicalPearls: ${imagingStats.noClinicalPearls}`);

    // DifferentialDiagnosis
    console.log('\n🩺 DifferentialDiagnosis:');
    const ddx = await prisma.differentialDiagnosis.findMany({
      select: {
        id: true,
        clinicalPearls: true,
        mnemonics: true,
      },
    });
    const ddxStats = {
      total: ddx.length,
      noClinicalPearls: ddx.filter((d) => !d.clinicalPearls || d.clinicalPearls.length === 0)
        .length,
      noMnemonics: ddx.filter((d) => !d.mnemonics || d.mnemonics.length === 0).length,
    };
    console.log(`  Total: ${ddxStats.total}`);
    console.log(`  Missing clinicalPearls: ${ddxStats.noClinicalPearls}`);
    console.log(`  Missing mnemonics: ${ddxStats.noMnemonics}`);

    // Procedure
    console.log('\n🔧 Procedure:');
    const procedures = await prisma.procedure.findMany({
      select: {
        id: true,
        clinicalPearls: true,
        mnemonics: true,
      },
    });
    const procStats = {
      total: procedures.length,
      noClinicalPearls: procedures.filter((p) => !p.clinicalPearls || p.clinicalPearls.length === 0)
        .length,
      noMnemonics: procedures.filter((p) => !p.mnemonics || p.mnemonics.length === 0).length,
    };
    console.log(`  Total: ${procStats.total}`);
    console.log(`  Missing clinicalPearls: ${procStats.noClinicalPearls}`);
    console.log(`  Missing mnemonics: ${procStats.noMnemonics}`);

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Analysis Complete\n');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTableNulls();
