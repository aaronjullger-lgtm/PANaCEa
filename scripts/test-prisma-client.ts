import { prisma, disconnect } from './_shared/db';

async function test() {
  try {
    console.log('Testing Prisma client...');
    console.log('Prisma type:', typeof prisma);
    console.log('Prisma constructor:', prisma.constructor.name);
    console.log('Prisma keys:', Object.keys(prisma).slice(0, 20));
    console.log('Has multipleChoiceQuestion:', 'multipleChoiceQuestion' in prisma);
    
    // Try to access multipleChoiceQuestion
    if ('multipleChoiceQuestion' in prisma) {
      console.log('multipleChoiceQuestion type:', typeof (prisma as any).multipleChoiceQuestion);
      const result = await (prisma as any).multipleChoiceQuestion.findFirst();
      console.log('Query result:', result ? 'Found record' : 'No records');
    } else {
      console.log('ERROR: multipleChoiceQuestion not found in prisma object');
      console.log('Trying to access it anyway...');
      const result = await (prisma as any).multipleChoiceQuestion.findFirst();
      console.log('Query result:', result);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await disconnect();
  }
}

test();
