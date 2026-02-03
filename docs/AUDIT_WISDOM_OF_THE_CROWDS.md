# Audit: Wisdom of the Crowds (Community Validation)

## Context

Users get a question wrong and feel alone. Social features should provide **validation**, not just competition.

## Implemented

### 1. Peer Selection Stats ("42% of students also chose B")

- **When:** After answering, on the answer-reveal / feedback screen.
- **What:** Show "X% of students also chose [letter]." for the option the user selected (especially when wrong).
- **Why:** Comforts the user ("I'm not stupid, this was a tricky distractor") and turns failure into a data point.
- **How:**
  - **Storage:** `QuestionAttempt.selectedAnswer` (A–D) is persisted when recording an attempt (POST `/api/questions/attempt` with `selectedAnswer`).
  - **API:** GET `/api/questions/answer-distribution?questionId=xxx` returns `distribution: { optionLetter, count, percent }[]` for that question.
  - **Client:** QuizView fetches distribution when feedback is shown and displays the line for the user's chosen option; when wrong, adds: "This was a tricky distractor — you're not alone."

### 2. Common Pitfalls (No Unmoderated Comments)

- **Requirement:** Discussion/comments per question (UWorld/Reddit-style) require **moderation**. If you can't moderate, don't build it.
- **Alternative:** Use **pre-written "Common Pitfalls"** in the rationale so students still get peer-like insight without live comments.
- **Implementation:**
  - **Rationale:** `StructuredRationale.commonPitfalls?: string[]` — optional list of short pitfalls (e.g. "Confusing with X because both present with Y").
  - **UI:** Answer-reveal shows a "Common Pitfalls" section when present (bulleted list).
  - **Content:** Populate via AI generation or content writers; no user-generated comments, so no moderation burden.

## Audit Checks

- [ ] Attempt API accepts and stores `selectedAnswer` (index or A–D).
- [ ] Sync manager sends `selectedAnswer` when syncing to `/api/questions/attempt`.
- [ ] GET `/api/questions/answer-distribution?questionId=...` returns distribution for that question.
- [ ] QuizView shows "X% of students also chose B" (and optional comfort line when wrong).
- [ ] Rationale supports `commonPitfalls` and it is rendered in the feedback UI.
- [ ] Do **not** add a per-question comment section unless moderation is in place.
