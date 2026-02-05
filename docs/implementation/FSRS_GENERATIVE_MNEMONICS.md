# FSRS Generative Mnemonics (Pillar 4)

Visual Semantic Anchoring for flashcards: generate mnemonic images via Adobe Firefly so cards are memorable, not just text.

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

- **UI entry point:** `components/session/SrsFlashcardView.tsx` — reachable via **Study Tools → Resources → SRS Flashcards** (view `srs_flashcards`). Uses `fetchNextVariantCard()` and `submitVariantReview()` from `lib/services/srsService.ts`; on `triggerVisualRegeneration` calls `requestMnemonicImage()` and shows the image with a flip animation.
- **Flashcard component:** When a mnemonic image is available (from generate-visual or cached), show it on the card (e.g. front or back). Add a **Flip** animation (e.g. CSS transform rotateY or Framer Motion) so the user can flip between front text and back image.
- **Flow:** On submit with rating 1, if `data.triggerVisualRegeneration` is true, call generate-visual with the card’s front/back and `style: "exaggerated"`, store or display the returned image, and optionally replace the card’s visual for the next review.

## Auth (Bearer token)

When the backend requires Bearer auth for `/api/srs/next`, `/api/srs/submit`, or `/api/srs/generate-visual`, pass `getToken` (e.g. from `useAuth()` from Clerk) so the service sends `Authorization: Bearer <token>`. See `lib/services/srsService.ts`: `fetchNextVariantCard(options?)`, `submitVariantReview(payload, options?)`, and `requestMnemonicImage(front, back, { ..., getToken })`. `SrsFlashcardView` uses `useAuth()` and passes `getToken` into all three.

## References

- Adobe Firefly API (Text to Image, Structure Reference)
- High-leverage ideas: `docs/HIGH_LEVERAGE_PRODUCT_IDEAS.md`
- Visualizer (anatomy): `functions/api/visualizer/generate.ts`
