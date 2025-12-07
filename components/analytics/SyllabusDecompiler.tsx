/**
 * AI Syllabus Decompiler Component
 * 
 * Allows users to upload their school's PDF/Word syllabus.
 * AI parses the document for key phrases and auto-tags relevant questions.
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Download,
  Sparkles,
  X
} from 'lucide-react';

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
}: SyllabusDecompilerProps): JSX.Element {
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
        setErrorMessage(
          error instanceof Error ? error.message : 'Failed to process syllabus'
        );
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
      if (files.length > 0) {
        handleFileSelect(files[0]);
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
      if (files && files.length > 0) {
        handleFileSelect(files[0]);
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
    <div
      className={`rounded-xl p-6 ${
        theme === 'light' ? 'bg-white' : 'bg-gray-900'
      }`}
    >
      <div className="flex items-center gap-2 mb-4">
        <Sparkles
          className={`w-6 h-6 ${
            theme === 'light' ? 'text-purple-600' : 'text-purple-400'
          }`}
        />
        <h3
          className={`text-xl font-bold ${
            theme === 'light' ? 'text-gray-900' : 'text-white'
          }`}
        >
          AI Syllabus Decompiler
        </h3>
      </div>

      <p
        className={`text-sm mb-6 ${
          theme === 'light' ? 'text-gray-600' : 'text-gray-400'
        }`}
      >
        Upload your school's syllabus and let AI automatically identify key topics 
        and prioritize questions for hyper-personalized review.
      </p>

      {uploadState === 'idle' || uploadState === 'error' ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
            isDragging
              ? theme === 'light'
                ? 'border-blue-500 bg-blue-50'
                : 'border-blue-400 bg-blue-900/20'
              : theme === 'light'
              ? 'border-gray-300 hover:border-blue-400'
              : 'border-gray-600 hover:border-blue-500'
          }`}
        >
          <input
            type="file"
            id="syllabus-upload"
            accept=".pdf,.doc,.docx,.txt"
            onChange={handleFileInputChange}
            className="hidden"
          />
          
          <label
            htmlFor="syllabus-upload"
            className="cursor-pointer flex flex-col items-center"
          >
            <Upload
              className={`w-12 h-12 mb-3 ${
                theme === 'light' ? 'text-gray-400' : 'text-gray-500'
              }`}
            />
            <p
              className={`text-sm font-medium mb-1 ${
                theme === 'light' ? 'text-gray-700' : 'text-gray-300'
              }`}
            >
              Click to upload or drag and drop
            </p>
            <p
              className={`text-xs ${
                theme === 'light' ? 'text-gray-500' : 'text-gray-500'
              }`}
            >
              PDF, Word, or Text files (Max 10MB)
            </p>
          </label>

          {uploadState === 'error' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mt-4 p-3 rounded-lg ${
                theme === 'light'
                  ? 'bg-red-50 text-red-700'
                  : 'bg-red-900/20 text-red-400'
              }`}
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
          className={`rounded-lg p-8 text-center ${
            theme === 'light' ? 'bg-blue-50' : 'bg-blue-900/20'
          }`}
        >
          <Loader2
            className={`w-12 h-12 mx-auto mb-3 animate-spin ${
              theme === 'light' ? 'text-blue-600' : 'text-blue-400'
            }`}
          />
          <p
            className={`text-sm font-medium mb-1 ${
              theme === 'light' ? 'text-blue-900' : 'text-blue-100'
            }`}
          >
            {uploadState === 'uploading' ? 'Uploading...' : 'Analyzing syllabus...'}
          </p>
          <p
            className={`text-xs ${
              theme === 'light' ? 'text-blue-700' : 'text-blue-300'
            }`}
          >
            {fileName}
          </p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Success State */}
          <div
            className={`rounded-lg p-6 mb-4 ${
              theme === 'light'
                ? 'bg-green-50 border border-green-200'
                : 'bg-green-900/20 border border-green-800'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle
                className={`w-5 h-5 ${
                  theme === 'light' ? 'text-green-600' : 'text-green-400'
                }`}
              />
              <p
                className={`font-medium ${
                  theme === 'light' ? 'text-green-900' : 'text-green-100'
                }`}
              >
                Syllabus Analyzed Successfully!
              </p>
            </div>
            <p
              className={`text-sm ${
                theme === 'light' ? 'text-green-700' : 'text-green-300'
              }`}
            >
              Found {extractedTags.length} key topics in {fileName}
            </p>
          </div>

          {/* Extracted Tags */}
          <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
            {extractedTags.map((tag, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`rounded-lg p-4 ${
                  theme === 'light' ? 'bg-gray-50' : 'bg-gray-800'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h4
                    className={`font-semibold ${
                      theme === 'light' ? 'text-gray-900' : 'text-white'
                    }`}
                  >
                    {tag.topic}
                  </h4>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      tag.priority === 'high'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : tag.priority === 'medium'
                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}
                  >
                    {tag.priority}
                  </span>
                </div>
                {tag.examSection && (
                  <p
                    className={`text-xs mb-2 ${
                      theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                    }`}
                  >
                    Exam Section: {tag.examSection}
                  </p>
                )}
                <div className="flex flex-wrap gap-1">
                  {tag.keywords.map((keyword, i) => (
                    <span
                      key={i}
                      className={`text-xs px-2 py-1 rounded ${
                        theme === 'light'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-blue-900/30 text-blue-300'
                      }`}
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
            <button
              onClick={handleDownloadTags}
              className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                theme === 'light'
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <Download className="w-4 h-4" />
              Download Tags
            </button>
            <button
              onClick={handleReset}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                theme === 'light'
                  ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
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
      // For now, demonstrate the feature with mock content
      // TODO: Integrate PDF/Word parsing libraries for production use
      reject(new Error('PDF and Word document parsing is not yet fully implemented. Please use text files (.txt) for now, or contact support for assistance with your syllabus format.'));
    }
  });
}

/**
 * Parse syllabus content and extract topics
 */
async function parseSyllabusContent(text: string): Promise<SyllabusTag[]> {
  // Small delay to show processing state (can be removed in production)
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Simple pattern matching for educational content
  const tags: SyllabusTag[] = [];
  
  // Look for exam/chapter patterns
  const examPattern = /(?:exam|test|quiz|chapter)\s+(\d+)[:\s]+([^\n]+)/gi;
  const matches = text.matchAll(examPattern);
  
  for (const match of matches) {
    const sectionNum = match[1];
    const topicText = match[2];
    
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
      'Cardiovascular', 'Pulmonary', 'Gastrointestinal', 'Endocrine',
      'Neurology', 'Psychiatry', 'Dermatology', 'Orthopedics',
      'Pharmacology', 'Emergency Medicine', 'Pediatrics'
    ];
    
    commonTopics.forEach(topic => {
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
    .filter(w => w.length > 3);
  
  // Return unique words
  return Array.from(new Set(words)).slice(0, 5);
}

/**
 * Determine priority based on text content
 */
function determinePriority(text: string): 'high' | 'medium' | 'low' {
  const highPriorityKeywords = ['exam', 'test', 'critical', 'important', 'essential'];
  const lowText = text.toLowerCase();
  
  if (highPriorityKeywords.some(k => lowText.includes(k))) {
    return 'high';
  }
  
  return 'medium';
}
