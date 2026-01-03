import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkECGConditions() {
  console.log('Checking ECG-related MedicalContent entries...\n');
  
  // Get ECG conditions
  const ecgConditions = await prisma.condition.findMany({
    where: { id: { contains: 'ecg' } }
  });
  
  console.log('Found ' + ecgConditions.length + ' ECG conditions\n');
  
  // Get MedicalContent for these conditions
  const ecgIds = ecgConditions.map(c => c.id);
  const medicalContents = await prisma.medicalContent.findMany({
    where: { conditionId: { in: ecgIds } }
  });
  
  const mcMap = new Map(medicalContents.map(mc => [mc.conditionId, mc]));
  
  for (const cond of ecgConditions.slice(0, 5)) {
    console.log('═══════════════════════════════════════════════════');
    console.log('Condition: ' + cond.id);
    console.log('Name: ' + cond.name);
    
    const mc = mcMap.get(cond.id);
    if (mc) {
      console.log('\nMedicalContent fields:');
      console.log('  overview:', mc.overview ? (mc.overview.substring(0, 80) + '...') : 'EMPTY');
      console.log('  pathophysiology:', mc.pathophysiology ? 'HAS DATA' : 'EMPTY');
      console.log('  symptoms:', mc.symptoms ? 'HAS DATA' : 'EMPTY');
      console.log('  diagnostics:', mc.diagnostics ? 'HAS DATA' : 'EMPTY');
      console.log('  treatment:', mc.treatment ? 'HAS DATA' : 'EMPTY');
      console.log('  differentials:', mc.differentials ? 'HAS DATA' : 'EMPTY');
      console.log('  clinical_pearls:', mc.clinical_pearls ? 'HAS DATA' : 'EMPTY');
    } else {
      console.log('  NO MedicalContent record!');
    }
  }
  
  // Count issues
  console.log('\n═══════════════════════════════════════════════════');
  console.log('SUMMARY OF ECG CONDITIONS:');
  
  let noContent = 0;
  let emptyOverview = 0;
  let emptyPathophys = 0;
  let emptyPearls = 0;
  
  for (const cond of ecgConditions) {
    const mc = mcMap.get(cond.id);
    if (!mc) { noContent++; continue; }
    if (!mc.overview || mc.overview === '') emptyOverview++;
    if (!mc.pathophysiology) emptyPathophys++;
    if (!mc.clinical_pearls) emptyPearls++;
  }
  
  console.log('  Total ECG conditions: ' + ecgConditions.length);
  console.log('  Missing MedicalContent: ' + noContent);
  console.log('  Empty overview: ' + emptyOverview);
  console.log('  Empty pathophysiology: ' + emptyPathophys);
  console.log('  Empty clinicalPearls: ' + emptyPearls);
  
  // Show all ECG condition IDs
  console.log('\n═══════════════════════════════════════════════════');
  console.log('ALL ECG CONDITION IDs:');
  ecgConditions.forEach(c => console.log('  ' + c.id));
  
  await prisma.$disconnect();
}

checkECGConditions();
