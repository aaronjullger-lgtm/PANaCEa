import json
import requests
import os
import time
import google.generativeai as genai
import io
from PIL import Image, ImageOps

# --- Configuration ---
JSON_FILE_PATH = 'conditionContent.correct.json'
IMAGE_DIR = 'public/assets/clinical_images' # Updated path
MANIFEST_FILE = 'src/data/image_manifest.json' # Updated path
MISSING_LOG_FILE = 'missing_images.txt'

# 1. Image Processing Function
def process_image(image_content):
    """
    Resizes, pads, and converts an image to a 1024x1024 JPG.
    """
    try:
        # Open image from in-memory bytes
        img = Image.open(io.BytesIO(image_content))
        # Convert to 'RGB' to handle formats like PNG, GIF, etc.
        img = img.convert('RGB')
        # Pad the image to a 1024x1024 square with a black background
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
    gemini_model = genai.GenerativeModel('gemini-2.5-pro')
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

# 2. The Upgraded Gemini Prompt and Function
def get_ai_analysis(condition_name, candidates):
    """
    Uses Gemini to select the best image and generate rich metadata.
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
    return json.loads(response.text)

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
    except FileNotFoundError:
        print(f"Error: The file '{JSON_FILE_PATH}' was not found.")
        return
    except json.JSONDecodeError:
        print(f"Error: Could not decode JSON from '{JSON_FILE_PATH}'.")
        return

    condition_keys = list(conditions_data.keys())
    total_conditions = len(condition_keys)
    print(f"Found {total_conditions} conditions to process.")

    for i, condition_key in enumerate(condition_keys):
        readable_name, file_name = sanitize_filename(condition_key)
        print(f"Processing [{i+1}/{total_conditions}]: {readable_name}...")
        time.sleep(1.5)

        try:
            # NIH Search
            response = requests.get(
                "https://openi.nlm.nih.gov/api/search",
                params={'query': readable_name, 'it': 'xg', 'm': 1, 'n': 5},
                headers={'User-Agent': 'Python AI Image Scraper/2.0'},
                timeout=20
            )
            response.raise_for_status()
            candidates = response.json().get('list')
            if not candidates:
                raise ValueError("No results from NIH API")

            # AI Analysis and Selection
            ai_result = get_ai_analysis(readable_name, candidates)
            best_index = ai_result.get('best_candidate_index')

            if not isinstance(best_index, int) or best_index < 0 or best_index >= len(candidates):
                raise ValueError("Gemini did not select a valid candidate index.")
            
            print(f"  -> Gemini selected index {best_index}.")
            selected_candidate = candidates[best_index]
            
            # Download Image Content
            image_url = selected_candidate.get('img_large')
            if not image_url:
                raise ValueError("Selected candidate missing 'img_large' URL")
            
            image_response = requests.get(image_url, timeout=20)
            image_response.raise_for_status()
            image_content = image_response.content
            if not image_content:
                raise ValueError("Downloaded image content is empty")

            # Process and Save Image
            processed_image = process_image(image_content)
            if not processed_image:
                raise ValueError("Failed to process image with Pillow.")

            # 4. File Saving
            image_path = os.path.join(IMAGE_DIR, file_name)
            processed_image.save(image_path, format='JPEG', quality=85, optimize=True)
            
            # 3. The Manifest Structure
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
