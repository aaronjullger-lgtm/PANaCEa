/**
 * Grand Rounds Service
 * 
 * Manages daily competitive challenge system:
 * - Daily question seed rotation
 * - Score tracking with time bonus
 * - Global leaderboard ranking
 */

import type { Question } from '../types';

export interface GrandRoundsChallenge {
  id: string;
  date: Date;
  questionIds: string[];
  seed: number;
}

export interface GrandRoundsHistory {
  id: string;
  userId: string;
  date: Date;
  score: number;
  completionTimeMs: number;
  rank: number | null;
  correctAnswers: number;
  timeBonus: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  score: number;
  completionTimeMs: number;
  correctAnswers: number;
}

/**
 * Get or create today's Grand Rounds challenge
 */
export async function getTodaysChallenge(): Promise<GrandRoundsChallenge> {
  try {
    const response = await fetch('/api/grandrounds/challenge', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch challenge');
    }
    
    const data = await response.json();
    return data.challenge;
  } catch (error) {
    console.error('Error fetching Grand Rounds challenge:', error);
    throw error;
  }
}

/**
 * Check if user has completed today's challenge
 */
export async function hasCompletedToday(userId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/grandrounds/completed?userId=${userId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      return false;
    }
    
    const data = await response.json();
    return data.completed;
  } catch (error) {
    console.error('Error checking completion status:', error);
    return false;
  }
}

/**
 * Calculate time bonus for speed-weighted scoring
 * @param completionTimeMs Time taken in milliseconds
 * @returns Time bonus points (0-200)
 */
function calculateTimeBonus(completionTimeMs: number): number {
  const maxTimeSeconds = 300; // 5 minutes
  const timeSeconds = completionTimeMs / 1000;
  return Math.max(0, Math.floor((1 - (timeSeconds / maxTimeSeconds)) * 200));
}

/**
 * Submit Grand Rounds completion
 * @param userId User ID
 * @param score Total points earned (before time bonus)
 * @param completionTimeMs Time taken in milliseconds
 * @param correctAnswers Number of correct answers (out of 5)
 * @returns The user's rank for the day
 */
export async function submitCompletion(
  userId: string,
  score: number,
  completionTimeMs: number,
  correctAnswers: number
): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Calculate time bonus using shared helper
  const timeBonus = calculateTimeBonus(completionTimeMs);
  
  try {
    const response = await fetch('/api/grandrounds/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        date: today.toISOString(),
        score: score + timeBonus,
        completionTimeMs,
        correctAnswers,
        timeBonus
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to submit completion');
    }
    
    const data = await response.json();
    return data.rank;
  } catch (error) {
    console.error('Error submitting Grand Rounds completion:', error);
    throw error;
  }
}

/**
 * Get today's leaderboard
 * @param limit Number of entries to return (default 100)
 */
export async function getTodaysLeaderboard(limit: number = 100): Promise<LeaderboardEntry[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  try {
    const response = await fetch(`/api/grandrounds/leaderboard?date=${today.toISOString()}&limit=${limit}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch leaderboard');
    }
    
    const data = await response.json();
    return data.leaderboard;
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return [];
  }
}

/**
 * Get user's rank for today
 */
export async function getUserRank(userId: string): Promise<number | null> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  try {
    const response = await fetch(`/api/grandrounds/rank?userId=${userId}&date=${today.toISOString()}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    return data.rank;
  } catch (error) {
    console.error('Error fetching user rank:', error);
    return null;
  }
}

/**
 * Calculate speed-weighted score
 * @param correctAnswers Array of booleans (true if answer was correct)
 * @param totalTime Time taken in milliseconds
 * @param questionPoints Array of point values for each question
 */
export function calculateScore(
  correctAnswers: boolean[],
  totalTime: number,
  questionPoints: number[]
): { score: number; timeBonus: number } {
  // Base score from correct answers
  const baseScore = correctAnswers.reduce((sum, isCorrect, index) => {
    return sum + (isCorrect ? questionPoints[index] : 0);
  }, 0);
  
  // Time bonus using shared helper
  const timeBonus = calculateTimeBonus(totalTime);
  
  return {
    score: baseScore + timeBonus,
    timeBonus
  };
}

/**
 * Fetch questions by IDs
 * @param questionIds Array of question IDs
 */
export async function fetchQuestionsByIds(questionIds: string[]): Promise<Question[]> {
  try {
    const response = await fetch('/api/questions/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: questionIds })
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch questions');
    }
    
    const data = await response.json();
    return data.questions;
  } catch (error) {
    console.error('Error fetching questions:', error);
    // Fallback to mock questions if API fails
    return questionIds.map((id, i) => ({
      id,
      question: `Fallback Question ${i + 1}`,
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswer: 'Option A',
      explanation: 'Failed to load question content.',
      system: 'General',
      difficulty: 'medium',
      type: 'mcq'
    }));
  }
}
