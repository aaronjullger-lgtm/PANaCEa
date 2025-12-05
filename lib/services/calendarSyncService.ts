/**
 * Calendar Sync Service
 * 
 * Generates study plans based on exam dates and creates calendar events
 * for Google Calendar, Outlook, and Apple Calendar (iCal format).
 */

export interface StudyPlan {
  weekNumber: number;
  weekLabel: string;
  startDate: Date;
  endDate: Date;
  topics: string[];
  description: string;
}

export interface CalendarEvent {
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  allDay: boolean;
}

const PANCE_SYSTEMS = [
  { code: 'CV', name: 'Cardiovascular' },
  { code: 'PULM', name: 'Pulmonary' },
  { code: 'GI', name: 'Gastroenterology' },
  { code: 'ENDO', name: 'Endocrinology' },
  { code: 'NEURO', name: 'Neurology' },
  { code: 'MSK', name: 'Musculoskeletal' },
  { code: 'DERM', name: 'Dermatology' },
  { code: 'HEENT', name: 'Head, Eyes, Ears, Nose, Throat' },
  { code: 'RENAL', name: 'Renal/Urinary' },
  { code: 'HEME', name: 'Hematology' },
  { code: 'ID', name: 'Infectious Disease' },
  { code: 'PSYCH', name: 'Psychiatry' },
  { code: 'REPRO', name: 'Reproductive' },
  { code: 'GU', name: 'Genitourinary' },
];

/**
 * Generate a study plan based on exam date
 * Distributes PANCE systems across available weeks
 */
const MILLISECONDS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

export function generateStudyPlan(examDate: Date): StudyPlan[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const weeksUntilExam = Math.ceil((examDate.getTime() - today.getTime()) / MILLISECONDS_PER_WEEK);
  
  if (weeksUntilExam <= 0) {
    throw new Error('Exam date must be in the future');
  }

  const plan: StudyPlan[] = [];
  
  // Reserve last 2 weeks for review if there are more than 4 weeks
  const studyWeeks = weeksUntilExam > 4 ? weeksUntilExam - 2 : weeksUntilExam;
  const hasReviewWeeks = weeksUntilExam > 4;
  
  // Distribute systems across study weeks
  const systemsPerWeek = Math.ceil(PANCE_SYSTEMS.length / studyWeeks);
  
  for (let week = 0; week < studyWeeks; week++) {
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() + (week * 7));
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const startIndex = week * systemsPerWeek;
    const endIndex = Math.min(startIndex + systemsPerWeek, PANCE_SYSTEMS.length);
    const weekSystems = PANCE_SYSTEMS.slice(startIndex, endIndex);
    
    plan.push({
      weekNumber: week + 1,
      weekLabel: `Week ${week + 1}`,
      startDate: weekStart,
      endDate: weekEnd,
      topics: weekSystems.map(s => s.name),
      description: `Focus: ${weekSystems.map(s => s.name).join(', ')}`,
    });
  }
  
  // Add review weeks if applicable
  if (hasReviewWeeks) {
    const reviewStart = studyWeeks;
    
    for (let week = 0; week < 2; week++) {
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() + ((reviewStart + week) * 7));
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      const isFirstReview = week === 0;
      const topics = isFirstReview 
        ? ['Weak Areas Review', 'Practice Exams']
        : ['Final Review', 'High-Yield Topics', 'Practice Exams'];
      
      plan.push({
        weekNumber: reviewStart + week + 1,
        weekLabel: `Week ${reviewStart + week + 1} (Review)`,
        startDate: weekStart,
        endDate: weekEnd,
        topics: topics,
        description: isFirstReview 
          ? 'Review weak areas identified from practice questions'
          : 'Final comprehensive review and practice exams',
      });
    }
  }
  
  return plan;
}

/**
 * Convert study plan to calendar events
 */
export function studyPlanToEvents(plan: StudyPlan[]): CalendarEvent[] {
  return plan.flatMap(week => {
    // Create daily study blocks
    const events: CalendarEvent[] = [];
    
    for (let day = 0; day < 7; day++) {
      const eventDate = new Date(week.startDate);
      eventDate.setDate(eventDate.getDate() + day);
      
      // Skip if date is in the past
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (eventDate < today) continue;
      
      const dayName = eventDate.toLocaleDateString('en-US', { weekday: 'long' });
      
      // Study session (2 hours in morning)
      const morningStart = new Date(eventDate);
      morningStart.setHours(9, 0, 0, 0);
      const morningEnd = new Date(eventDate);
      morningEnd.setHours(11, 0, 0, 0);
      
      events.push({
        title: `PANCE Study: ${week.topics[0] || 'Review'}`,
        description: `${week.weekLabel} - ${dayName}\n\n${week.description}\n\nDaily study session focusing on ${week.topics.join(', ')}`,
        startDate: morningStart,
        endDate: morningEnd,
        allDay: false,
      });
      
      // Practice questions (1 hour in afternoon) - only on weekdays
      if (day < 5) {
        const afternoonStart = new Date(eventDate);
        afternoonStart.setHours(16, 0, 0, 0);
        const afternoonEnd = new Date(eventDate);
        afternoonEnd.setHours(17, 0, 0, 0);
        
        events.push({
          title: `PANCE Practice Questions`,
          description: `${week.weekLabel} - ${dayName}\n\nPractice questions for ${week.topics.join(', ')}`,
          startDate: afternoonStart,
          endDate: afternoonEnd,
          allDay: false,
        });
      }
    }
    
    return events;
  });
}

/**
 * Format date for iCalendar format (YYYYMMDDTHHMMSSZ)
 */
function formatICalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/**
 * Escape special characters for iCalendar format
 */
function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Generate iCalendar (.ics) file content
 * Compatible with Google Calendar, Outlook, and Apple Calendar
 */
export function generateICalendar(events: CalendarEvent[]): string {
  let ical = 'BEGIN:VCALENDAR\r\n';
  ical += 'VERSION:2.0\r\n';
  ical += 'PRODID:-//PANaCEa//Study Planner//EN\r\n';
  ical += 'CALSCALE:GREGORIAN\r\n';
  ical += 'METHOD:PUBLISH\r\n';
  ical += 'X-WR-CALNAME:PANaCEa Study Plan\r\n';
  ical += 'X-WR-TIMEZONE:America/New_York\r\n';
  ical += 'X-WR-CALDESC:Personalized PANCE study schedule\r\n';
  
  events.forEach((event, index) => {
    ical += 'BEGIN:VEVENT\r\n';
    ical += `UID:panacea-study-${Date.now()}-${index}@panacea.app\r\n`;
    ical += `DTSTAMP:${formatICalDate(new Date())}\r\n`;
    ical += `DTSTART:${formatICalDate(event.startDate)}\r\n`;
    ical += `DTEND:${formatICalDate(event.endDate)}\r\n`;
    ical += `SUMMARY:${escapeICalText(event.title)}\r\n`;
    ical += `DESCRIPTION:${escapeICalText(event.description)}\r\n`;
    
    if (event.location) {
      ical += `LOCATION:${escapeICalText(event.location)}\r\n`;
    }
    
    // Add alarm (reminder 1 day before)
    ical += 'BEGIN:VALARM\r\n';
    ical += 'TRIGGER:-P1D\r\n';
    ical += 'ACTION:DISPLAY\r\n';
    ical += `DESCRIPTION:Reminder: ${escapeICalText(event.title)}\r\n`;
    ical += 'END:VALARM\r\n';
    
    ical += 'END:VEVENT\r\n';
  });
  
  ical += 'END:VCALENDAR\r\n';
  
  return ical;
}

/**
 * Generate Google Calendar URL for adding events
 */
export function generateGoogleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    details: event.description,
    dates: `${formatICalDate(event.startDate)}/${formatICalDate(event.endDate)}`,
  });
  
  if (event.location) {
    params.append('location', event.location);
  }
  
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Download iCalendar file
 */
export function downloadICalendar(icalContent: string, filename: string = 'panacea-study-plan.ics') {
  const blob = new Blob([icalContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Main function to generate and download study plan calendar
 */
export function generateAndDownloadStudyPlan(examDate: Date): {
  success: boolean;
  plan: StudyPlan[];
  eventCount: number;
  error?: string;
} {
  try {
    const plan = generateStudyPlan(examDate);
    const events = studyPlanToEvents(plan);
    const icalContent = generateICalendar(events);
    
    downloadICalendar(icalContent);
    
    return {
      success: true,
      plan,
      eventCount: events.length,
    };
  } catch (error) {
    return {
      success: false,
      plan: [],
      eventCount: 0,
      error: error instanceof Error ? error.message : 'Failed to generate study plan',
    };
  }
}
