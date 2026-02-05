# FSRS Optimizer Serverless Sidecar Architecture

## Overview

The FSRS (Free Spaced Repetition Scheduler) **Optimizer** recalculates per-user memory parameters (21 weights `w[]`) from review history. The reference implementation uses **Python + PyTorch** ([fsrs-optimizer](https://github.com/open-spaced-repetition/fsrs-optimizer)); the main app is **TypeScript** on **Cloudflare Pages**. This document describes a **Serverless Sidecar** using **Google Cloud Functions (2nd Gen)** to run the Python optimizer and keep the rest of the stack unchanged.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Cloudflare Pages (TypeScript)                                           │
│  ┌──────────────────────┐    POST /api/user/fsrs-params                 │
│  │  functions/api/user/  │ ──────────────────────────────────────────► │
│  │  fsrs-params.ts       │    Trigger optimization (auth)                │
│  └──────────┬───────────┘                                               │
│             │ 1. Query ReviewLog (real + MAIN)                          │
│             │ 2. Format JSON payload                                     │
│             │ 3. POST to GCF URL (with auth header)                      │
│             ▼                                                            │
│  ┌──────────────────────┐    HTTP POST (JSON)                           │
│  │  lib/fsrsOptimizer    │ ──────────────────────────────────────────►  │
│  │  Sidecar.ts           │    { reviews, timezone, next_day_starts_at }  │
│  └──────────────────────┘                                               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Google Cloud Functions (2nd Gen) – Python 3.11                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  fsrs-optimizer (PyTorch + fsrs-optimizer lib)                     │  │
│  │  - Accept JSON: card_id, review_time (ms), review_rating,          │  │
│  │    review_state, review_duration (ms)                              │  │
│  │  - Build revlog → create_time_series → initialize_parameters       │  │
│  │    → train() → return w[] + sampleSize, brierScore, improvement     │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ JSON response: { w, sampleSize, ... }
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Cloudflare Pages (TypeScript)                                           │
│  - Parse response                                                        │
│  - Upsert PersonalizedFSRSParams (Prisma)                               │
│  - Return result to client                                               │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

1. **Source of truth:** `ReviewLog` with `review_type = 'real'` and `sessionType = 'MAIN'` only (no cram/rapid-recall).
2. **Payload to GCF:** Array of `{ card_id, review_time, review_rating, review_state, review_duration }` plus optional `timezone`, `next_day_starts_at`.
3. **GCF returns:** `{ w: number[], sampleSize, brierScore?, defaultBrierScore?, improvementOverDefault?, iterations? }`.
4. **Persistence:** `PersonalizedFSRSParams` table: `w` (Float[]), `sampleSize`, `lastOptimizedAt`, `improvementOverDefault`, `optimizationIterations`, `validationBrierScore`.

## Security

- Call the Cloud Function with **invoker identity** (e.g. Service Account or IAM) or a **shared secret** in a header (e.g. `X-FSRS-Optimizer-Key`) so only your app can invoke it.
- Do not expose the Cloud Function URL in client bundles; keep it in server-side env (e.g. `FSRS_OPTIMIZER_URL`, `FSRS_OPTIMIZER_SECRET`).
- Validate request size (cap reviews per request, e.g. 50k) to avoid abuse.

## IDX (Project IDX) Local Testing

You can run and debug the Python Cloud Function **locally** in Project IDX before deploying:

1. **Open the sidecar folder in IDX**  
   Use the `gcp-fsrs-optimizer` (or `fsrs-optimizer-sidecar`) directory as the project root in IDX so the Python env and run configs apply.

2. **Install dependencies**  
   In the terminal:
   ```bash
   cd gcp-fsrs-optimizer
   python3 -m venv .venv
   source .venv/bin/activate   # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Run the function locally (HTTP server)**  
   Use the same contract as GCF 2nd Gen (HTTP request/response):
   ```bash
   python -m functions_framework --target=optimize --debug
   ```
   This serves `http://localhost:8080`. Send a POST with a JSON body (see Payload format below).

4. **Sample request (curl)**  
   Save a small `sample_request.json` (e.g. 500+ reviews for the optimizer to accept), then:
   ```bash
   curl -X POST http://localhost:8080 \
     -H "Content-Type: application/json" \
     -H "X-FSRS-Optimizer-Key: your-local-secret" \
     -d @sample_request.json
   ```

5. **Debugging**  
   Set breakpoints in `main.py` (e.g. in `optimize()`). In IDX, use the Run and Debug panel and choose “Python: Functions Framework” (or attach to the process running `functions_framework`).

6. **Deploy after validation**  
   When local runs return correct `w` and metadata, deploy with:
   ```bash
   gcloud functions deploy fsrs-optimizer --gen2 --runtime=python311 --region=REGION ...
   ```

## Payload Format (Request to GCF)

```json
{
  "reviews": [
    {
      "card_id": "question-uuid-or-card-id",
      "review_time": 1707062400000,
      "review_rating": 3,
      "review_state": 2,
      "review_duration": 12000
    }
  ],
  "timezone": "UTC",
  "next_day_starts_at": 0
}
```

- `review_time`: milliseconds since epoch (same as FSRS/Anki revlog).
- `review_rating`: 1 (Again), 2 (Hard), 3 (Good), 4 (Easy).
- `review_state`: 0=New, 1=Learning, 2=Review, 3=Relearning.
- `review_duration`: milliseconds (optional; use 0 if unknown).

## Response Format (from GCF)

```json
{
  "success": true,
  "w": [0.212, 1.2931, ...],
  "sampleSize": 1200,
  "brierScore": 0.18,
  "defaultBrierScore": 0.22,
  "improvementOverDefault": 18.2,
  "iterations": 2500
}
```

- `w`: 21 floats (FSRS v6).
- `iterations`: optional (L-BFGS/epoch steps); can be omitted if not provided by the Python trainer.

## Environment Variables (App / Cloudflare)

| Variable | Description |
|----------|-------------|
| `FSRS_OPTIMIZER_URL` | Full URL of the deployed Cloud Function (e.g. `https://REGION-PROJECT.cloudfunctions.net/fsrs-optimizer`). |
| `FSRS_OPTIMIZER_SECRET` | Shared secret sent in `X-FSRS-Optimizer-Key` header for auth. |
| `FSRS_USE_SIDECAR` | Set to `"1"` or `"true"` to call the sidecar; otherwise use in-process TS optimizer. |

## Update: Persisting the response (Prisma)

After receiving the GCF response, the API upserts into `PersonalizedFSRSParams`:

```ts
await prisma.personalizedFSRSParams.upsert({
  where: { userId: auth.userId },
  create: {
    userId: auth.userId,
    w: result.w,
    sampleSize: result.sampleSize,
    lastOptimizedAt: result.lastOptimizedAt,
    improvementOverDefault: result.improvementOverDefault,
    validationBrierScore: result.brierScore,
    optimizationIterations: result.iterations ?? undefined,
    systemModifiers: result.systemModifiers ?? undefined,
  },
  update: {
    w: result.w,
    sampleSize: result.sampleSize,
    lastOptimizedAt: result.lastOptimizedAt,
    improvementOverDefault: result.improvementOverDefault,
    validationBrierScore: result.brierScore,
    optimizationIterations: result.iterations ?? undefined,
    systemModifiers: result.systemModifiers ?? undefined,
  },
});
```

Equivalent raw SQL (for reference):

```sql
INSERT INTO "PersonalizedFSRSParams" (
  "id", "userId", "w", "sampleSize", "lastOptimizedAt",
  "improvementOverDefault", "validationBrierScore", "optimizationIterations",
  "createdAt", "updatedAt"
) VALUES (
  gen_random_uuid(), :userId, :w::float[], :sampleSize, :lastOptimizedAt,
  :improvementOverDefault, :validationBrierScore, :optimizationIterations,
  NOW(), NOW()
)
ON CONFLICT ("userId") DO UPDATE SET
  "w" = EXCLUDED."w",
  "sampleSize" = EXCLUDED."sampleSize",
  "lastOptimizedAt" = EXCLUDED."lastOptimizedAt",
  "improvementOverDefault" = EXCLUDED."improvementOverDefault",
  "validationBrierScore" = EXCLUDED."validationBrierScore",
  "optimizationIterations" = EXCLUDED."optimizationIterations",
  "updatedAt" = NOW();
```

## Fallback

If `FSRS_OPTIMIZER_URL` is unset or the sidecar request fails (timeout, 5xx), the API falls back to the in-process TypeScript optimizer (`lib/fsrs-optimizer.ts`) so optimization still runs without the Python sidecar.
