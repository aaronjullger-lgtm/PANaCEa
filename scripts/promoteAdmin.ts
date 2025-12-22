import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function promoteToSuperAdmin() {
  // Get the target email from command line arguments
  const targetEmail = process.argv[2];

  if (!targetEmail) {
    console.error('❌ Error: Please provide an email address');
    console.log('Usage: npx tsx scripts/promoteAdmin.ts user@example.com');
    process.exit(1);
  }

  try {
    // Find and update the user
    const user = await prisma.user.findUnique({
      where: { email: targetEmail },
    });

    if (!user) {
      console.error(`❌ Error: User with email "${targetEmail}" not found`);
      process.exit(1);
    }

    // Update the user's role to SUPERADMIN
    const updatedUser = await prisma.user.update({
      where: { email: targetEmail },
      data: { role: UserRole.SUPERADMIN },
    });

    console.log('✅ Success: User promoted to SUPERADMIN');
    console.log(`   Email: ${updatedUser.email}`);
    console.log(`   Name: ${updatedUser.firstName || ''} ${updatedUser.lastName || ''}`.trim());
    console.log(`   Role: ${updatedUser.role}`);
    console.log(`   User ID: ${updatedUser.id}`);
  } catch (error) {
    console.error('❌ Error promoting user:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

promoteToSuperAdmin();
