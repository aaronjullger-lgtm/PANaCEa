/**
 * Study Group Service
 * Sprint 8: Social & Gamification - Study group management
 *
 * STATUS: NOT YET IMPLEMENTED — no backend API endpoints exist for study groups.
 * All methods return mock/empty data. The /api/social/* endpoints do not exist.
 * Types are exported for use by components that will consume this when implemented.
 *
 * Enables users to create/join study groups, track group progress,
 * and participate in collaborative learning challenges.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface StudyGroup {
  id: string;
  name: string;
  description?: string;
  code: string; // 6-character join code
  createdAt: Date;
  createdBy: string;
  isPublic: boolean;
  maxMembers: number;
  memberCount: number;
  avatarUrl?: string;
  settings: GroupSettings;
}

export interface GroupSettings {
  requireApproval: boolean;
  allowLeaderboard: boolean;
  dailyChallengeEnabled: boolean;
  sharedStreaksEnabled: boolean;
  minActivityForStreak: number; // questions per day
}

export interface GroupMember {
  userId: string;
  groupId: string;
  displayName: string;
  avatarUrl?: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: Date;
  lastActiveAt: Date;
  weeklyQuestions: number;
  weeklyAccuracy: number;
  currentStreak: number;
  badges: string[];
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  score: number;
  questionsAnswered: number;
  accuracy: number;
  streak: number;
  trend: 'up' | 'down' | 'stable';
}

export interface GroupChallenge {
  id: string;
  groupId: string;
  title: string;
  description: string;
  type: 'daily' | 'weekly' | 'custom';
  targetSystem?: string;
  targetQuestions: number;
  targetAccuracy?: number;
  startDate: Date;
  endDate: Date;
  status: 'upcoming' | 'active' | 'completed';
  participants: ChallengeParticipant[];
  winner?: string;
}

export interface ChallengeParticipant {
  userId: string;
  displayName: string;
  questionsCompleted: number;
  accuracy: number;
  completedAt?: Date;
}

export interface GroupInvite {
  id: string;
  groupId: string;
  groupName: string;
  invitedBy: string;
  invitedByName: string;
  createdAt: Date;
  expiresAt: Date;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate a random 6-character join code
 */
function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing characters
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Calculate weekly score for leaderboard ranking
 * Weighted formula: (accuracy * 100) + (questions * 2) + (streak * 10)
 */
function calculateWeeklyScore(questionsAnswered: number, accuracy: number, streak: number): number {
  return Math.round(accuracy * 100 + questionsAnswered * 2 + streak * 10);
}

// =============================================================================
// SERVICE CLASS
// =============================================================================

export class StudyGroupService {
  /**
   * Create a new study group
   */
  static async createGroup(
    userId: string,
    name: string,
    description?: string,
    isPublic: boolean = false,
    settings?: Partial<GroupSettings>
  ): Promise<StudyGroup> {
    const defaultSettings: GroupSettings = {
      requireApproval: !isPublic,
      allowLeaderboard: true,
      dailyChallengeEnabled: true,
      sharedStreaksEnabled: true,
      minActivityForStreak: 10,
      ...settings,
    };

    const group: StudyGroup = {
      id: crypto.randomUUID(),
      name,
      description,
      code: generateJoinCode(),
      createdAt: new Date(),
      createdBy: userId,
      isPublic,
      maxMembers: 50,
      memberCount: 1,
      settings: defaultSettings,
    };

    // TODO: Save to database
    // await prisma.studyGroup.create({ data: group });

    return group;
  }

  /**
   * Join a group using a join code
   */
  static async joinGroup(
    userId: string,
    code: string
  ): Promise<{ success: boolean; group?: StudyGroup; error?: string }> {
    // TODO: Fetch group from database
    // const group = await prisma.studyGroup.findUnique({ where: { code } });

    // Placeholder validation
    if (code.length !== 6) {
      return { success: false, error: 'Invalid join code format' };
    }

    // Check if group exists
    // if (!group) return { success: false, error: "Group not found" };

    // Check member limit
    // if (group.memberCount >= group.maxMembers) {
    //   return { success: false, error: "Group is full" };
    // }

    // Add member
    // await prisma.studyGroupMember.create({ ... });

    return {
      success: true,
      group: {
        id: 'placeholder',
        name: 'Study Group',
        code,
        createdAt: new Date(),
        createdBy: 'placeholder',
        isPublic: false,
        maxMembers: 50,
        memberCount: 1,
        settings: {
          requireApproval: true,
          allowLeaderboard: true,
          dailyChallengeEnabled: true,
          sharedStreaksEnabled: true,
          minActivityForStreak: 10,
        },
      },
    };
  }

  /**
   * Get user's groups
   */
  static async getUserGroups(userId: string): Promise<StudyGroup[]> {
    // TODO: Fetch from database
    // const memberships = await prisma.studyGroupMember.findMany({
    //   where: { userId },
    //   include: { group: true }
    // });
    return [];
  }

  /**
   * Get group members
   */
  static async getGroupMembers(groupId: string): Promise<GroupMember[]> {
    // TODO: Fetch from database with weekly stats
    return [];
  }

  /**
   * Generate weekly leaderboard for a group
   */
  static generateLeaderboard(members: GroupMember[]): LeaderboardEntry[] {
    const entries = members.map((member, index) => ({
      rank: 0,
      userId: member.userId,
      displayName: member.displayName,
      avatarUrl: member.avatarUrl,
      score: calculateWeeklyScore(
        member.weeklyQuestions,
        member.weeklyAccuracy,
        member.currentStreak
      ),
      questionsAnswered: member.weeklyQuestions,
      accuracy: member.weeklyAccuracy,
      streak: member.currentStreak,
      trend: 'stable' as const, // TODO: Compare to previous week
    }));

    // Sort by score descending
    entries.sort((a, b) => b.score - a.score);

    // Assign ranks
    entries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    return entries;
  }

  /**
   * Check if group qualifies for shared streak
   * Requires minActiveMembers out of totalMembers to have studied today
   */
  static checkSharedStreak(
    members: GroupMember[],
    minActivityForStreak: number,
    minActiveRatio: number = 0.6
  ): { qualified: boolean; activeCount: number; requiredCount: number } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeToday = members.filter((member) => {
      const lastActive = new Date(member.lastActiveAt);
      lastActive.setHours(0, 0, 0, 0);
      return lastActive.getTime() === today.getTime();
    });

    const requiredCount = Math.ceil(members.length * minActiveRatio);

    return {
      qualified: activeToday.length >= requiredCount,
      activeCount: activeToday.length,
      requiredCount,
    };
  }

  /**
   * Create a group challenge
   */
  static async createChallenge(
    groupId: string,
    title: string,
    targetQuestions: number,
    durationDays: number = 1,
    targetSystem?: string,
    targetAccuracy?: number
  ): Promise<GroupChallenge> {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + durationDays);

    const challenge: GroupChallenge = {
      id: crypto.randomUUID(),
      groupId,
      title,
      description: targetSystem
        ? `Complete ${targetQuestions} ${targetSystem} questions`
        : `Complete ${targetQuestions} questions`,
      type: durationDays === 1 ? 'daily' : durationDays === 7 ? 'weekly' : 'custom',
      targetSystem,
      targetQuestions,
      targetAccuracy,
      startDate: now,
      endDate,
      status: 'active',
      participants: [],
    };

    // TODO: Save to database
    return challenge;
  }

  /**
   * Update participant progress in a challenge
   */
  static updateChallengeProgress(
    challenge: GroupChallenge,
    userId: string,
    displayName: string,
    questionsCompleted: number,
    accuracy: number
  ): GroupChallenge {
    const existingIndex = challenge.participants.findIndex((p) => p.userId === userId);

    const participant: ChallengeParticipant = {
      userId,
      displayName,
      questionsCompleted,
      accuracy,
      completedAt: questionsCompleted >= challenge.targetQuestions ? new Date() : undefined,
    };

    if (existingIndex >= 0) {
      challenge.participants[existingIndex] = participant;
    } else {
      challenge.participants.push(participant);
    }

    // Check for winner (first to complete)
    if (!challenge.winner && participant.completedAt) {
      challenge.winner = userId;
    }

    return challenge;
  }

  /**
   * Get active challenges for a group
   */
  static async getActiveChallenges(groupId: string): Promise<GroupChallenge[]> {
    // TODO: Fetch from database
    return [];
  }

  /**
   * Generate daily challenge for a group
   */
  static generateDailyChallenge(groupId: string): GroupChallenge {
    const systems = [
      'Cardiovascular',
      'Pulmonary',
      'GI/Nutrition',
      'Musculoskeletal',
      'Neurology',
      'Psychiatry',
      'Dermatology',
      'HEENT',
      'Endocrine',
      'Reproductive',
    ];

    // Pick a random system for the daily challenge
    const randomSystem = systems[Math.floor(Math.random() * systems.length)];
    const today = new Date();
    const dayOfYear = Math.floor(
      (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Seed the "random" with day of year for consistency
    const seededSystem = systems[dayOfYear % systems.length];

    return this.createChallenge(
      groupId,
      `Daily ${seededSystem} Challenge`,
      20,
      1,
      seededSystem,
      70
    ) as unknown as GroupChallenge;
  }

  /**
   * Invite user to group
   */
  static async inviteUser(
    groupId: string,
    groupName: string,
    invitedByUserId: string,
    invitedByName: string,
    inviteeUserId: string
  ): Promise<GroupInvite> {
    const invite: GroupInvite = {
      id: crypto.randomUUID(),
      groupId,
      groupName,
      invitedBy: invitedByUserId,
      invitedByName,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      status: 'pending',
    };

    // TODO: Save to database and send notification
    return invite;
  }

  /**
   * Respond to group invite
   */
  static async respondToInvite(
    inviteId: string,
    userId: string,
    accept: boolean
  ): Promise<{ success: boolean; error?: string }> {
    // TODO: Update invite status and add member if accepted
    return { success: true };
  }

  /**
   * Leave a group
   */
  static async leaveGroup(
    userId: string,
    groupId: string
  ): Promise<{ success: boolean; error?: string }> {
    // TODO: Remove member from group
    // Cannot leave if you're the only owner
    return { success: true };
  }

  /**
   * Update group settings (admin/owner only)
   */
  static async updateGroupSettings(
    groupId: string,
    userId: string,
    settings: Partial<GroupSettings>
  ): Promise<{ success: boolean; error?: string }> {
    // TODO: Check permissions and update
    return { success: true };
  }
}

export default StudyGroupService;
