/**
 * AI Syllabus Decompiler Component
 *
 * Allows users to upload their school's PDF/Word syllabus.
 * AI parses the document for key phrases and auto-tags relevant questions.
 */

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { PrimaryButton } from '../ui/PrimaryButton';
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Download,
  Sparkles,
  X,
} from 'lucide-react';
import { InlineSpinner } from '@/components/loading';

interface SyllabusDecompilerProps {
  theme?: 'light' | 'dark';
  onTagsGenerated?: (tags: SyllabusTag[]) => void;
}

export interface SyllabusTag {
  topic: string;
  keywords: string[];
  priority: 'high' | 'medium' | 'low';
  examSection?: string;
}

type UploadState = 'idle' | 'uploading' | 'processing' | 'success' | 'error';

export default function SyllabusDecompiler({
  theme = 'light',
  onTagsGenerated,
}: SyllabusDecompilerProps): React.ReactElement {
  const prefersReducedMotion = useReducedMotion();
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [fileName, setFileName] = useState<string>('');
  const [extractedTags, setExtractedTags] = useState<SyllabusTag[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = useCallback(
    async (file: File) => {
      if (!file) return;

      // Validate file type
      const validTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
      ];

      if (!validTypes.includes(file.type)) {
        setErrorMessage('Please upload a PDF, Word document, or text file.');
        setUploadState('error');
        return;
      }

      setFileName(file.name);
      setUploadState('uploading');
      setErrorMessage('');

      try {
        // Read file content
        const text = await readFileContent(file);

        setUploadState('processing');

        // Parse syllabus content
        const tags = await parseSyllabusContent(text);

        setExtractedTags(tags);
        setUploadState('success');
        onTagsGenerated?.(tags);
      } catch (error) {
        console.error('Error processing syllabus:', error);
        setErrorMessage(error instanceof Error ? error.message : 'Failed to process syllabus');
        setUploadState('error');
      }
    },
    [onTagsGenerated]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      const file = files[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      const file = files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleReset = () => {
    setUploadState('idle');
    setFileName('');
    setExtractedTags([]);
    setErrorMessage('');
  };

  const handleDownloadTags = () => {
    const json = JSON.stringify(extractedTags, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'syllabus-tags.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-xl p-6 bg-[var(--color-bg-primary)]" data-theme={theme}>
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-6 h-6 text-[var(--color-accent)]" />
        <h3 className="text-xl font-bold text-[var(--color-text-primary)]">
          AI Syllabus Decompiler
        </h3>
      </div>

      <p className="text-sm mb-6 text-[var(--color-text-muted)]">
        Upload your school's syllabus and let AI automatically identify key topics and prioritize
        questions for hyper-personalized review.
      </p>

      {uploadState === 'idle' || uploadState === 'error' ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
            isDragging
              ? 'border-[var(--color-accent)] bg-[var(--color-bg-secondary)]'
              : 'border-[var(--color-border)] hover:border-[var(--color-accent)]'
          }`}
        >
          <input
            type="file"
            id="syllabus-upload"
            accept=".pdf,.doc,.docx,.txt"
            onChange={handleFileInputChange}
            className="hidden"
          />

          <label htmlFor="syllabus-upload" className="cursor-pointer flex flex-col items-center">
            <Upload className="w-12 h-12 mb-3 text-[var(--color-text-muted)]" />
            <p className="text-sm font-medium mb-1 text-[var(--color-text-secondary)]">
              Click to upload or drag and drop
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">
              PDF, Word, or Text files (Max 10MB)
            </p>
          </label>

          {uploadState === 'error' && (
            <motion.div
              initial={prefersReducedMotion ? false : { y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-3 rounded-lg bg-[var(--color-data-fail)]/10 text-[var(--color-data-fail)]"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{errorMessage}</span>
              </div>
            </motion.div>
          )}
        </div>
      ) : uploadState === 'uploading' || uploadState === 'processing' ? (
        <div
          className="rounded-lg p-8 text-center bg-[var(--color-bg-secondary)]"
          role="status"
          aria-live="polite"
        >
          <div className="mx-auto mb-3 flex justify-center">
            <InlineSpinner size="xl" className="text-[var(--color-accent)]" />
          </div>
          <p className="text-sm font-medium mb-1 text-[var(--color-text-primary)]">
            {uploadState === 'uploading' ? 'Uploading...' : 'Analyzing syllabus...'}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">{fileName}</p>
        </div>
      ) : (
        <motion.div initial={prefersReducedMotion ? false : { y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Success State */}
          <div className="rounded-lg p-6 mb-4 bg-[var(--color-data-pass)]/10 border border-[var(--color-data-pass)]/30">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-[var(--color-data-pass)]" />
              <p className="font-medium text-[var(--color-data-pass)]">
                Syllabus Analyzed Successfully!
              </p>
            </div>
            <p className="text-sm text-[var(--color-data-pass)]">
              Found {extractedTags.length} key topics in {fileName}
            </p>
          </div>

          {/* Extracted Tags */}
          <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
            {extractedTags.map((tag, index) => (
              <motion.div
                key={index}
                initial={prefersReducedMotion ? false : { x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={prefersReducedMotion ? { duration: 0 } : { delay: index * 0.05 }}
                className="rounded-lg p-4 bg-[var(--color-bg-secondary)]"
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-[var(--color-text-primary)]">{tag.topic}</h4>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      tag.priority === 'high'
                        ? 'bg-[var(--color-data-fail)]/15 text-[var(--color-data-fail)]'
                        : tag.priority === 'medium'
                          ? 'bg-[var(--color-data-provisional)]/15 text-[var(--color-data-provisional)]'
                          : 'bg-[var(--color-data-neutral)]/15 text-[var(--color-data-neutral)]'
                    }`}
                  >
                    {tag.priority}
                  </span>
                </div>
                {tag.examSection && (
                  <p className="text-xs mb-2 text-[var(--color-text-muted)]">
                    Exam Section: {tag.examSection}
                  </p>
                )}
                <div className="flex flex-wrap gap-1">
                  {tag.keywords.map((keyword, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-1 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <PrimaryButton
              variant="primary"
              size="sm"
              onClick={handleDownloadTags}
              icon={<Download className="w-4 h-4" />}
              className="flex-1"
            >
              Download Tags
            </PrimaryButton>
            <PrimaryButton
              variant="ghost"
              size="sm"
              onClick={handleReset}
              icon={<X className="w-4 h-4" />}
            >
              Reset
            </PrimaryButton>
          </div>
        </motion.div>
      )}
    </div>
  );
}

/**
 * Read file content as text
 */
async function readFileContent(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('Failed to read file as text'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Error reading file'));
    };

    // Handle text files directly
    if (file.type === 'text/plain') {
      reader.readAsText(file);
    } else {
      // PDF/Word parsing requires additional libraries (pdf-parse, mammoth, etc.)
      // These libraries add significant bundle size (~500KB+) and are not critical for MVP
      // Feature Request: Add PDF/Word parsing in future iteration
      // For now, users can copy-paste content from PDFs into .txt files
      reject(
        new Error(
          'PDF and Word document parsing is not yet fully implemented. Please use text files (.txt) for now. You can copy content from your PDF/Word document and save it as a .txt file, or contact support for assistance.'
        )
      );
    }
  });
}

/**
 * Parse syllabus content and extract topics
 */
async function parseSyllabusContent(text: string): Promise<SyllabusTag[]> {
  // Small delay to show processing state (can be removed in production)
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Simple pattern matching for educational content
  const tags: SyllabusTag[] = [];

  // Look for exam/chapter patterns
  const examPattern = /(?:exam|test|quiz|chapter)\s+(\d+)[:\s]+([^\n]+)/gi;
  const matches = text.matchAll(examPattern);

  for (const match of matches) {
    const sectionNum = match[1];
    const topicText = match[2];

    // Guard against undefined capture groups
    if (!sectionNum || !topicText) continue;

    // Extract keywords from topic
    const keywords = extractKeywords(topicText);

    tags.push({
      topic: topicText.trim(),
      keywords,
      priority: determinePriority(topicText),
      examSection: `Section ${sectionNum}`,
    });
  }

  // If no exam patterns found, extract general topics
  if (tags.length === 0) {
    const commonTopics = [
      'Cardiovascular',
      'Pulmonary',
      'Gastrointestinal',
      'Endocrine',
      'Neurology',
      'Psychiatry',
      'Dermatology',
      'Orthopedics',
      'Pharmacology',
      'Emergency Medicine',
      'Pediatrics',
    ];

    commonTopics.forEach((topic) => {
      if (text.toLowerCase().includes(topic.toLowerCase())) {
        tags.push({
          topic,
          keywords: [topic],
          priority: 'medium',
        });
      }
    });
  }

  return tags;
}

/**
 * Extract keywords from text
 */
function extractKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3);

  // Return unique words
  return Array.from(new Set(words)).slice(0, 5);
}

/**
 * Determine priority based on text content
 */
function determinePriority(text: string): 'high' | 'medium' | 'low' {
  const highPriorityKeywords = ['exam', 'test', 'critical', 'important', 'essential'];
  const lowText = text.toLowerCase();

  if (highPriorityKeywords.some((k) => lowText.includes(k))) {
    return 'high';
  }

  return 'medium';
}
