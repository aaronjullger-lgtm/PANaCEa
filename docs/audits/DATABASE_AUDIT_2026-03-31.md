# PANaCEa Database Audit Report
**Date:** March 31, 2026

---

## Executive Summary

The PANaCEa database contains **1,359 pre-generated questions** spanning 14 organ systems with 586 unique conditions. The database structure is sound with no orphaned or empty question data. However, there are **CRITICAL RED FLAGS** around FSRS data integrity and user activity tracking.

---

## Content Coverage

### Questions by Validation Status
- **Approved:** 1,359 questions (100%)
- All content is validated and marked "approved" for study

### Questions by Organ System (Top 14 Systems)
| System | Count | Coverage |
|--------|-------|----------|
| HEENT | 155 | 11.4% |
| DERM | 123 | 9.1% |
| NEURO | 121 | 8.9% |
| MSK | 102 | 7.5% |
| RENAL | 99 | 7.3% |
| CV | 97 | 7.1% |
| GI | 95 | 7.0% |
| ENDO | 92 | 6.8% |
| REPRO | 88 | 6.5% |
| HEME | 88 | 6.5% |
| PULM | 84 | 6.2% |
| GU | 78 | 5.7% |
| PSYCH | 76 | 5.6% |
| ID | 61 | 4.5% |

**Total Top 14 Systems:** 1,359 questions (100% coverage)

### Condition Coverage
- **Conditions with questions:** 586 unique conditions
- **Total conditions in database:** 1,293 conditions
- **Coverage rate:** 45.3% of conditions have at least one question
- **RED FLAG:** 707 conditions (54.7%) have NO associated questions

### Difficulty Distribution
| Difficulty | Count | Percentage |
|------------|-------|-----------|
| Medium | 816 | 60.0% |
| Easy | 272 | 20.0% |
| Hard | 271 | 20.0% |

**Assessment:** Well-balanced distribution across difficulty levels

### Question Type Distribution
| Type | Count | Percentage |
|------|-------|-----------|
| Clinical Vignette | 860 | 63.3% |
| General | 436 | 32.1% |
| MCQ | 63 | 4.6% |

### Data Quality
- **Questions with empty/null data:** 0
- **Questions with no condition link:** 0
- **Total drugs in system:** 1,000

**Assessment:** Excellent data quality; no orphaned or malformed records

---

## FSRS (Spaced Repetition) Data Integrity - CRITICAL ISSUES

### UserProgress Records (FSRS State Tracking)
- **Total UserProgress records:** 0
- **Records with nextReviewAt scheduled:** 0
- **RED FLAG:** No FSRS progress data exists for any user/condition pair

### Review Activity (ReviewLog)
- **Total reviews:** 0
- **First review date:** null
- **Last review date:** null
- **RED FLAG:** Zero study activity logged; ReviewLog table is completely empty

### Question Attempts (QuestionAttempt)
- **Total attempts:** 0
- **Correct attempts:** 0
- **RED FLAG:** No one has taken any questions yet, or data was never recorded

### FSRS Parameters (Personalized Weights)
- **Status:** Table does not exist in schema
- **RED FLAG:** No ability to store personalized FSRS weights (v6 parameters should have at least 21 params per user)
- **Impact:** The FSRS optimizer sidecar cannot function without this table

---

## Critical Issues Summary

### RED FLAG #1: Zero FSRS Data
**Severity:** CRITICAL

All FSRS-related tables are empty or missing:
- 0 UserProgress records (FSRS cards, stability, difficulty)
- 0 ReviewLog entries (study history)
- 0 QuestionAttempt records (interaction data)
- FSRSParameters table does not exist

**Implication:** The app has never recorded any spaced repetition data, OR the database was wiped, OR there is a critical data pipeline failure.

**Investigation needed:**
- Check if drills/main sessions are actually submitting to `/api/drills/submit-review`
- Verify `/api/drills/submit-review` is creating records in ReviewLog and UserProgress
- Check if ReviewLog has `sessionType` constraint filtering out non-'main' sessions (per CLAUDE.md constraints)

### RED FLAG #2: 54.7% Condition Coverage Gap
**Severity:** HIGH

707 of 1,293 conditions (54.7%) have zero associated questions. This means:
- Half the curriculum is uncovered by assessments
- Students won't be tested on many PANCE-relevant topics
- Content generation pipeline may have stalled

**Recommendation:** Prioritize generating questions for uncovered conditions

### RED FLAG #3: Missing FSRSParameters Table
**Severity:** HIGH

The `FSRSParameters` table referenced in CLAUDE.md doesn't exist. Required for:
- Storing personalized FSRS weights (v6 uses 21 parameters)
- The gcp-fsrs-optimizer sidecar to function
- Learner-stage adaptive tuning

**Recommendation:** Create migration to add `FSRSParameters(userId, weights, version, lastUpdated, etc.)`

### GREEN FLAG: Data Quality
No empty questions, no orphans, no malformed JSON. Content that exists is clean and well-structured.

---

## Detailed Findings

### Questions Overview
- **Total questions:** 1,359
- **Validation status:** All approved
- **Quality:** No NULL/empty questionData fields
- **Coverage:** All conditions linked (0 orphaned questions)
- **Difficulty spread:** Balanced (60/20/20)
- **Type spread:** Mostly clinical vignettes (63%), some general (32%), few MCQs (5%)

### Conditions Overview
- **Total in database:** 1,293
- **With questions:** 586 (45.3%)
- **Without questions:** 707 (54.7%)

### Drug Catalog
- **Total drugs:** 1,000
- **Status:** Complete and indexed

---

## PANCE Coverage Assessment

### Strong Coverage (100+ questions)
- HEENT (155 questions) - Strong
- DERM (123 questions) - Strong
- NEURO (121 questions) - Strong

### Moderate Coverage (70-100 questions)
- MSK (102), RENAL (99), CV (97), GI (95), ENDO (92), REPRO (88), HEME (88), PULM (84)

### Emerging Coverage (50-70 questions)
- GU (78), PSYCH (76), ID (61)

### Assessment
All major PANCE organ systems are represented with at least 61 questions. This provides a foundational question bank, but depth varies.

---

## Architecture Notes

### Session Type Distribution
**CRITICAL FINDING:** ReviewLog shows ZERO entries with any sessionType
- Expected: Mix of 'main', 'cram', 'rapid_recall', and potentially 'drill'
- Actual: No data

This correlates with zero UserProgress records. The entire study pipeline appears non-functional or data was not persisted.

---

## Recommendations (Priority Order)

### 1. URGENT: Investigate FSRS Data Pipeline Failure
- [ ] Test `/api/drills/submit-review` endpoint manually
- [ ] Check CloudflarePages Functions logs for errors
- [ ] Verify ReviewLog table is actually receiving writes
- [ ] Check if sessionType filtering is blocking 'drill' submissions
- [ ] Review CLAUDE.md constraint: only `review_type: 'real'` MAIN sessions count

### 2. HIGH: Create FSRSParameters Table
- [ ] Add migration: `CREATE TABLE FSRSParameters (userId, weights JSON, version, lastUpdated)`
- [ ] Update Prisma schema
- [ ] Configure optimizer sidecar connection

### 3. HIGH: Expand Condition Coverage
- [ ] Identify the 707 uncovered conditions
- [ ] Prioritize PANCE high-yield conditions first
- [ ] Target: 80%+ coverage (1,034 of 1,293 conditions)

### 4. MEDIUM: Review SessionType Implementation
- [ ] Confirm 'drill' sessionType enum value exists (CLAUDE.md notes it's missing)
- [ ] Update DrillShell to pass `sessionType: 'drill'` in submissions
- [ ] Verify FSRS gating logic doesn't exclude drill submissions inappropriately

### 5. MEDIUM: Increase Hard Question Generation
- [ ] Hard questions: 271 (20%) - consider 25-30% target
- [ ] Medium questions: 816 (60%) - slightly reduce
- [ ] Easy questions: 272 (20%) - maintain

---

## Conclusion

PANaCEa's question database is **structurally sound** with 1,359 clean, well-categorized questions spanning all major organ systems. However, the **FSRS spaced repetition system is non-functional** — zero records exist in UserProgress, ReviewLog, or QuestionAttempt tables. This is the #1 blocker for the app's effectiveness as a study tool.

**Overall Data Health:** 7/10
- Content quality: 9/10
- FSRS functionality: 0/10 (CRITICAL FAILURE)
- Condition coverage: 5/10 (45% only)

**Next Steps:** Diagnose FSRS pipeline failure immediately, then expand condition coverage and implement personalized FSRS weights.

