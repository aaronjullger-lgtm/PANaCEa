# Study Companion: Adobe Extract JSON Format

The **Intelligent Study Companion** (`POST /api/study/chat`) can return citation highlight coordinates so the frontend can overlay highlights on the PDF viewer. Those coordinates come from a pre-processed **Adobe Extract** JSON file stored in Supabase at the path given by `EducationalResource.adobeDataPath`.

## Frontend: Adobe PDF Embed API (SmartPDFViewer)

The **SmartPDFViewer** component (`src/components/library/SmartPDFViewer.tsx`) uses the [Adobe PDF Embed API](https://developer.adobe.com/document-services/docs/overview/pdf-embed-api/) (loaded from `https://documentcloud.adobe.com/view-sdk/main.js`). You must provide a **client ID** from [Adobe Document Services credentials](https://developer.adobe.com/console). Set it in your environment and pass it into the viewer:

- **Env:** `VITE_ADOBE_PDF_EMBED_CLIENT_ID` (or any name you expose to the client).
- **Usage:** `<SmartPDFViewer clientId={import.meta.env.VITE_ADOBE_PDF_EMBED_CLIENT_ID ?? ''} pdfUrl={...} ... />`

Register the client ID for your app’s domain (and `localhost` for dev). Without a valid client ID, the viewer may not load on non-demo domains.

**Liquid Mode (mobile-friendly reflow):** SmartPDFViewer supports Liquid Mode via `enableLinearization`. Liquid Mode may fail on files **larger than ~200 pages**. For large textbooks (e.g. Harrison's), serve **chapter-level PDFs** (e.g. `Cardiology.pdf`) rather than the full book; use Adobe PDF Extract or a split pipeline to produce chapter files. See `docs/GEMINI_LIVE_AND_SMART_LIBRARY.md` (Phase 5: Liquid Mode).

## Expected JSON Shape

The file should be valid JSON with at least:

```json
{
  "pages": [
    {
      "pageNumber": 1,
      "width": 612,
      "height": 792,
      "bounds": { "x": 72, "y": 600, "width": 468, "height": 24 },
      "elements": [
        { "bounds": { "x": 72, "y": 600, "width": 468, "height": 24 } }
      ]
    }
  ]
}
```

- **pages**: Array of page objects (order can match physical page order; `pageNumber` is 1-based).
- **pageNumber**: Optional 1-based page index.
- **width**, **height**: Page size in points (72 DPI). Defaults used if missing: 612×792.
- **bounds**: Optional single bounding box for the whole page or primary content (72 DPI, **bottom-left** origin).
- **elements**: Optional array of elements; the first element’s `bounds` can be used if `bounds` is missing.

## Coordinate System

- **Origin**: Bottom-left of the page (PDF convention).
- **Units**: Points (72 per inch).
- The API converts these to **percent** (0–100) for `highlightBox`: `top`, `left`, `width`, `height`, so the frontend can scale overlays to any viewer size.

## Citation Parsing

The tutor is instructed to cite with `[Page N]` or `[Pages N–M]`. The endpoint also recognizes:

- `[Page N]`, `[Pages N–M]`
- `[p. N]`, `[pp. N–M]`
- `[page N]`, `[pages N–M]`
- `(Page N)`, `(p. N)`

For each cited page number, the API looks up that page in the Adobe JSON and returns one `highlightBox` per page (using the first available bounds for that page).

## Storage

- Store the JSON in the same Supabase bucket as your PDFs (e.g. `educational-resources`).
- Set `EducationalResource.adobeDataPath` to the **bucket-relative** path (e.g. `textbook/cardiology-extract.json`).
- If `adobeDataPath` is null, the API still returns `answer` and `citations` with default full-width highlight boxes; the frontend can hide or simplify overlays.

## Pipeline

You can produce this JSON with:

- **Adobe PDF Services API** (Extract PDF) for structure and text positions.
- A custom script that maps PDF text/block positions (e.g. from pdf-lib or similar) into the expected `pages`/`bounds`/`elements` shape.

Once the file is uploaded to Supabase and `adobeDataPath` is set, the Study Companion will use it automatically for citation highlights.
