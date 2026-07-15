/**
 * Idempotent learner reminders via KV.
 * Does not send push notifications in v1 — schedules metadata for cron/worker pickup.
 */

import type { LearnerReminderInput, LearnerReminderResult } from './types';

const KV_PREFIX = 'learner-reminder:';

export interface ReminderKv {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export async function createReminder(
  kv: ReminderKv,
  userId: string,
  reminder: LearnerReminderInput
): Promise<LearnerReminderResult> {
  const key = `${KV_PREFIX}${userId}:${reminder.reminderId}`;
  const existing = await kv.get(key);
  if (existing) {
    const parsed = JSON.parse(existing) as { scheduledAt: string };
    return {
      reminderId: reminder.reminderId,
      scheduledAt: parsed.scheduledAt,
      idempotent: true,
    };
  }

  const payload = {
    userId,
    message: reminder.message,
    scheduledAt: reminder.scheduledAt,
    category: reminder.category,
    createdAt: new Date().toISOString(),
  };

  const scheduled = new Date(reminder.scheduledAt);
  const ttlSeconds = Math.max(
    3600,
    Math.floor((scheduled.getTime() - Date.now()) / 1000) + 7 * 24 * 3600
  );

  await kv.put(key, JSON.stringify(payload), { expirationTtl: ttlSeconds });

  return {
    reminderId: reminder.reminderId,
    scheduledAt: reminder.scheduledAt,
    idempotent: false,
  };
}

export async function listReminders(kv: ReminderKv, userId: string): Promise<LearnerReminderInput[]> {
  // KV has no prefix list in Workers without Durable Object index — return empty for v1 API;
  // worker agent maintains schedule index in DO SQLite.
  void kv;
  void userId;
  return [];
}
