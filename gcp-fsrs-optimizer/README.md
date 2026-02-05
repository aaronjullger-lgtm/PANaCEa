# FSRS Optimizer – Google Cloud Function (2nd Gen)

Python serverless sidecar that runs the [fsrs-optimizer](https://github.com/open-spaced-repetition/fsrs-optimizer) library to compute personalized FSRS v6 weights from review history.

## Local run (e.g. Project IDX)

```bash
cd gcp-fsrs-optimizer
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m functions_framework --target=optimize --debug
```

Then POST to `http://localhost:8080` with JSON body:

```json
{
  "reviews": [
    { "card_id": "id1", "review_time": 1707062400000, "review_rating": 3, "review_state": 2, "review_duration": 12000 }
  ],
  "timezone": "UTC",
  "next_day_starts_at": 0
}
```

Minimum 500 reviews required. Optional header: `X-FSRS-Optimizer-Key: <secret>` if `FSRS_OPTIMIZER_SECRET` is set.

## Deploy (Google Cloud)

```bash
gcloud functions deploy fsrs-optimizer \
  --gen2 \
  --runtime=python311 \
  --region=REGION \
  --source=. \
  --entry-point=optimize \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars FSRS_OPTIMIZER_SECRET=your-secret
```

Restrict invocation with IAM or use `--no-allow-unauthenticated` and call with a service account.

## Payload / response

See [docs/FSRS_SERVERLESS_SIDECAR.md](../docs/FSRS_SERVERLESS_SIDECAR.md) for full contract.
