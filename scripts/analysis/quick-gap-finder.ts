import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findGaps() {
  console.log('🔍 Quick Gap Finder - Finding Empty/NULL Fields\n');
  console.log('='.repeat(60));

  try {
    // ECGPattern - check for missing clinical content
    console.log('\n📈 ECGPattern:');
    const ecgTotal = await prisma.eCGPattern.count();
    const ecgNoClinicalPearls = await prisma.eCGPattern.count({
      where: { clinicalPearls: { isEmpty: true } }
    });
    const ecgNoBoardFacts = await prisma.eCGPattern.count({
      where: { boardYieldFacts: { isEmpty: true } }
    });
    console.log(`  Total: ${ecgTotal}`);
    console.log(`  Missing clinicalPearls: ${ecgNoClinicalPearls}`);
    console.log(`  Missing boardYieldFacts: ${ecgNoBoardFacts}`);

    // ImagingStudy
    console.log('\n🔬 ImagingStudy:');
    const imgTotal = await prisma.imagingStudy.count();
    const imgNoClinicalPearls = await prisma.imagingStudy.count({
      where: { clinicalPearls: { isEmpty: true } }
    });
    const imgNoBoardFacts = await prisma.imagingStudy.count({
      where: { boardYieldFacts: { isEmpty: true } }
    });
    console.log(`  Total: ${imgTotal}`);
    console.log(`  Missing clinicalPearls: ${imgNoClinicalPearls}`);
    console.log(`  Missing boardYieldFacts: ${imgNoBoardFacts}`);

    // Drug (PharmacologyAgent equivalent)
    console.log('\n💊 Drug:');
    const pharmaTotal = await prisma.drug.count();
    const pharmaNoClinicalPearls = await prisma.drug.count({
      where: { clinicalPearls: { isEmpty: true } }
    });
    const pharmaNoBoardFacts = await prisma.drug.count({
      where: { boardYieldFacts: { isEmpty: true } }
    });
    const pharmaNoMechanism = await prisma.drug.count({
      where: { OR: [{ mechanismOfAction: null }, { mechanismOfAction: '' }] }
    });
    console.log(`  Total: ${pharmaTotal}`);
    console.log(`  Missing clinicalPearls: ${pharmaNoClinicalPearls}`);
    console.log(`  Missing boardYieldFacts: ${pharmaNoBoardFacts}`);
    console.log(`  Missing mechanismOfAction: ${pharmaNoMechanism}`);

    // DifferentialDiagnosis
    console.log('\n🩺 DifferentialDiagnosis:');
    const ddxTotal = await prisma.differentialDiagnosis.count();
    const ddxNoClinicalPearls = await prisma.differentialDiagnosis.count({
      where: { clinicalPearls: { isEmpty: true } }
    });
    // No boardYieldFacts field in DDx
    console.log(`  Total: ${ddxTotal}`);
    console.log(`  Missing clinicalPearls: ${ddxNoClinicalPearls}`);

    // Procedure
    console.log('\n🔧 Procedure:');
    const procTotal = await prisma.procedure.count();
    const procNoClinicalPearls = await prisma.procedure.count({
      where: { clinicalPearls: { isEmpty: true } }
    });
    const procNoMnemonics = await prisma.procedure.count({
      where: { mnemonics: { isEmpty: true } }
    });
    console.log(`  Total: ${procTotal}`);
    console.log(`  Missing clinicalPearls: ${procNoClinicalPearls}`);
    console.log(`  Missing mnemonics: ${procNoMnemonics}`);

    // HistoryComponent
    console.log('\n📋 HistoryComponent:');
    const histTotal = await prisma.historyComponent.count();
    const histNoBoardFacts = await prisma.historyComponent.count({
      where: { boardYieldFacts: { isEmpty: true } }
    });
    console.log(`  Total: ${histTotal}`);
    console.log(`  Missing boardYieldFacts: ${histNoBoardFacts}`);

    // Check relationship links
    console.log('\n🔗 Condition Relationship Links:');
    const conditionCount = await prisma.condition.count();
    const ecgLinkCount = await prisma.eCGConditionLink.count();
    const labLinkCount = await prisma.labConditionLink.count();
    const imagingLinkCount = await prisma.imagingConditionLink.count();
    const findingLinkCount = await prisma.findingConditionLink.count();
    
    console.log(`  Conditions: ${conditionCount}`);
    console.log(`  Condition-ECG links: ${ecgLinkCount} (avg ${(ecgLinkCount/conditionCount).toFixed(1)} per condition)`);
    console.log(`  Condition-Lab links: ${labLinkCount} (avg ${(labLinkCount/conditionCount).toFixed(1)} per condition)`);
    console.log(`  Condition-Imaging links: ${imagingLinkCount} (avg ${(imagingLinkCount/conditionCount).toFixed(1)} per condition)`);
    console.log(`  Condition-Finding links: ${findingLinkCount} (avg ${(findingLinkCount/conditionCount).toFixed(1)} per condition)`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ Gap analysis complete\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findGaps();
