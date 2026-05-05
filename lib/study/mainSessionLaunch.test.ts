import { describe, expect, it } from 'vitest';
import { buildMainSessionLaunchPath, parseMainSessionLaunch } from './mainSessionLaunch';
import type { PendingStudyPlanSessionIntent } from '@/lib/studyPlanIntent';

describe('parseMainSessionLaunch', () => {
  it('recovers matching study-plan launch settings from pending intent', () => {
    const pendingIntent: PendingStudyPlanSessionIntent = {
      context: {
        planDate: '2026-05-01',
        taskId: 'task-targeted',
        taskTitle: 'Pulmonary repair block',
      },
      settings: {
        mode: 'targeted',
        focus: 'topic',
        topic: 'Pulmonary Embolism',
        count: 12,
        questionCount: 12,
        systems: ['Pulmonary'],
        conditionId: 'pe',
        conditionName: 'Pulmonary Embolism',
      },
    };

    const launch = parseMainSessionLaunch(
      '?source=study-plan&taskId=task-targeted&planDate=2026-05-01',
      pendingIntent
    );

    expect(launch.scope).toEqual(
      expect.objectContaining({
        mode: 'condition',
        size: 12,
        system: 'Pulmonary',
        systems: ['Pulmonary'],
        conditionId: 'pe',
        conditionName: 'Pulmonary Embolism',
      })
    );
    expect(launch.settings).toEqual(
      expect.objectContaining({
        mode: 'targeted',
        focus: 'topic',
        topic: 'Pulmonary Embolism',
        conditionId: 'pe',
        conditionName: 'Pulmonary Embolism',
        count: 12,
        questionCount: 12,
      })
    );
  });

  it('keeps true review launches in review focus when query params are the only source', () => {
    const launch = parseMainSessionLaunch(
      '?source=study-plan&taskId=review-task&planDate=2026-05-01&mode=review&count=8',
      null
    );

    expect(launch.scope).toEqual(
      expect.objectContaining({
        mode: 'adaptive',
        size: 8,
      })
    );
    expect(launch.settings).toEqual(
      expect.objectContaining({
        mode: 'review',
        focus: 'review',
        count: 8,
        questionCount: 8,
      })
    );
  });

  it('does not parse condition mode without condition identity as a condition scope', () => {
    const launch = parseMainSessionLaunch(
      '?source=study-plan&taskId=targeted-system&planDate=2026-05-01&mode=condition&systems=Pulmonary&count=12',
      null
    );

    expect(launch.scope).toEqual(
      expect.objectContaining({
        mode: 'system',
        size: 12,
        system: 'Pulmonary',
        systems: ['Pulmonary'],
      })
    );
    expect(launch.scope.conditionId).toBeUndefined();
  });

  it('ignores stale pending intents from another task', () => {
    const pendingIntent: PendingStudyPlanSessionIntent = {
      context: {
        planDate: '2026-05-01',
        taskId: 'old-task',
        taskTitle: 'Old task',
      },
      settings: {
        mode: 'targeted',
        focus: 'topic',
        count: 30,
        questionCount: 30,
        conditionId: 'stale-condition',
      },
    };

    const launch = parseMainSessionLaunch(
      '?source=study-plan&taskId=new-task&planDate=2026-05-01&mode=system&systems=Cardiology&count=10',
      pendingIntent
    );

    expect(launch.scope).toEqual(
      expect.objectContaining({
        mode: 'system',
        size: 10,
        system: 'Cardiology',
        systems: ['Cardiology'],
      })
    );
    expect(launch.scope.conditionId).toBeUndefined();
    expect(launch.settings).toEqual(
      expect.objectContaining({
        mode: 'targeted',
        focus: 'topic',
        count: 10,
        systems: ['Cardiology'],
      })
    );
  });

  it('builds canonical main-session URLs from visible CTA settings', () => {
    expect(
      buildMainSessionLaunchPath(
        {
          mode: 'targeted',
          focus: 'topic',
          count: 20,
          systems: ['Pulmonary'],
        },
        { source: 'mode-library' }
      )
    ).toBe('/study/main-session?source=mode-library&mode=system&count=20&systems=Pulmonary');

    expect(
      buildMainSessionLaunchPath({
        mode: 'review',
        focus: 'review',
        count: 8,
      })
    ).toBe('/study/main-session?source=manual&mode=review&count=8');
  });
});
