import json
import requests
import os
import time
import google.generativeai as genai
import io
import re
from PIL import Image, ImageOps

# --- Configuration ---
JSON_FILE_PATH = 'conditionContent.correct.json'
IMAGE_DIR = 'public/assets/clinical_images'
MANIFEST_FILE = 'src/data/image_manifest.json'
MISSING_LOG_FILE = 'missing_images.txt'

# --- Image Processing ---
def process_image(image_content):
    """
    Resizes, pads, and converts an image to a 1024x1024 JPG.
    """
    try:
        img = Image.open(io.BytesIO(image_content))
        img = img.convert('RGB')
        processed_img = ImageOps.pad(img, (1024, 1024), color=(0, 0, 0))
        return processed_img
    except Exception as e:
        print(f"  -> Pillow Error: Could not process image. {e}")
        return None

# --- AI and Helper Functions ---
try:
    GOOGLE_API_KEY = os.environ.get('GOOGLE_API_KEY')
    if not GOOGLE_API_KEY:
        raise ValueError("GOOGLE_API_KEY environment variable not set.")
    genai.configure(api_key=GOOGLE_API_KEY)
    gemini_model = genai.GenerativeModel('gemini-1.5-pro-latest')
except Exception as e:
    print(f"Error configuring Gemini: {e}")
    gemini_model = None

def sanitize_filename(name):
    """
    Creates a readable name and a sanitized filename from the JSON key.
    """
    readable_name = name.replace('__', ': ').replace('_', ' ').replace('CV: ', '')
    sanitized = "".join(c for c in readable_name if c.isalnum() or c in (' ', '_')).rstrip().replace(' ', '_')
    return readable_name, f"{sanitized}.jpg"

def log_missing_image(condition_name, reason):
    """
    Logs conditions for which an image could not be processed.
    """
    with open(MISSING_LOG_FILE, 'a', encoding='utf-8') as f:
        f.write(f"{condition_name}: {reason}\n")

def get_ai_analysis(condition_name, candidates):
    """
    Uses Gemini to select the best image and generate rich metadata.
    Includes a robust, multi-step JSON parsing mechanism.
    """
    if not gemini_model:
        raise ConnectionError("Gemini model is not configured.")

    prompt_candidates = "\n".join([f"Index {i}: \"{c.get('title', 'N/A')}\"" for i, c in enumerate(candidates)])
    
    prompt = f"""
    Analyze the metadata of these 5 candidates for "{condition_name}". My goal is to create a clinical flashcard for medical students.

    Candidates:
    {prompt_candidates}

    Your task is to:
    1.  Pick the best **clinical image** (e.g., photo, X-ray, ECG, CT scan). Avoid charts, graphs, and pure text slides.
    2.  Generate a concise, high-yield educational caption for it.
    3.  Identify the image modality (e.g., 'CXR', 'ECG', 'Dermatology', 'CT Abdomen', 'Microscopy').
    4.  Classify the difficulty for a medical student ('Easy', 'Medium', 'Hard').
    5.  Generate exactly 3 plausible but incorrect differential diagnoses to act as quiz distractors.
    6.  If no candidate is a suitable clinical image, set "best_candidate_index" to -1.

    Return the response as a single, clean JSON object with this exact structure:
    {{
      "best_candidate_index": <int>,
      "educational_caption": "<string>",
      "modality": "<string>",
      "difficulty": "<string>",
      "distractors": ["<string>", "<string>", "<string>"]
    }}
    """
    response = gemini_model.generate_content(
        prompt,
        generation_config={"response_mime_type": "application/json"}
    )
    
    raw_text = response.text.strip()

    # 1. First Try: Attempt direct parsing
    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        print("  -> INFO: Direct JSON parsing failed. Attempting to extract from markdown.")

    # 2. Second Try: Use regex to find a JSON code block
    try:
        match = re.search(r'```(?:json)?\s*({.*?})\s*```', raw_text, re.DOTALL)
        if match:
            json_str = match.group(1)
            return json.loads(json_str)
    except (json.JSONDecodeError, AttributeError):
        print("  -> INFO: Regex parsing failed. Attempting to slice the string.")
    
    # 3. Third Try: Find the first '{' and last '}' and slice it out
    try:
        start = raw_text.find('{')
        end = raw_text.rfind('}')
        if start != -1 and end != -1 and start < end:
            json_str = raw_text[start:end+1]
            return json.loads(json_str)
    except json.JSONDecodeError:
        print("  -> ERROR: All parsing methods failed.")

    # 4. Fallback: If all parsing fails, return None
    return None

def main():
    if not gemini_model:
        print("Exiting: Gemini model not initialized. Please check your API key.")
        return

    # Ensure output directories exist
    os.makedirs(os.path.dirname(IMAGE_DIR), exist_ok=True)
    os.makedirs(IMAGE_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(MANIFEST_FILE), exist_ok=True)
    
    manifest_data = []

    if os.path.exists(MISSING_LOG_FILE):
        os.remove(MISSING_LOG_FILE)

    try:
        with open(JSON_FILE_PATH, 'r', encoding='utf-8') as f:
            conditions_data = json.load(f)
    except Exception as e:
        print(f"Fatal Error: Could not read or parse {JSON_FILE_PATH}. {e}")
        return

    condition_keys = list(conditions_data.keys())
    total_conditions = len(condition_keys)
    print(f"Found {total_conditions} conditions to process.")

    for i, condition_key in enumerate(condition_keys):
        readable_name, file_name = sanitize_filename(condition_key)
        print(f"Processing [{i+1}/{total_conditions}]: {readable_name}...")
        time.sleep(1.5)

        try:
            # Clean the Search Query
            search_query = re.sub(r'^(ecg|cxr|derm):\s*', '', readable_name, flags=re.IGNORECASE).strip()

            response = requests.get(
                "https://openi.nlm.nih.gov/api/search",
                params={'query': search_query, 'it': 'xg', 'm': 1, 'n': 5},
                headers={'User-Agent': 'Python AI Image Scraper/3.0'},
                timeout=20
            )
            response.raise_for_status()
            candidates = response.json().get('list')
            if not candidates:
                raise ValueError("No results from NIH API for query.")

            ai_result = None
            try:
                print("  -> Asking Gemini to evaluate candidates...")
                ai_result = get_ai_analysis(readable_name, candidates)
            except Exception as e:
                print(f"  -> Gemini evaluation failed: {e}. Defaulting to index 0.")
                log_missing_image(readable_name, f"Gemini API/Parse Error: {e}")

            # Force a Selection (The Fallback)
            best_index = ai_result.get('best_candidate_index') if ai_result else -1

            if not isinstance(best_index, int) or best_index < 0 or best_index >= len(candidates):
                print("  -> WARNING: Gemini rejected all candidates. Defaulting to index 0.")
                log_missing_image(readable_name, "Gemini rejected all; fell back to index 0.")
                best_index = 0
                # Create a placeholder ai_result for the manifest
                ai_result = {
                    "educational_caption": candidates[best_index].get('title', 'N/A'),
                    "modality": "Unknown",
                    "difficulty": "Unknown",
                    "distractors": []
                }
            
            selected_candidate = candidates[best_index]
            
            image_url = selected_candidate.get('img_large')
            if not image_url:
                raise ValueError(f"Selected candidate (index {best_index}) missing 'img_large' URL")
            
            image_response = requests.get(image_url, timeout=20)
            image_response.raise_for_status()
            image_content = image_response.content
            if not image_content:
                raise ValueError("Downloaded image content is empty")

            processed_image = process_image(image_content)
            if not processed_image:
                raise ValueError("Failed to process image with Pillow.")

            image_path = os.path.join(IMAGE_DIR, file_name)
            processed_image.save(image_path, format='JPEG', quality=85, optimize=True)
            
            manifest_entry = {
                'condition': readable_name,
                'fileName': file_name,
                'caption': ai_result.get('educational_caption'),
                'modality': ai_result.get('modality'),
                'difficulty': ai_result.get('difficulty'),
                'distractors': ai_result.get('distractors'),
                'source': selected_candidate.get('source'),
                'authors': selected_candidate.get('authors')
            }
            manifest_data.append(manifest_entry)

        except Exception as e:
            print(f"  -> FAILED for '{readable_name}'. Reason: {e}")
            log_missing_image(readable_name, str(e))

    if manifest_data:
        print(f"\nWriting final manifest to '{MANIFEST_FILE}'...")
        with open(MANIFEST_FILE, 'w', encoding='utf-8') as f:
            json.dump(manifest_data, f, indent=2, ensure_ascii=False)

    print("\nScript finished.")
    if os.path.exists(MISSING_LOG_FILE):
        print(f"A log of failed conditions is in '{MISSING_LOG_FILE}'.")

if __name__ == '__main__':
    main()
