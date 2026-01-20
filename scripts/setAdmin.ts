import { PrismaClient, UserRole } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { config } from 'dotenv';

// Load environment variables
config();

// Use DIRECT_DATABASE_URL for scripts (bypasses Accelerate proxy)
const directUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

if (!directUrl) {
  console.error('❌ DATABASE_URL not set in environment');
  process.exit(1);
}

// Prisma v7 requires adapter for PostgreSQL
const pool = new Pool({ connectionString: directUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function setAdmin() {
  const clerkId = 'user_36Mg4xDFyjaZi4vauAtvMUAArRc';

  try {
    // Try to update existing user, or create if doesn't exist
    const user = await prisma.user.upsert({
      where: { clerkId },
      update: { role: UserRole.SUPERADMIN },
      create: {
        clerkId,
        email: 'admin@panacea.local', // Placeholder - will be updated by Clerk webhook
        role: UserRole.SUPERADMIN,
        updatedAt: new Date(),
      },
    });

    console.log('✅ Success! User updated:');
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Clerk ID: ${user.clerkId}`);
  } catch (error: any) {
    console.error('❌ Error updating user:', error.message);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

setAdmin();
