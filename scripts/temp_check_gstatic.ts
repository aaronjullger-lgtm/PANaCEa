import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findGoogleThumbnails() {
  console.log('Searching for Google thumbnail URLs in MediaAsset table...');

  try {
    const googleThumbnails = await prisma.mediaAsset.findMany({
      where: {
        OR: [
          { originalUrl: { contains: 'encrypted-tbn0.gstatic.com' } },
          { thumbnailUrl: { contains: 'encrypted-tbn0.gstatic.com' } },
        ],
      },
      select: {
        id: true,
        conditionId: true,
        originalUrl: true,
        thumbnailUrl: true,
      },
    });

    if (googleThumbnails.length > 0) {
      console.log(`Found ${googleThumbnails.length} records using Google thumbnail URLs:`);
      for (const item of googleThumbnails) {
        console.log(`  ID: ${item.id}, Condition ID: ${item.conditionId}`);
        console.log(`    Original URL: ${item.originalUrl}`);
        console.log(`    Thumbnail URL: ${item.thumbnailUrl}`);
      }
    } else {
      console.log('No Google thumbnail URLs found in the MediaAsset table.');
    }
  } catch (error) {
    console.error('Error querying database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findGoogleThumbnails().catch(console.error);
