# 3D Spatial Bounding Boxes for Anatomy

> **Goal:** Move beyond 2D boxes (rectangles on a photo) to **3D spatial understanding** using Gemini's ability to infer depth, orientation, and volume from 2D images. Critical for anatomy where **orientation** of a structure (e.g., talus) matters as much as location.

## Tech Stack

| Layer | Choice | Role |
|-------|--------|------|
| Model | **Gemini 2.5 Pro** or **Gemini 3 Pro (Preview)** | Trained to output explicit 3D coordinates relative to the object's physical space |
| Output format | **9-parameter 3D bounding box** | `[x_center, y_center, z_center, x_size, y_size, z_size, roll, pitch, yaw]` |
| Visualization | **Three.js** or **React Three Fiber** | Map 3D coordinates to a 3D canvas; cannot render as a simple 2D div overlay |

## Prompt Engineering

Request the 9-point 3D bounding box format explicitly:

```text
Detect the femur and the tibia.
Output a JSON list where each entry contains the "label" and its "box_3d".
The 3D bounding box format must be [x_center, y_center, z_center, x_size, y_size, z_size, roll, pitch, yaw].
```

Coordinates are in **meters or normalized units**; the frontend must map them to a 3D scene (e.g., wireframe box for each bone).

## Reference: Python (google.genai)

```python
import google.genai as genai
from google.genai import types

client = genai.Client(api_key="YOUR_API_KEY")
image = client.files.upload(file="femur_fracture_ap_view.jpg")

prompt = """
Detect the femur and the tibia.
Output a json list where each entry contains the "label" and its "box_3d".
The 3D bounding box format must be [x_center, y_center, z_center, x_size, y_size, z_size, roll, pitch, yaw].
"""

response = client.models.generate_content(
    model="gemini-2.5-pro",  # or gemini-3-pro-preview
    contents=[image, prompt],
    config=types.GenerateContentConfig(response_mime_type="application/json")
)
# Example: [{"label": "femur", "box_3d": [0.14, 3.74, -0.71, ...]}, ...]
```

## Implementation in This Repo (Edge / TypeScript)

- **API:** `POST /api/vision/analyze-3d` (see `functions/api/vision/analyze-3d.ts`).
- **Input:** `imageBase64`, `mimeType`, optional `labels` (e.g. `["femur", "tibia"]`) to constrain detection.
- **Output:** `{ data: { boxes: Array<{ label: string; box_3d: [number, number, number, number, number, number, number, number, number] }> } }`.
- **Pattern:** Same as `vision/analyze` — authenticated, rate-limited, `fetch` to Gemini REST API with `responseMimeType: "application/json"`. No Node APIs; Edge-safe.

## Visualization

- **Do not** draw a 2D div on the image; 3D coordinates (center, size, roll/pitch/yaw) require a 3D scene.
- **Options:**
  - **Three.js** (or **React Three Fiber**): Create a scene, camera, and for each `box_3d` render a wireframe box at `(x_center, y_center, z_center)` with dimensions `(x_size, y_size, z_size)` and rotation `(roll, pitch, yaw)`.
  - **Alternative:** Side-by-side view: original 2D image + a separate 3D canvas showing the inferred bones as oriented boxes (e.g., for “Clinical Eye” anatomy mode).
- **Units:** Confirm with the model whether values are in meters or 0–1 normalized; scale the 3D scene accordingly.

## PANCE / Product Alignment

- **Applying Basic Scientific Concepts (8%):** Anatomy orientation (e.g., talus position in ankle) is often tested.
- **Sterile Field Guardian (High-Leverage Idea #3):** Same 3D spatial pipeline can be reused for “bounding box for sterile drape” and “bounding box for hand” with trajectory logic.
- **Spot the Hallucination (High-Leverage Idea #5):** 3D boxes can encode “expected” anatomy; student’s answer can be compared against expected region.

## API Contract (Implemented)

- **Endpoint:** `POST /api/vision/analyze-3d`
- **Body:** `{ imageBase64: string, mimeType?: string, labels?: string[], prompt?: string }`
- **Response:** `{ data: { boxes: Array<{ label: string; box_3d: [number×9] }>, usageMetadata?: object } }`
- **Auth:** Required (same as `/api/vision/analyze`). Rate-limited per identifier.

## References

- High-leverage product ideas: `docs/HIGH_LEVERAGE_PRODUCT_IDEAS.md`
- Existing 2D vision API: `functions/api/vision/analyze.ts` (bounding_box as `[ymin, xmin, ymax, xmax]`)
