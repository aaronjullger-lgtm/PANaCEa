import os
import json
import google.generativeai as genai
import textwrap
from PIL import Image
import re

# --- Configuration ---
# 1. Set up your API key.
#    The script will look for 'GEMINI_API_KEY' or 'GOOGLE_API_KEY' in your environment variables.
API_KEY = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')

if not API_KEY:
    raise ValueError("API key not found. Please set either 'GEMINI_API_KEY' or 'GOOGLE_API_KEY' environment variable.")

# 2. Specify the path to your JSON data file.
CONDITION_DATA_FILE = 'conditionContent.correct.json'

# 3. Specify the path to your style reference image.
STYLE_REFERENCE_IMAGE = 'style_image.png' 

# 4. Specify the output directory for the generated infographics.
OUTPUT_DIR = 'infographics'

# --- API and Model Setup ---
genai.configure(api_key=API_KEY)
# Using a model that supports vision (image inputs)
model = genai.GenerativeModel('gemini-1.0-pro-vision-latest') 

# --- Helper Functions ---
def format_title(key):
    """Converts a key like 'CV__ecg__normal_sinus_rhythm_nsr' to a readable title."""
    # Remove the prefix and replace underscores with spaces
    title_str = re.sub(r'^CV__.*?__', '', key).replace('_', ' ')
    # Capitalize words, but handle acronyms
    return ' '.join([word.upper() if len(word) <= 3 else word.capitalize() for word in title_str.split()])

def format_section(data):
    """Formats a section's data (string, list, or dict) for the prompt."""
    if not data or data == ["--"]:
        return "Not specified."
    if isinstance(data, dict):
        return '\n'.join([f"- {key.capitalize()}: {value}" for key, value in data.items() if value])
    elif isinstance(data, list):
        return '\n'.join([f"- {item}" for item in data if item])
    # Clean up markdown-like emphasis
    return str(data).replace('**', '').replace('*', '')

def create_detailed_prompt(condition_key, condition_data):
    """Creates a detailed, well-structured prompt for the Gemini API."""
    
    title = format_title(condition_key)

    # Map JSON keys to user-friendly section titles, using .get() for safety
    sections = {
        "OVERVIEW": format_section(condition_data.get('overview')),
        "CLINICAL PRESENTATION": format_section(condition_data.get('clinicalPresentation')),
        "ETIOLOGY & PATHOPHYSIOLOGY": format_section(condition_data.get('etiologyPathophysiology')),
        "EPIDEMIOLOGY": format_section(condition_data.get('epidemiology')),
        "DIAGNOSIS": format_section(condition_data.get('diagnostics')),
        "TREATMENT": format_section(condition_data.get('treatment')),
        "MANAGEMENT": format_section(condition_data.get('management')),
        "PROGNOSIS": format_section(condition_data.get('prognosis')),
        "COMPLICATIONS": format_section(condition_data.get('complications')),
        "RISK FACTORS": format_section(condition_data.get('riskFactors')),
        "SYMPTOMS": format_section(condition_data.get('symptoms')),
        "EXAM FINDINGS": format_section(condition_data.get('examFindings')),
    }

    # Build the content part of the prompt
    content_str = ""
    for section_title, section_content in sections.items():
        if "Not specified" not in section_content:
            content_str += f"\n**{section_title}:**\n{section_content}\n"

    prompt = textwrap.dedent(f'''
        Create a high-quality, professional medical infographic titled "{title}".

        **STYLE INSTRUCTIONS:**
        - Emulate the precise design, layout, color palette, and iconography style of the provided reference image.
        - The layout must be clean, organized, and easy to read, similar to the multi-panel design in the example.
        - Text must be sharp, perfectly legible, and well-integrated.
        - Generate simple, relevant icons for each major section header.
        - The overall tone must be educational and authoritative for a medical audience.

        **INFOGRAPHIC CONTENT:**
        Please visually represent the following information in distinct, clearly-labeled sections:
        {content_str}
    ''')
    
    return prompt

def generate_infographic(prompt, style_image_path):
    """Calls the Gemini API to generate the image."""
    print("  - Sending request to Gemini API...")
    
    try:
        style_image = Image.open(style_image_path)
        
        response = model.generate_content([prompt, style_image], stream=False)
        response.resolve()
        
        if response.parts:
            for part in response.parts:
                if 'image' in part.mime_type:
                    print("  - Image data received successfully.")
                    return part.data
        
        # If no image part is found, print an error with the response text
        error_text = response.text if hasattr(response, 'text') else 'No textual response available.'
        print(f"  - WARNING: Image data not found in response. API message: {error_text}")
        return None

    except Exception as e:
        print(f"  - ERROR: An error occurred during the API call: {e}")
        return None

def main():
    """Main function to drive the infographic generation process."""
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)

    try:
        with open(CONDITION_DATA_FILE, 'r', encoding='utf-8') as f:
            conditions_data = json.load(f)
    except FileNotFoundError:
        print(f"Error: The file '{CONDITION_DATA_FILE}' was not found.")
        return
    except json.JSONDecodeError as e:
        print(f"Error: Could not decode JSON from '{CONDITION_DATA_FILE}'. Details: {e}")
        return

    if not os.path.exists(STYLE_REFERENCE_IMAGE):
        print(f"Error: Style reference image '{STYLE_REFERENCE_IMAGE}' not found.")
        return
        
    print(f"Found {len(conditions_data)} conditions to process.")

    for condition_key, condition_content in conditions_data.items():
        # Sanitize the key to create a valid filename
        safe_filename = re.sub(r'[^a-zA-Z0-9_-]', '', condition_key)
        print(f"\n--- Processing: {format_title(condition_key)} ---")

        prompt = create_detailed_prompt(condition_key, condition_content)
        
        image_data = generate_infographic(prompt, STYLE_REFERENCE_IMAGE)
        
        if image_data:
            output_path = os.path.join(OUTPUT_DIR, f'{safe_filename}.png')
            try:
                with open(output_path, 'wb') as img_file:
                    img_file.write(image_data)
                print(f"  - Successfully saved infographic to '{output_path}'")
            except Exception as e:
                print(f"  - ERROR: Could not save image to '{output_path}'. Details: {e}")
        else:
            print(f"  - Failed to generate infographic for '{condition_key}'.")

    print("\n--- All conditions processed. ---")


if __name__ == '__main__':
    main()
