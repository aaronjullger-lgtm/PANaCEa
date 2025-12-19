/**
 * Content Quality Validator
 * 
 * Validates AI-generated medical content to ensure quality standards
 * before saving to database. Prevents hallucinations, refusals, and
 * incomplete content from being persisted.
 */

import type { 
  GeneratedConditionContent,
  GeneratedLabContent,
  GeneratedImagingContent,
  GeneratedTreatmentContent,
  GeneratedPhysiologyContent,
} from "../autoAuthor/types";

export interface ValidationResult {
  isValid: boolean;
  issues: string[];
  warnings?: string[];
}

// Known AI refusal/disclaimer patterns
const REFUSAL_PATTERNS = [
  /i am an ai/i,
  /i cannot provide medical advice/i,
  /as a language model/i,
  /as an ai/i,
  /i'm not a doctor/i,
  /consult a medical professional/i,
  /disclaimer:/i,
  /this is not medical advice/i,
];

const APOLOGY_PATTERNS = [
  /^sorry,?/i,
  /^i apologize/i,
  /^unfortunately,? i cannot/i,
  /^i'm unable to/i,
];

/**
 * Check if text contains AI refusal or disclaimer language
 */
function containsRefusalLanguage(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  
  return REFUSAL_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Check if text starts with an apology or refusal
 */
function startsWithApology(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  
  return APOLOGY_PATTERNS.some((pattern) => pattern.test(text.trim()));
}

/**
 * Validate array field is actually an array and meets length requirement
 */
function validateArrayField(
  field: any,
  fieldName: string,
  minLength: number
): { valid: boolean; issue?: string } {
  // Check if field exists
  if (!field) {
    return { valid: false, issue: `${fieldName} is missing or null` };
  }

  // Check if it's actually an array (not a stringified array)
  if (!Array.isArray(field)) {
    return { valid: false, issue: `${fieldName} is not an array (got ${typeof field})` };
  }

  // Check minimum length
  if (field.length < minLength) {
    return {
      valid: false,
      issue: `${fieldName} has ${field.length} items (minimum: ${minLength})`,
    };
  }

  // Check for empty strings in array
  const hasEmptyStrings = field.some(
    (item) => typeof item !== "string" || item.trim().length === 0
  );
  if (hasEmptyStrings) {
    return { valid: false, issue: `${fieldName} contains empty or non-string items` };
  }

  return { valid: true };
}

/**
 * Validate string field meets minimum length requirement
 */
function validateStringField(
  field: any,
  fieldName: string,
  minLength: number
): { valid: boolean; issue?: string } {
  // Check if field exists
  if (!field) {
    return { valid: false, issue: `${fieldName} is missing or null` };
  }

  // Check if it's a string
  if (typeof field !== "string") {
    return { valid: false, issue: `${fieldName} is not a string (got ${typeof field})` };
  }

  // Check minimum length
  if (field.trim().length < minLength) {
    return {
      valid: false,
      issue: `${fieldName} is too short (${field.length} chars, minimum: ${minLength})`,
    };
  }

  return { valid: true };
}

/**
 * Validate generated medical content against quality standards
 * 
 * @param content - The generated content to validate
 * @returns Validation result with issues and warnings
 */
export function validateGeneratedContent(
  content: any
): ValidationResult {
  const issues: string[] = [];
  const warnings: string[] = [];

  // Guard: Content must exist
  if (!content || typeof content !== "object") {
    return {
      isValid: false,
      issues: ["Content is null, undefined, or not an object"],
    };
  }

  // ============================================================
  // RULE 1: Anti-Hallucination / Refusal Detection
  // ============================================================

  // Check overview for refusal language
  if (content.overview && containsRefusalLanguage(content.overview)) {
    issues.push("Overview contains AI refusal/disclaimer language");
  }

  if (content.overview && startsWithApology(content.overview)) {
    issues.push("Overview starts with an apology or refusal");
  }

  // Check other text fields for refusal language (less strict, just warnings)
  if (content.diagnosis && containsRefusalLanguage(content.diagnosis)) {
    warnings.push("Diagnosis contains potential disclaimer language");
  }

  if (content.treatment && containsRefusalLanguage(content.treatment)) {
    warnings.push("Treatment contains potential disclaimer language");
  }

  // ============================================================
  // RULE 2: Minimum Viable Content (MVC)
  // ============================================================

  // Overview: Must be > 100 characters
  const overviewCheck = validateStringField(content.overview, "overview", 100);
  if (!overviewCheck.valid) {
    issues.push(overviewCheck.issue!);
  }

  // Clinical Pearls: Must be an array with >= 2 items
  const pearlsCheck = validateArrayField(content.clinicalPearls, "clinicalPearls", 2);
  if (!pearlsCheck.valid) {
    issues.push(pearlsCheck.issue!);
  }

  // Symptoms: Must be an array with >= 3 items
  const symptomsCheck = validateArrayField(content.symptoms, "symptoms", 3);
  if (!symptomsCheck.valid) {
    issues.push(symptomsCheck.issue!);
  }

  // Risk Factors: Must be an array with >= 2 items (recommended, not critical)
  const riskFactorsCheck = validateArrayField(content.riskFactors, "riskFactors", 2);
  if (!riskFactorsCheck.valid) {
    warnings.push(riskFactorsCheck.issue!);
  }

  // Diagnosis: Must be > 50 characters
  const diagnosisCheck = validateStringField(content.diagnosis, "diagnosis", 50);
  if (!diagnosisCheck.valid) {
    issues.push(diagnosisCheck.issue!);
  }

  // Treatment: Must be > 50 characters
  const treatmentCheck = validateStringField(content.treatment, "treatment", 50);
  if (!treatmentCheck.valid) {
    issues.push(treatmentCheck.issue!);
  }

  // ============================================================
  // RULE 3: Data Integrity
  // ============================================================

  // Check for stringified arrays (common AI mistake)
  const arrayFields = ["symptoms", "clinicalPearls", "riskFactors"];
  for (const field of arrayFields) {
    if (
      content[field] &&
      typeof content[field] === "string" &&
      content[field].includes("[")
    ) {
      issues.push(`${field} appears to be a stringified array, not a real array`);
    }
  }

  // Check for placeholder/template content
  const placeholderPatterns = [
    /\[condition\]/i,
    /\[system\]/i,
    /\[insert\]/i,
    /TODO:/i,
    /PLACEHOLDER/i,
  ];

  const allText = [
    content.overview,
    content.diagnosis,
    content.treatment,
    ...(Array.isArray(content.symptoms) ? content.symptoms : []),
    ...(Array.isArray(content.clinicalPearls) ? content.clinicalPearls : []),
  ]
    .filter(Boolean)
    .join(" ");

  if (placeholderPatterns.some((pattern) => pattern.test(allText))) {
    issues.push("Content contains placeholder text or TODO markers");
  }

  // ============================================================
  // Extended Fields (Optional Validation)
  // ============================================================

  if (content.examFindings) {
    const examCheck = validateArrayField(content.examFindings, "examFindings", 2);
    if (!examCheck.valid) {
      warnings.push(examCheck.issue!);
    }
  }

  if (content.complications) {
    const compCheck = validateArrayField(content.complications, "complications", 1);
    if (!compCheck.valid) {
      warnings.push(compCheck.issue!);
    }
  }

  if (content.differentialDiagnosis) {
    const ddxCheck = validateArrayField(
      content.differentialDiagnosis,
      "differentialDiagnosis",
      2
    );
    if (!ddxCheck.valid) {
      warnings.push(ddxCheck.issue!);
    }
  }

  // ============================================================
  // Final Result
  // ============================================================

  return {
    isValid: issues.length === 0,
    issues,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Quick validation check - returns true if content is valid
 */
export function isContentValid(content: any): boolean {
  const result = validateGeneratedContent(content);
  return result.isValid;
}

/**
 * Format validation result for logging
 */
export function formatValidationResult(
  conditionName: string,
  result: ValidationResult
): string {
  if (result.isValid) {
    const warningText =
      result.warnings && result.warnings.length > 0
        ? ` (${result.warnings.length} warnings)`
        : "";
    return `✅ ${conditionName} passed validation${warningText}`;
  }

  const lines = [`❌ ${conditionName} failed validation:`];

  result.issues.forEach((issue, idx) => {
    lines.push(`   ${idx + 1}. ${issue}`);
  });

  if (result.warnings && result.warnings.length > 0) {
    lines.push("   Warnings:");
    result.warnings.forEach((warning) => {
      lines.push(`   ⚠️  ${warning}`);
    });
  }

  return lines.join("\n");
}

// ============================================================
// LAB TEST VALIDATION
// ============================================================

export function validateLabContent(content: any): ValidationResult {
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!content || typeof content !== "object") {
    return {
      isValid: false,
      issues: ["Content is null, undefined, or not an object"],
    };
  }

  // Check for refusal language
  if (content.description && containsRefusalLanguage(content.description)) {
    issues.push("Description contains AI refusal/disclaimer language");
  }

  // Description: Must be > 80 characters
  const descCheck = validateStringField(content.description, "description", 80);
  if (!descCheck.valid) {
    issues.push(descCheck.issue!);
  }

  // Common Abnormalities: Must be an array with >= 2 items
  const abnormalCheck = validateArrayField(content.commonAbnormalities, "commonAbnormalities", 2);
  if (!abnormalCheck.valid) {
    issues.push(abnormalCheck.issue!);
  }

  // Indications: Must be an array with >= 2 items
  const indicationsCheck = validateArrayField(content.indications, "indications", 2);
  if (!indicationsCheck.valid) {
    issues.push(indicationsCheck.issue!);
  }

  return {
    isValid: issues.length === 0,
    issues,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

// ============================================================
// IMAGING STUDY VALIDATION
// ============================================================

export function validateImagingContent(content: any): ValidationResult {
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!content || typeof content !== "object") {
    return {
      isValid: false,
      issues: ["Content is null, undefined, or not an object"],
    };
  }

  // Check for refusal language
  if (content.description && containsRefusalLanguage(content.description)) {
    issues.push("Description contains AI refusal/disclaimer language");
  }

  // Description: Must be > 80 characters
  const descCheck = validateStringField(content.description, "description", 80);
  if (!descCheck.valid) {
    issues.push(descCheck.issue!);
  }

  // Best For: Must be an array with >= 2 items
  const bestForCheck = validateArrayField(content.bestFor, "bestFor", 2);
  if (!bestForCheck.valid) {
    issues.push(bestForCheck.issue!);
  }

  // Limitations: Must be an array with >= 2 items
  const limitationsCheck = validateArrayField(content.limitations, "limitations", 2);
  if (!limitationsCheck.valid) {
    issues.push(limitationsCheck.issue!);
  }

  // Radiation risk must be boolean
  if (typeof content.radiationRisk !== "boolean") {
    issues.push("radiationRisk must be a boolean value");
  }

  return {
    isValid: issues.length === 0,
    issues,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

// ============================================================
// TREATMENT VALIDATION
// ============================================================

export function validateTreatmentContent(content: any): ValidationResult {
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!content || typeof content !== "object") {
    return {
      isValid: false,
      issues: ["Content is null, undefined, or not an object"],
    };
  }

  // Check for refusal language
  if (content.description && containsRefusalLanguage(content.description)) {
    issues.push("Description contains AI refusal/disclaimer language");
  }

  if (content.mechanismOfAction && containsRefusalLanguage(content.mechanismOfAction)) {
    issues.push("Mechanism of action contains AI refusal/disclaimer language");
  }

  // Description: Must be > 80 characters
  const descCheck = validateStringField(content.description, "description", 80);
  if (!descCheck.valid) {
    issues.push(descCheck.issue!);
  }

  // Mechanism of Action: Must be > 50 characters
  const mechanismCheck = validateStringField(content.mechanismOfAction, "mechanismOfAction", 50);
  if (!mechanismCheck.valid) {
    issues.push(mechanismCheck.issue!);
  }

  // Common Indications: Must be an array with >= 2 items
  const indicationsCheck = validateArrayField(content.commonIndications, "commonIndications", 2);
  if (!indicationsCheck.valid) {
    issues.push(indicationsCheck.issue!);
  }

  // Serious Side Effects: Must be an array with >= 2 items
  const sideEffectsCheck = validateArrayField(content.seriousSideEffects, "seriousSideEffects", 2);
  if (!sideEffectsCheck.valid) {
    issues.push(sideEffectsCheck.issue!);
  }

  return {
    isValid: issues.length === 0,
    issues,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

// ============================================================
// PHYSIOLOGY VALIDATION
// ============================================================

export function validatePhysiologyContent(content: any): ValidationResult {
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!content || typeof content !== "object") {
    return {
      isValid: false,
      issues: ["Content is null, undefined, or not an object"],
    };
  }

  // Check for refusal language
  if (content.description && containsRefusalLanguage(content.description)) {
    issues.push("Description contains AI refusal/disclaimer language");
  }

  if (content.mechanism && containsRefusalLanguage(content.mechanism)) {
    issues.push("Mechanism contains AI refusal/disclaimer language");
  }

  if (content.clinicalSignificance && containsRefusalLanguage(content.clinicalSignificance)) {
    issues.push("Clinical significance contains AI refusal/disclaimer language");
  }

  // Description: Must be > 80 characters
  const descCheck = validateStringField(content.description, "description", 80);
  if (!descCheck.valid) {
    issues.push(descCheck.issue!);
  }

  // Mechanism: Must be > 100 characters
  const mechanismCheck = validateStringField(content.mechanism, "mechanism", 100);
  if (!mechanismCheck.valid) {
    issues.push(mechanismCheck.issue!);
  }

  // Clinical Significance: Must be > 80 characters
  const clinSigCheck = validateStringField(content.clinicalSignificance, "clinicalSignificance", 80);
  if (!clinSigCheck.valid) {
    issues.push(clinSigCheck.issue!);
  }

  return {
    isValid: issues.length === 0,
    issues,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
