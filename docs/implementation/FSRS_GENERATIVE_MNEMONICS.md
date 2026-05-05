# FSRS Generative Mnemonics (Pillar 4)

Visual Semantic Anchoring for flashcards: generate mnemonic images via Adobe Firefly so cards are memorable, not just text.

## Canonical FSRS flow (architecture)

**The only user-facing FSRS path is the main session:** MC PANCE questions in `QuizView`. Incorrect answers are scheduled; when due, a **variant** of the question is presented in the **same** session flow via focus "Due" (Training Menu) and `/api/questions/due-siblings`. There are no separate "flashcards" in the product; "due" = variant shown as MC in the main session.

**Variant-on-incorrect:** Each schedule (incorrect answer) is paired with ensuring a due variant exists. On incorrect, `/api/drills/submit-review` calls `ensureDueVariant`: if no sibling (same `conditionId`, different question id) exists in `PreGeneratedQuestion`, a variant is generated via Gemini and stored. So the user never waits for generation when starting a Due session; if they get the variant wrong again, the same logic runs and another variant can be generated. Variants are stored and reused (not one-use).

## Endpoint

**POST /api/srs/generate-visual** — `functions/api/srs/generate-visual.ts`

**Body:** `front`, `back` (flashcard text), optional `style` (`photorealistic` | `exaggerated`), optional `structureReferenceId` or `structureReferenceUrl`, optional `conditionId`, `questionId`.

**Response:** `{ data: { imageBase64, imageMime, imageUrl, front, back, style } }`

## Prompt logic

- **photorealistic (default):** "Medical illustration of [pathology from back], white background, photorealistic. Clinical finding for [front]."
- **exaggerated (Hard re-generation):** "Cartoon style medical mnemonic for [front]: [back]. Exaggerated, memorable features for memory aid. White background, educational illustration."

## Structure reference

If `structureReferenceId` (AnatomyStructure.id or MediaAsset.id) or `structureReferenceUrl` is provided, Firefly uses it as a structure reference so anatomy stays correct while the AI "paints" the finding (e.g. rash on an arm).

## Scheduling (Hard trigger)

When the user rates a card **Hard (1)** in `POST /api/srs/submit`, the response includes:

- `triggerVisualRegeneration: true`
- `questionId`, `conditionId`, `topicProgressId` (when available)
- `visualRegenerationHint`: frontend should call `POST /api/srs/generate-visual` with front/back and `style: "exaggerated"`, then display the new image.

## Frontend display

- **Canonical:** Main session = `QuizView` (MC only). Due items are loaded via focus "Due" and `/api/questions/due-siblings` and shown as MC variants in the same view; Ghost Grader and optimistic UI are wired there.
- **Legacy / hidden:** `SrsFlashcardView` (view `srs_flashcards`) is no longer linked from the app nav. It used **Study Tools → Resources → SRS Flashcards**; that entry point has been removed so the product has a single FSRS path (QuizView MC). The component and `/api/srs/next`, `/api/srs/submit`, `/api/srs/generate-visual` remain in code for possible future use. `SrsFlashcardView` uses the API-backed `fetchNextVariantCard()` and `submitVariantReview()` helpers from `lib/services/srsReviewClient.ts`; it no longer has localStorage SRS fallback helpers.
- **Flashcard component:** When a mnemonic image is available (from generate-visual or cached), show it on the card (e.g. front or back). Add a **Flip** animation (e.g. CSS transform rotateY or Framer Motion) so the user can flip between front text and back image.
- **Flow:** On submit with rating 1, if `data.triggerVisualRegeneration` is true, call generate-visual with the card’s front/back and `style: "exaggerated"`, store or display the returned image, and optionally replace the card’s visual for the next review.

## Auth (Bearer token)

When the backend requires Bearer auth for `/api/srs/next` or `/api/srs/submit`, pass `getToken` (e.g. from `useAuth()` from Clerk) so the service sends `Authorization: Bearer <token>`. See `lib/services/srsReviewClient.ts`: `fetchNextVariantCard(options?)` and `submitVariantReview(payload, options?)`. `SrsFlashcardView` uses `useAuth()` and passes `getToken` into both helpers.

## References

- Adobe Firefly API (Text to Image, Structure Reference)
- High-leverage ideas: `docs/HIGH_LEVERAGE_PRODUCT_IDEAS.md`
- Visualizer (anatomy): `functions/api/visualizer/generate.ts`
