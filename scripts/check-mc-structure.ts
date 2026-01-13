import { prisma, disconnectPrisma } from './helpers/prisma-client.js';

async function check() {
  const mc = await prisma.medicalContent.findFirst({ 
    where: { conditionId: 'CV__ischemic_heart_disease__stemi' },
    select: { id: true, conditionId: true, condition: true } 
  });
  console.log('MedicalContent for STEMI:', JSON.stringify(mc, null, 2));
  
  // Check if id === conditionId
  if (mc) {
    console.log(`\nid === conditionId? ${mc.id === mc.conditionId}`);
  }
  
  await disconnectPrisma();
}

check();
