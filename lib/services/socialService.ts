import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../prisma';

export async function createStudyGroup(userId: string, name: string, description?: string) {
  const prisma = getPrisma();

  // Generate a unique 6-character code
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();

  const group = await prisma.studyGroup.create({
    data: {
      id: uuidv4(),
      name,
      description,
      code,
      ownerId: userId,
      StudyGroupMember: {
        create: {
          id: uuidv4(),
          userId,
          role: 'admin',
        },
      },
    },
    include: {
      StudyGroupMember: true,
    },
  });

  return group;
}

export async function joinStudyGroup(userId: string, code: string) {
  const group = await prisma.studyGroup.findUnique({
    where: { code },
  });

  if (!group) {
    throw new Error('Group not found');
  }

  // Check if already a member
  const existingMember = await prisma.studyGroupMember.findUnique({
    where: {
      userId_groupId: {
        userId,
        groupId: group.id,
      },
    },
  });

  if (existingMember) {
    return group;
  }

  await prisma.studyGroupMember.create({
    data: {
      id: uuidv4(),
      userId,
      groupId: group.id,
      role: 'member',
    },
  });

  return group;
}

export async function getUserGroups(userId: string) {
  const prisma = getPrisma();

  const members = await prisma.studyGroupMember.findMany({
    where: { userId },
    include: {
      StudyGroup: {
        include: {
          _count: {
            select: { StudyGroupMember: true },
          },
        },
      },
    },
  });

  return members.map((m) => ({
    ...m.StudyGroup,
    role: m.role,
    memberCount: m.StudyGroup._count.StudyGroupMember,
  }));
}

export async function getLeaderboard(
  period: 'weekly' | 'monthly' | 'all_time' = 'weekly',
  groupId?: string
) {
  // For now, we'll just return the top users based on accuracy or questions answered
  // In a real implementation, we'd query the Leaderboard/LeaderboardEntry tables
  // But since we don't have a background job populating those yet, let's query User stats directly

  // This is a simplified "live" leaderboard based on DailyStreak or similar
  // Or we can use the LeaderboardEntry if we populate it.

  // Let's try to use the LeaderboardEntry if it exists, otherwise fallback?
  // Actually, let's just query the Leaderboard table. If it's empty, it returns empty.
  // We need a job to populate it.

  // const leaderboard = await prisma.leaderboard.findFirst({
  //   where: {
  //     period,
  //     groupId: groupId || null
  //   },
  //   include: {
  //     entries: {
  //       include: {
  //         user: true
  //       },
  //       orderBy: {
  //         score: 'desc'
  //       },
  //       take: limit
  //     }
  //   }
  // });
  const leaderboard = null;

  return leaderboard;
}
