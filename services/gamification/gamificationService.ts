/**
 * Gamification Service
 * 
 * Implements creative engagement features:
 * - Phantom Patient system (visual motivation)
 * - Audio-first reviews (podcast generation)
 * - Consult system (SBAR training)
 * - Avatar progression
 * - Achievement badges
 * 
 * @module gamificationService
 */

import type {
  PhantomPatient,
  AudioPodcastReview,
  ConsultRequest,
  ConsultantPersona,
  ConsultantType,
  UserAvatar,
  AvatarAccessory,
  AchievementBadge,
} from '@/types/interface-fabric-system';

interface GamificationConfig {
  geminiApiKey: string;
  veoApiKey: string;
}

export class GamificationService {
  private config: GamificationConfig;

  constructor(config: GamificationConfig) {
    this.config = config;
  }

  // ========================================================================
  // PHANTOM PATIENT SYSTEM
  // ========================================================================

  /**
   * Create phantom patient for user.
   */
  async createPhantomPatient(userId: string, condition: string): Promise<PhantomPatient> {
    // Generate video loop using veo_cameos
    const videoPrompt = this.buildPhantomPatientPrompt(condition, 'healthy');
    const videoUrl = await this.generatePhantomVideo(videoPrompt);

    return {
      id: `phantom-${userId}`,
      name: 'Alex Patient',
      condition,
      healthState: 100,
      videoUrl,
      decayRate: 5, // Loses 5 points per day of inactivity
      healingRate: 10, // Gains 10 points per study session
      status: 'healthy',
      lastInteraction: new Date().toISOString(),
      daysSinceInteraction: 0,
      message: 'Looking great! Keep up the studying.',
    };
  }

  /**
   * Update phantom patient health based on user activity.
   */
  async updatePhantomPatient(
    patient: PhantomPatient,
    lastStudyDate: Date
  ): Promise<PhantomPatient> {
    const now = new Date();
    const daysSince = Math.floor((now.getTime() - lastStudyDate.getTime()) / (1000 * 60 * 60 * 24));

    // Calculate health decay
    const healthDecay = daysSince * patient.decayRate;
    const newHealth = Math.max(0, patient.healthState - healthDecay);

    // Determine new status
    let newStatus: PhantomPatient['status'] = 'healthy';
    let newMessage: string | undefined;

    if (newHealth >= 80) {
      newStatus = 'healthy';
      newMessage = 'Looking great! Keep up the studying.';
    } else if (newHealth >= 60) {
      newStatus = 'stable';
      newMessage = 'Doing okay, but could use your attention.';
    } else if (newHealth >= 40) {
      newStatus = 'declining';
      newMessage = 'Not feeling well. When was your last study session?';
    } else if (newHealth > 0) {
      newStatus = 'critical';
      newMessage = "I really need your help. You haven't studied in a while!";
    }

    // Regenerate video if status changed
    let videoUrl = patient.videoUrl;
    if (newStatus !== patient.status) {
      const videoPrompt = this.buildPhantomPatientPrompt(patient.condition, newStatus);
      videoUrl = await this.generatePhantomVideo(videoPrompt);
    }

    return {
      ...patient,
      healthState: newHealth,
      status: newStatus,
      daysSinceInteraction: daysSince,
      videoUrl,
      message: newMessage,
    };
  }

  /**
   * Heal phantom patient after study session.
   */
  healPhantomPatient(patient: PhantomPatient): PhantomPatient {
    const newHealth = Math.min(100, patient.healthState + patient.healingRate);

    return {
      ...patient,
      healthState: newHealth,
      status: newHealth >= 80 ? 'healthy' : patient.status,
      lastInteraction: new Date().toISOString(),
      daysSinceInteraction: 0,
    };
  }

  /**
   * Build video prompt for phantom patient.
   */
  private buildPhantomPatientPrompt(condition: string, status: PhantomPatient['status']): string {
    const basePrompt = `Patient with ${condition} in hospital room`;

    switch (status) {
      case 'healthy':
        return `${basePrompt}, sitting up in bed, smiling, reading, comfortable, good color`;
      case 'stable':
        return `${basePrompt}, resting in bed, calm, slightly tired`;
      case 'declining':
        return `${basePrompt}, uncomfortable, restless, worried expression`;
      case 'critical':
        return `${basePrompt}, severe distress, labored breathing, pale, monitors alarming`;
      case 'recovered':
        return `${basePrompt}, dressed in street clothes, waving goodbye, smiling, ready for discharge`;
      default:
        return basePrompt;
    }
  }

  /**
   * Generate phantom patient video.
   */
  private async generatePhantomVideo(prompt: string): Promise<string> {
    // Call veo_cameos API
    try {
      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1/models/veo-2:generate',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.veoApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              videoDuration: 5,
              loop: true,
              style: 'realistic',
            },
          }),
        }
      );

      const data = await response.json();
      return data.videoUrl || data.uri || '';
    } catch (error) {
      console.error('Phantom video generation error:', error);
      return '';
    }
  }

  // ========================================================================
  // AUDIO-FIRST REVIEWS (PODCAST GENERATION)
  // ========================================================================

  /**
   * Generate audio podcast review of weak areas.
   */
  async generateAudioReview(
    userId: string,
    weakAreas: string[],
    missedQuestions: Array<{ question: string; correctAnswer: string; explanation: string }>
  ): Promise<AudioPodcastReview> {
    // Build script
    const script = this.buildPodcastScript(weakAreas, missedQuestions);

    // Generate audio using voice-library
    const audioUrl = await this.generatePodcastAudio(script);

    return {
      id: `podcast-${userId}-${Date.now()}`,
      userId,
      title: 'Your Personalized Review Podcast',
      description: `Review of your weak areas: ${weakAreas.join(', ')}`,
      audioUrl,
      duration: this.estimateDuration(script),
      content: {
        weakAreas,
        missedQuestions: missedQuestions.length,
        keyTeachingPoints: missedQuestions.map((q) => q.explanation).slice(0, 5),
        citations: [],
      },
      voice: {
        voiceId: 'Aoede',
        rate: 1.0,
        tone: 'educational',
      },
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Build podcast script from missed questions.
   */
  private buildPodcastScript(
    weakAreas: string[],
    missedQuestions: Array<{ question: string; correctAnswer: string; explanation: string }>
  ): string {
    let script = `Welcome to your personalized PANaCEa review podcast. In this session, we'll review your recent performance and focus on your weak areas.\n\n`;

    script += `Your main areas for improvement are: ${weakAreas.join(', ')}.\n\n`;

    script += `Let's go through some key concepts you missed:\n\n`;

    for (let i = 0; i < Math.min(5, missedQuestions.length); i++) {
      const q = missedQuestions[i];
      script += `Question ${i + 1}: ${q.question}\n`;
      script += `The correct answer is: ${q.correctAnswer}.\n`;
      script += `Here's why: ${q.explanation}\n\n`;
    }

    script += `Remember, repetition and spaced review are key to retention. Keep up the great work!`;

    return script;
  }

  /**
   * Generate audio from script.
   */
  private async generatePodcastAudio(script: string): Promise<string> {
    // Call Gemini voice-library API
    try {
      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-audio:synthesize',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.geminiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: script,
            voice: {
              voiceId: 'Aoede',
              rate: 1.0,
            },
          }),
        }
      );

      const data = await response.json();
      return data.audioUrl || '';
    } catch (error) {
      console.error('Podcast audio generation error:', error);
      return '';
    }
  }

  /**
   * Estimate duration of podcast.
   */
  private estimateDuration(script: string): number {
    // Rough estimate: 150 words per minute
    const words = script.split(/\s+/).length;
    return Math.ceil((words / 150) * 60);
  }

  // ========================================================================
  // CONSULT SYSTEM (SBAR TRAINING)
  // ========================================================================

  /**
   * Initiate a consult request.
   */
  async requestConsult(
    sessionId: string,
    studentId: string,
    consultantType: ConsultantType,
    consultantPersona: ConsultantPersona
  ): Promise<ConsultRequest> {
    const request: ConsultRequest = {
      id: `consult-${Date.now()}`,
      sessionId,
      studentId,
      consultantType,
      consultantPersona,
      transcript: [],
      outcome: 'in_progress',
      requestedAt: new Date().toISOString(),
    };

    // Simulate "paging" delay
    await new Promise((resolve) => setTimeout(resolve, consultantPersona.availability.respondTime * 1000));

    request.answeredAt = new Date().toISOString();

    return request;
  }

  /**
   * Evaluate SBAR quality.
   */
  evaluateSBAR(
    sbar: ConsultRequest['sbar'],
    expectedInfo: {
      situation: string[];
      background: string[];
      assessment: string[];
      recommendation: string[];
    }
  ): { score: number; feedback: string } {
    if (!sbar) {
      return {
        score: 0,
        feedback: 'No SBAR provided. Consultants expect structured communication.',
      };
    }

    let score = 0;
    const feedback: string[] = [];

    // Evaluate each section
    const situationComplete = this.checkCompleteness(sbar.situation, expectedInfo.situation);
    score += situationComplete * 25;
    if (situationComplete < 0.8) {
      feedback.push('Situation: Missing key information about the clinical scenario');
    }

    const backgroundComplete = this.checkCompleteness(sbar.background, expectedInfo.background);
    score += backgroundComplete * 25;
    if (backgroundComplete < 0.8) {
      feedback.push('Background: Incomplete patient history');
    }

    const assessmentComplete = this.checkCompleteness(sbar.assessment, expectedInfo.assessment);
    score += assessmentComplete * 25;
    if (assessmentComplete < 0.8) {
      feedback.push('Assessment: Missing your clinical impression');
    }

    const recommendationComplete = this.checkCompleteness(
      sbar.recommendation,
      expectedInfo.recommendation
    );
    score += recommendationComplete * 25;
    if (recommendationComplete < 0.8) {
      feedback.push('Recommendation: Unclear what you want from the consultant');
    }

    return {
      score: Math.round(score),
      feedback: feedback.length > 0 ? feedback.join('. ') : 'Excellent SBAR format!',
    };
  }

  /**
   * Check completeness of a section.
   */
  private checkCompleteness(provided: string, required: string[]): number {
    const providedLower = provided.toLowerCase();
    const matches = required.filter((req) => providedLower.includes(req.toLowerCase()));
    return matches.length / required.length;
  }

  // ========================================================================
  // AVATAR PROGRESSION
  // ========================================================================

  /**
   * Check if user has unlocked a new accessory.
   */
  checkAccessoryUnlock(
    accessory: AvatarAccessory,
    userStats: {
      masteryScores: Record<string, number>;
      studyStreak: number;
      achievements: string[];
    }
  ): boolean {
    const req = accessory.requirement;

    switch (req.type) {
      case 'mastery': {
        const masteryScore = userStats.masteryScores[req.target] ?? 0;
        return masteryScore >= req.threshold;
      }

      case 'streak':
        return userStats.studyStreak >= req.threshold;

      case 'achievement':
        return userStats.achievements.includes(req.target);

      case 'completion':
        return true; // Check completion status from DB

      default:
        return false;
    }
  }

  /**
   * Generate user avatar SVG.
   */
  async generateAvatarSVG(avatar: UserAvatar): Promise<string> {
    // Build prompt for svg_generator
    const prompt = `Generate a medical professional avatar:
- Base: Student in ${avatar.stage.replace('_', ' ')}
- Accessories: ${avatar.equippedAccessories.map((a) => a.name).join(', ')}
- Style: Clean, professional, medical education theme
- Format: SVG, 200x200px`;

    try {
      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/svg-generator:generate',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.geminiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt,
            style: 'medical_professional',
            size: '200x200',
          }),
        }
      );

      const data = await response.json();
      return data.svg || avatar.baseSvg;
    } catch (error) {
      console.error('Avatar SVG generation error:', error);
      return avatar.baseSvg;
    }
  }

  /**
   * Generate achievement badge SVG.
   */
  async generateBadgeSVG(badge: AchievementBadge): Promise<string> {
    const prompt = `Generate an achievement badge SVG:
Badge Name: ${badge.name}
Description: ${badge.description}
Rarity: ${badge.rarity}
Category: ${badge.category}

Style: Medical education theme, ${badge.rarity === 'legendary' ? 'gold' : badge.rarity === 'epic' ? 'purple' : 'blue'} color scheme`;

    try {
      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/svg-generator:generate',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.geminiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt,
            style: 'badge',
            size: '128x128',
          }),
        }
      );

      const data = await response.json();
      return data.svg || '';
    } catch (error) {
      console.error('Badge SVG generation error:', error);
      return '';
    }
  }
}

/**
 * Factory function.
 */
export function createGamificationService(
  geminiApiKey: string,
  veoApiKey: string
): GamificationService {
  return new GamificationService({ geminiApiKey, veoApiKey });
}
