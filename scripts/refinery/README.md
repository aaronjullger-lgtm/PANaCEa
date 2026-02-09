# Content Refinery Scripts

## Google Drive

### Environment

Add to `.env`:

```bash
# Base64-encoded Google Service Account key JSON (for Drive API).
# Encode: cat key.json | base64 -w0
GOOGLE_SERVICE_ACCOUNT_JSON=eyJ0eXBlIjoic2VydmljZV9hY2NvdW50Ii...
```

Create a key in [Google Cloud Console](https://console.cloud.google.com/) → IAM & Admin → Service Accounts → Keys. Share the target Drive folder with the service account email (Viewer).

### Test connection

```bash
npm run refinery:test-drive -- --folderId=YOUR_DRIVE_FOLDER_ID
# or
npx tsx scripts/refinery/test-drive-connection.ts --folderId=YOUR_DRIVE_FOLDER_ID
```

Logs the first 5 files in the folder to verify the connection.

### Ingest images: Drive → Raw Vault → DB (Visual Ingestion Engine)

Pulls images from a Drive folder, streams each to SHA-256 hash, uploads to Supabase bucket `raw-source-vault`, and creates `SourceMaterial` + `MediaAsset` drafts (status `pending`, `provenanceStatus` `unverified`).

**Env (in addition to `GOOGLE_SERVICE_ACCOUNT_JSON`):**

- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (Storage + DB if used)
- `DIRECT_DATABASE_URL` or `DATABASE_URL` — For Prisma (SourceMaterial / MediaAsset)

**Usage:**

```bash
npm run refinery:ingest-drive-media -- --folderId=YOUR_DRIVE_FOLDER_ID
# Optional:
#   --licenseType=CC-BY-SA   (default: PROPRIETARY_REFERENCE)
#   --sourceName="Personal Drive Archive"
```

- Skips files that already exist in `MediaAsset` (by `filename` + same `SourceMaterial`).
- Storage path: `drive-imports/YYYY-MM/{filename}_{driveIdPrefix}`.
- Logs: `Ingested [Filename]. Ready for Triage.`
