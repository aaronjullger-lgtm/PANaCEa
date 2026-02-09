/**
 * Open-i (NLM) API Client - Fetch Open-Source Medical Images
 * 
 * Open-i aggregates medical images from MedPix, PubMed Central, and other
 * open-access sources. This client wraps the Open-i search API.
 * 
 * @see https://openi.nlm.nih.gov/faq#collection
 */

export interface OpenIImage {
  imageUrl: string;
  title: string;
  caption: string;
  source: string;
  license: string;
  meshTerms: string[];
}

export interface SearchOpenIOptions {
  maxResults?: number;
  imageType?: 'xg' | 'all'; // xg = X-ray/Graphics only
}

/**
 * Search Open-i for medical images matching the query.
 * 
 * @param query - Medical condition or keyword (e.g., "Pneumonia")
 * @param options - Search options
 * @returns Array of image candidates with metadata
 */
export async function searchOpenI(
  query: string,
  options: SearchOpenIOptions = {}
): Promise<OpenIImage[]> {
  const { maxResults = 10, imageType = 'all' } = options;

  const params = new URLSearchParams({
    query,
    m: maxResults.toString(),
  });

  if (imageType === 'xg') {
    params.set('it', 'xg');
  }

  const url = `https://openi.nlm.nih.gov/api/search?${params}`;

  const data = await fetchWithRetry(url);
  return parseOpenIResponse(data);
}

/**
 * Fetch with exponential backoff retry for rate limits and server errors.
 */
async function fetchWithRetry(url: string, maxAttempts = 3): Promise<any> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'PANaCEa-Hunter-Gatherer/1.0',
        },
      });

      if (shouldRetry(res.status, attempt, maxAttempts)) {
        const delay = Math.pow(2, attempt) * 1000;
        await sleep(delay);
        continue;
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Open-i API error ${res.status}: ${text.slice(0, 200)}`);
      }

      return await res.json();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxAttempts - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error('Open-i API request failed after retries');
}

function shouldRetry(status: number, attempt: number, maxAttempts: number): boolean {
  if (status === 429) return true; // Rate limited
  if (status >= 500 && attempt < maxAttempts - 1) return true; // Server error
  return false;
}

/**
 * Parse Open-i API response into standardized image objects.
 * 
 * Open-i response structure (observed):
 * {
 *   "list": [
 *     {
 *       "imgLarge": "/imgs/512/123_abc.jpg",
 *       "imgThumb": "/imgs/100/123_abc.jpg",
 *       "title": "...",
 *       "abstract": "...",
 *       "modality": "CT",
 *       "collection": "MedPix",
 *       "license": "...",
 *       "MeSH": ["Pneumonia", "Lung"]
 *     }
 *   ]
 * }
 */
function parseOpenIResponse(data: any): OpenIImage[] {
  const results: OpenIImage[] = [];
  const list = data?.list || [];

  for (const item of list) {
    // Open-i returns relative paths - prepend base URL
    const imgPath = item.imgLarge || item.imgGrid || item.imgThumb;
    if (!imgPath) continue;

    const imageUrl = imgPath.startsWith('http')
      ? imgPath
      : `https://openi.nlm.nih.gov${imgPath}`;

    results.push({
      imageUrl,
      title: item.title || item.name || 'Untitled',
      caption: item.abstract || item.caption || '',
      source: item.collection || item.source || 'Open-i',
      license: item.license || 'Unknown',
      meshTerms: Array.isArray(item.MeSH) ? item.MeSH : [],
    });
  }

  return results;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
