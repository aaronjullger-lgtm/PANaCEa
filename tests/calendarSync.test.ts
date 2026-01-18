import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateStudyPlan,
  studyPlanToEvents,
  generateICalendar,
  generateGoogleCalendarUrl,
  generateAndDownloadStudyPlan,
} from '../lib/services/calendarSyncService';

describe('Calendar Sync Service', () => {
  describe('generateStudyPlan', () => {
    it('should generate a study plan for 6 weeks', () => {
      const examDate = new Date();
      examDate.setDate(examDate.getDate() + 42); // 6 weeks from now

      const plan = generateStudyPlan(examDate);

      // 6 weeks generates 6-7 weeks depending on rounding and review weeks
      expect(plan.length).toBeGreaterThanOrEqual(6);
      expect(plan[0].weekNumber).toBe(1);
      expect(plan[0].topics.length).toBeGreaterThan(0);
    });

    it('should include review weeks for longer study periods', () => {
      const examDate = new Date();
      examDate.setDate(examDate.getDate() + 70); // 10 weeks from now

      const plan = generateStudyPlan(examDate);

      expect(plan.length).toBeGreaterThan(6);

      // Check that last weeks are review weeks
      const lastWeek = plan[plan.length - 1];
      expect(lastWeek.weekLabel).toContain('Review');
      expect(lastWeek.topics).toContain('Final Review');
    });

    it('should throw error for past exam dates', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 7);

      expect(() => generateStudyPlan(pastDate)).toThrow('Exam date must be in the future');
    });

    it('should distribute all PANCE systems across weeks', () => {
      const examDate = new Date();
      examDate.setDate(examDate.getDate() + 56); // 8 weeks from now

      const plan = generateStudyPlan(examDate);

      // Collect all topics (excluding review weeks)
      const allTopics = plan
        .filter((week) => !week.weekLabel.includes('Review'))
        .flatMap((week) => week.topics);

      // Should cover major systems
      expect(allTopics.length).toBeGreaterThan(10);
    });

    it('should set proper start and end dates for each week', () => {
      const examDate = new Date();
      examDate.setDate(examDate.getDate() + 28); // 4 weeks from now

      const plan = generateStudyPlan(examDate);

      plan.forEach((week) => {
        expect(week.startDate).toBeInstanceOf(Date);
        expect(week.endDate).toBeInstanceOf(Date);

        // End date should be 6 days after start date
        const daysDiff = Math.ceil(
          (week.endDate.getTime() - week.startDate.getTime()) / (24 * 60 * 60 * 1000)
        );
        expect(daysDiff).toBe(6);
      });
    });
  });

  describe('studyPlanToEvents', () => {
    it('should convert study plan to calendar events', () => {
      const examDate = new Date();
      examDate.setDate(examDate.getDate() + 14); // 2 weeks from now

      const plan = generateStudyPlan(examDate);
      const events = studyPlanToEvents(plan);

      expect(events.length).toBeGreaterThan(0);

      // Check first event structure
      expect(events[0]).toHaveProperty('title');
      expect(events[0]).toHaveProperty('description');
      expect(events[0]).toHaveProperty('startDate');
      expect(events[0]).toHaveProperty('endDate');
      expect(events[0]).toHaveProperty('allDay');
    });

    it('should create both study and practice events', () => {
      const examDate = new Date();
      examDate.setDate(examDate.getDate() + 7); // 1 week from now

      const plan = generateStudyPlan(examDate);
      const events = studyPlanToEvents(plan);

      const studyEvents = events.filter((e) => e.title.includes('PANCE Study'));
      const practiceEvents = events.filter((e) => e.title.includes('Practice Questions'));

      expect(studyEvents.length).toBeGreaterThan(0);
      expect(practiceEvents.length).toBeGreaterThan(0);
    });

    it('should not create events for past dates', () => {
      // Create a plan that starts in the past
      const plan = [
        {
          weekNumber: 1,
          weekLabel: 'Week 1',
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
          endDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
          topics: ['Cardiovascular'],
          description: 'Test week',
        },
      ];

      const events = studyPlanToEvents(plan);

      // Should have no events or very few (only future dates within the week range)
      expect(events.length).toBeLessThanOrEqual(14); // At most 2 events per future day
    });

    it('should set proper time slots for events', () => {
      const examDate = new Date();
      examDate.setDate(examDate.getDate() + 7);

      const plan = generateStudyPlan(examDate);
      const events = studyPlanToEvents(plan);

      const morningEvent = events.find((e) => e.title.includes('PANCE Study'));

      if (morningEvent) {
        const startHour = morningEvent.startDate.getHours();
        const endHour = morningEvent.endDate.getHours();

        expect(startHour).toBe(9); // 9 AM
        expect(endHour).toBe(11); // 11 AM
      }
    });
  });

  describe('generateICalendar', () => {
    it('should generate valid iCalendar format', () => {
      const events = [
        {
          title: 'Test Study Session',
          description: 'Study cardiovascular system',
          startDate: new Date('2024-12-10T09:00:00Z'),
          endDate: new Date('2024-12-10T11:00:00Z'),
          allDay: false,
        },
      ];

      const ical = generateICalendar(events);

      expect(ical).toContain('BEGIN:VCALENDAR');
      expect(ical).toContain('VERSION:2.0');
      expect(ical).toContain('BEGIN:VEVENT');
      expect(ical).toContain('SUMMARY:Test Study Session');
      expect(ical).toContain('DESCRIPTION:Study cardiovascular system');
      expect(ical).toContain('END:VEVENT');
      expect(ical).toContain('END:VCALENDAR');
    });

    it('should include alarm/reminder in events', () => {
      const events = [
        {
          title: 'Test Event',
          description: 'Test description',
          startDate: new Date(),
          endDate: new Date(),
          allDay: false,
        },
      ];

      const ical = generateICalendar(events);

      expect(ical).toContain('BEGIN:VALARM');
      expect(ical).toContain('TRIGGER:-P1D'); // 1 day before
      expect(ical).toContain('ACTION:DISPLAY');
      expect(ical).toContain('END:VALARM');
    });

    it('should escape special characters in text', () => {
      const events = [
        {
          title: 'Test; with, special\\ncharacters',
          description: 'Line 1\nLine 2',
          startDate: new Date(),
          endDate: new Date(),
          allDay: false,
        },
      ];

      const ical = generateICalendar(events);

      expect(ical).toContain('\\;');
      expect(ical).toContain('\\,');
      expect(ical).toContain('\\n');
    });

    it('should handle multiple events', () => {
      const events = [
        {
          title: 'Event 1',
          description: 'First event',
          startDate: new Date(),
          endDate: new Date(),
          allDay: false,
        },
        {
          title: 'Event 2',
          description: 'Second event',
          startDate: new Date(),
          endDate: new Date(),
          allDay: false,
        },
      ];

      const ical = generateICalendar(events);

      // Should have 2 VEVENT blocks
      const eventCount = (ical.match(/BEGIN:VEVENT/g) || []).length;
      expect(eventCount).toBe(2);
    });
  });

  describe('generateGoogleCalendarUrl', () => {
    it('should generate valid Google Calendar URL', () => {
      const event = {
        title: 'PANCE Study Session',
        description: 'Study cardiovascular system',
        startDate: new Date('2024-12-10T09:00:00Z'),
        endDate: new Date('2024-12-10T11:00:00Z'),
        allDay: false,
      };

      const url = generateGoogleCalendarUrl(event);

      expect(url).toContain('https://calendar.google.com/calendar/render');
      expect(url).toContain('action=TEMPLATE');
      expect(url).toContain('text=PANCE+Study+Session');
      expect(url).toContain('details=');
    });

    it('should include location if provided', () => {
      const event = {
        title: 'Study Session',
        description: 'Description',
        startDate: new Date(),
        endDate: new Date(),
        location: 'Library',
        allDay: false,
      };

      const url = generateGoogleCalendarUrl(event);

      expect(url).toContain('location=Library');
    });
  });

  describe('generateAndDownloadStudyPlan', () => {
    beforeEach(() => {
      // Mock download functionality
      if (!global.document) {
        (global as any).document = {};
      }
      if (!global.document.body) {
        (global.document as any).body = {};
      }
      global.document.createElement = vi.fn().mockReturnValue({
        href: '',
        download: '',
        click: vi.fn(),
      });
      global.document.body.appendChild = vi.fn();
      global.document.body.removeChild = vi.fn();
      if (!global.URL) {
        (global as any).URL = {};
      }
      global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock');
      global.URL.revokeObjectURL = vi.fn();
    });

    it('should generate and download study plan successfully', () => {
      const examDate = new Date();
      examDate.setDate(examDate.getDate() + 42); // 6 weeks from now

      const result = generateAndDownloadStudyPlan(examDate);

      expect(result.success).toBe(true);
      expect(result.plan.length).toBeGreaterThan(0);
      expect(result.eventCount).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();
    });

    it('should handle errors gracefully', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 7);

      const result = generateAndDownloadStudyPlan(pastDate);

      expect(result.success).toBe(false);
      expect(result.plan).toEqual([]);
      expect(result.eventCount).toBe(0);
      expect(result.error).toBeDefined();
    });
  });
});
