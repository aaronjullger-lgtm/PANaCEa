import json
import requests
import os
import time
import google.generativeai as genai
import io
import re
from PIL import Image, ImageOps
from google.generativeai.types import HarmCategory, HarmBlockThreshold # Added import for safety settings

# --- Configuration ---
JSON_FILE_PATH = 'conditionContent.correct.json'
IMAGE_DIR = 'public/assets/clinical_images'
MANIFEST_FILE = 'src/data/image_manifest.json'
MISSING_LOG_FILE = 'missing_images.txt'
API_REQUEST_DELAY = 2.0  # Increased delay for politeness and rate-limiting
GEMINI_MODEL_NAME = 'gemini-2.5-pro' # Use a clearer variable name

# --- Image Processing ---
def process_image(image_content):
    """
    Resizes, pads, and converts an image to a 1024x1024 JPG.
    """
    try:
        img = Image.open(io.BytesIO(image_content))
        img = img.convert('RGB')
        # Use ImageOps.pad for 1024x1024 square, maintaining aspect ratio with black padding
        processed_img = ImageOps.pad(img, (1024, 1024), color=(0, 0, 0))
        return processed_img
    except Exception as e:
        # Added traceback to get more detail on Pillow errors
        import traceback
        print(f"  -> Pillow Error: Could not process image. {e}")
        print(traceback.format_exc())
        return None

# --- AI and Helper Functions ---
gemini_model = None # Initialize outside try/except
try:
    # 1. API Key Check and Configuration
    GOOGLE_API_KEY = os.environ.get('GOOGLE_API_KEY')
    if not GOOGLE_API_KEY:
        raise ValueError("GOOGLE_API_KEY environment variable not set.")
    genai.configure(api_key=GOOGLE_API_KEY)
    
    # 2. Add safety configuration for clinical content
    safety_settings = [
        # Blocking HARASSMENT and HATE_SPEECH is usually good practice.
        # Set MEDICAL to BLOCK_ONLY_HIGH to avoid blocking clinical image analysis.
        {"category": HarmCategory.HARM_CATEGORY_HARASSMENT, "threshold": HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE},
        {"category": HarmCategory.HARM_CATEGORY_HATE_SPEECH, "threshold": HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE},
        {"category": HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, "threshold": HarmBlockThreshold.BLOCK_ONLY_HIGH},
        {"category": HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, "threshold": HarmBlockThreshold.BLOCK_ONLY_HIGH},
        {"category": HarmCategory.HARM_CATEGORY_MEDICAL, "threshold": HarmBlockThreshold.BLOCK_ONLY_HIGH},
    ]

    # Initialize the model instance
    gemini_model = genai.GenerativeModel(
        GEMINI_MODEL_NAME, 
        safety_settings=safety_settings # Added safety settings
    )
    
except Exception as e:
    print(f"Error configuring Gemini: {e}")

def sanitize_filename(name):
    """
    Creates a readable name and a sanitized filename from the JSON key.
    """
    readable_name = name.replace('__', ': ').replace('_', ' ').replace('CV: ', '')
    # Improved sanitization: only keep alphanumeric characters, hyphens, and underscores
    sanitized = "".join(c for c in readable_name if c.isalnum() or c in (' ', '_', '-')).rstrip().replace(' ', '_').replace('-', '_')
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

    # 3. Use an f-string for generating the list for improved readability
    prompt_candidates = "\n".join([
        f"Index {i}: Title: \"{c.get('title', 'N/A')}\", Source: \"{c.get('source', 'Unknown')}\"" 
        for i, c in enumerate(candidates)
    ])
    
    prompt = f"""
    Analyze the metadata of these 5 candidates for the clinical condition: **"{condition_name}"**. My goal is to create a clinical flashcard for medical students.

    Candidates:
    {prompt_candidates}

    Your task is to:
    1. Pick the best **clinical image** (e.g., photo, X-ray, ECG, CT scan). **Prioritize images that show the pathology visually.** Avoid charts, graphs, and pure text slides.
    2. Generate a concise, high-yield educational caption for the chosen image.
    3. Identify the image modality (e.g., 'CXR', 'ECG', 'Dermatology', 'CT Abdomen', 'Microscopy').
    4. Classify the difficulty for a medical student ('Easy', 'Medium', 'Hard').
    5. Generate exactly 3 plausible but incorrect differential diagnoses to act as quiz distractors.
    6. If no candidate is a suitable clinical image, set "best_candidate_index" to -1.

    Return the response as a single, clean JSON object with this **exact structure** (ensure the strings are valid JSON strings):
    {{
      "best_candidate_index": <int>,
      "educational_caption": "<string>",
      "modality": "<string>",
      "difficulty": "<string>",
      "distractors": ["<string>", "<string>", "<string>"]
    }}
    """
    
    # 4. Implement retry logic for API calls
    for attempt in range(3):
        try:
            response = gemini_model.generate_content(
                prompt,
                config={"response_mime_type": "application/json"} # Using 'config' for clarity
            )
            raw_text = response.text.strip()
            break # Exit loop on success
        except Exception as e:
            print(f"  -> Gemini API Call failed (Attempt {attempt+1}): {e}")
            if attempt == 2:
                raise # Re-raise error after all attempts fail
            time.sleep(API_REQUEST_DELAY * 2) # Wait longer on failure

    # The rest of the parsing logic (1, 2, 3) remains good for robustness
    # ... (Your robust JSON parsing logic is kept below)
    
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
        print("  -> ERROR: All JSON parsing methods failed.")

    # 4. Fallback: If all parsing fails, return None
    return None

def main():
    if not gemini_model:
        print("Exiting: Gemini model not initialized. Please check your API key and configuration.")
        return

    # Ensure output directories exist
    os.makedirs(os.path.dirname(IMAGE_DIR), exist_ok=True)
    os.makedirs(IMAGE_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(MANIFEST_FILE), exist_ok=True)
    
    manifest_data = []

    # Removed os.remove(MISSING_LOG_FILE) - It's often better to append and review previous runs.
    # If you want to clear it, uncomment the line below:
    # if os.path.exists(MISSING_LOG_FILE):
    #     os.remove(MISSING_LOG_FILE) 

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
        print(f"\nProcessing [{i+1}/{total_conditions}]: {readable_name}...") # Added newline for clarity
        
        # 5. Only delay for the API call to NIH, not for local operations
        time.sleep(API_REQUEST_DELAY) 

        try:
            # Clean the Search Query
            search_query = re.sub(r'^(ecg|cxr|derm):\s*', '', readable_name, flags=re.IGNORECASE).strip()

            # NIH API Call with Retry
            nih_response = None
            for attempt in range(3):
                try:
                    nih_response = requests.get(
                        "https://openi.nlm.nih.gov/api/search",
                        params={'query': search_query, 'it': 'xg', 'm': 1, 'n': 5},
                        headers={'User-Agent': 'Python AI Image Scraper/3.0'},
                        timeout=30 # Increased timeout for slow image servers
                    )
                    nih_response.raise_for_status()
                    break # Success
                except requests.exceptions.RequestException as req_e:
                    print(f"  -> NIH API Request failed (Attempt {attempt+1}): {req_e}")
                    if attempt == 2:
                        raise # Re-raise error after all attempts fail
                    time.sleep(API_REQUEST_DELAY * 2) # Wait longer on failure
            
            if nih_response is None:
                raise requests.exceptions.RequestException("Failed to get NIH response after retries.")

            candidates = nih_response.json().get('list')
            if not candidates:
                raise ValueError("No results from NIH API for query.")

            ai_result = None
            try:
                print("  -> Asking Gemini to evaluate candidates...")
                ai_result = get_ai_analysis(readable_name, candidates)
            except Exception as e:
                # Catching specific exceptions here would be better but keeping general for simplicity
                print(f"  -> Gemini evaluation failed: {e}. Defaulting to index 0.")
                log_missing_image(readable_name, f"Gemini API/Parse Error: {e}")

            # --- Selection Logic ---
            best_index = ai_result.get('best_candidate_index') if ai_result and isinstance(ai_result.get('best_candidate_index'), int) else -1

            if best_index < 0 or best_index >= len(candidates):
                print("  -> WARNING: Gemini rejected all candidates or returned invalid index. Defaulting to index 0.")
                # We log this, but we force a default action so we don't skip the condition entirely.
                log_missing_image(readable_name, "Gemini rejected all; fell back to index 0.")
                best_index = 0
                
                # Re-initialize ai_result with placeholder data for the manifest
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
            
            # Image Download and Processing (with Retry)
            print(f"  -> Downloading image from: {image_url}")
            image_content = None
            for attempt in range(3):
                try:
                    image_response = requests.get(image_url, timeout=30)
                    image_response.raise_for_status()
                    image_content = image_response.content
                    if not image_content:
                        raise ValueError("Downloaded image content is empty")
                    break # Success
                except requests.exceptions.RequestException as req_e:
                    print(f"  -> Image Download failed (Attempt {attempt+1}): {req_e}")
                    if attempt == 2:
                        raise # Re-raise error after all attempts fail
                    time.sleep(API_REQUEST_DELAY) # Wait before retry
            
            if image_content is None:
                raise ValueError("Failed to download image content after retries.")
                
            processed_image = process_image(image_content)
            if not processed_image:
                raise ValueError("Failed to process image with Pillow.")

            image_path = os.path.join(IMAGE_DIR, file_name)
            processed_image.save(image_path, format='JPEG', quality=85, optimize=True)
            print(f"  -> Image saved successfully: {file_name}")

            # Append to manifest
            manifest_entry = {
                'condition': readable_name,
                'fileName': file_name,
                'caption': ai_result.get('educational_caption', selected_candidate.get('title', 'N/A')), # Fallback for caption
                'modality': ai_result.get('modality'),
                'difficulty': ai_result.get('difficulty'),
                'distractors': ai_result.get('distractors'),
                'source': selected_candidate.get('source'),
                'authors': selected_candidate.get('authors')
            }
            manifest_data.append(manifest_entry)

        except Exception as e:
            # Catch-all for a specific condition failing
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
