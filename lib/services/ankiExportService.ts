/**
 * Anki Export Service
 *
 * Provides functionality to export questions to Anki format.
 * Supports "Sync Missed" - exports only questions the user got wrong today.
 */

import type { Question, PerformanceRecord } from '../../types';

export interface AnkiCard {
  front: string;
  back: string;
  tags: string[];
  guid?: string; // Optional unique identifier for the card
}

export interface AnkiExportOptions {
  deckName?: string;
  includeRationale?: boolean;
  includePearls?: boolean;
  tagWithSystem?: boolean;
  tagWithCondition?: boolean;
}

/**
 * Get questions that were answered incorrectly today
 */
export function getMissedQuestionsToday(
  performanceData: PerformanceRecord[],
  missedQuestions: Question[]
): Question[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTimestamp = today.getTime();

  // Get question IDs that were answered incorrectly today
  // Use conditionId as primary identifier, falling back to condition name for legacy data
  const missedTodayIds = new Set(
    performanceData
      .filter((record) => {
        const recordDate = new Date(Number(record.timestamp));
        recordDate.setHours(0, 0, 0, 0);
        return !record.isCorrect && recordDate.getTime() === todayTimestamp;
      })
      .map((record) => record.conditionId || record.condition || record.topic)
  );

  // Filter missed questions to only include today's mistakes
  // Match by conditionId first, then fall back to condition name
  return missedQuestions.filter(
    (question) =>
      missedTodayIds.has(question.conditionId) ||
      missedTodayIds.has(question.condition) ||
      missedTodayIds.has(question.topic)
  );
}

/**
 * Convert a question to an Anki card format
 */
export function questionToAnkiCard(question: Question, options: AnkiExportOptions = {}): AnkiCard {
  const {
    includeRationale = true,
    includePearls = true,
    tagWithSystem = true,
    tagWithCondition = true,
  } = options;

  // Build the front of the card (the question)
  const optionsText = question.options
    .map((opt, idx) => `${String.fromCharCode(65 + idx)}) ${opt}`)
    .join('\n');

  const front = `${question.question}\n\n${optionsText}`;

  // Build the back of the card (answer + explanation)
  const correctLetter = String.fromCharCode(65 + question.correctAnswerIndex);
  const correctAnswer = question.options[question.correctAnswerIndex];

  let back = `<strong>Answer: ${correctLetter}) ${correctAnswer}</strong>`;

  if (includeRationale && question.rationale) {
    back += `\n\n<strong>Explanation:</strong>\n${question.rationale}`;
  }

  if (includePearls && question.pearls && question.pearls.length > 0) {
    back += '\n\n<strong>Key Pearls:</strong>\n';
    back += question.pearls.map((pearl) => `• ${pearl}`).join('\n');
  }

  // Build tags
  const tags: string[] = ['PANaCEa', 'PANCE'];

  if (tagWithSystem && question.system) {
    tags.push(question.system);
  }

  if (tagWithCondition && question.condition) {
    // Sanitize condition name for tag (remove special chars, spaces to underscores)
    const conditionTag = question.condition.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
    tags.push(conditionTag);
  }

  if (question.subcategory) {
    const subcategoryTag = question.subcategory.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
    tags.push(subcategoryTag);
  }

  // Use conditionId as GUID for deduplication
  const guid = question.conditionId || undefined;

  return {
    front,
    back,
    tags,
    guid,
  };
}

/**
 * Convert questions to Anki deck format (.txt format)
 * This format can be imported directly into Anki
 */
export function exportToAnkiText(questions: Question[], options: AnkiExportOptions = {}): string {
  const deckName = options.deckName || 'PANaCEa_Missed_Questions';

  let output = `#separator:tab\n`;
  output += `#html:true\n`;
  output += `#deck:${deckName}\n`;
  output += `#tags column:3\n\n`;

  questions.forEach((question) => {
    const card = questionToAnkiCard(question, options);

    // Format: Front\tBack\tTags
    const front = card.front.replace(/\n/g, '<br>');
    const back = card.back.replace(/\n/g, '<br>');
    const tags = card.tags.join(' ');

    output += `${front}\t${back}\t${tags}\n`;
  });

  return output;
}

/**
 * Convert questions to JSON format for AnkiConnect API
 * AnkiConnect is a popular Anki plugin that allows external programs to interact with Anki
 */
export function exportToAnkiConnect(
  questions: Question[],
  options: AnkiExportOptions = {}
): object {
  const deckName = options.deckName || 'PANaCEa_Missed_Questions';

  const notes = questions.map((question) => {
    const card = questionToAnkiCard(question, options);

    return {
      deckName: deckName,
      modelName: 'Basic',
      fields: {
        Front: card.front.replace(/\n/g, '<br>'),
        Back: card.back.replace(/\n/g, '<br>'),
      },
      tags: card.tags,
      options: {
        allowDuplicate: false,
        duplicateScope: 'deck',
      },
    };
  });

  return {
    action: 'addNotes',
    version: 6,
    params: {
      notes,
    },
  };
}

/**
 * Download a file in the browser
 */
export function downloadFile(content: string, filename: string, mimeType: string = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
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
 * Export missed questions from today to Anki format and download
 */
export function exportMissedTodayToAnki(
  performanceData: PerformanceRecord[],
  missedQuestions: Question[],
  options: AnkiExportOptions = {}
): { success: boolean; count: number; error?: string } {
  try {
    const missedToday = getMissedQuestionsToday(performanceData, missedQuestions);

    if (missedToday.length === 0) {
      return {
        success: false,
        count: 0,
        error: 'No questions were missed today',
      };
    }

    const ankiText = exportToAnkiText(missedToday, options);
    const filename = `panacea_missed_${new Date().toISOString().split('T')[0]}.txt`;

    downloadFile(ankiText, filename);

    return {
      success: true,
      count: missedToday.length,
    };
  } catch (error) {
    return {
      success: false,
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
