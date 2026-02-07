/**
 * Veo Cameos Video Generation Service
 * 
 * Integrates with Google AI Studio's veo_cameos to generate dynamic video
 * loops for patient encounters based on clinical state.
 * 
 * Features:
 * - Pre-generate video libraries for common clinical states
 * - On-demand generation for custom scenarios
 * - Video caching and CDN distribution
 * - Seamless loop optimization
 * 
 * @module veoCameosService
 */

import type { VideoState } from '@/types/patient-av-state-machine';

interface VeoCameosConfig {
  apiKey: string;
  apiEndpoint?: string;
}

interface VeoGenerationRequest {
  prompt: string;
  duration: number;
  loop: boolean;
  style: 'realistic' | 'cartoon' | 'medical_illustration';
  aspectRatio?: '16:9' | '4:3' | '1:1';
  referenceImages?: string[]; // URLs of reference images for consistent patient appearance
}

interface VeoGenerationResponse {
  videoId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  thumbnailUrl?: string;
  duration: number;
  estimatedCompletionTime?: number; // seconds
  error?: string;
}

/**
 * Clinical state to video prompt templates.
 */
const VIDEO_PROMPT_TEMPLATES = {
  // Respiratory states
  'copd_mild': '{{age}}yo {{gender}} in {{environment}}, sitting upright, mild dyspnea, nasal cannula, pursed-lip breathing, looking at camera',
  'copd_severe': '{{age}}yo {{gender}} in {{environment}}, severe dyspnea, tripod position, accessory muscle use, high-flow oxygen, distressed expression',
  'asthma_attack': '{{age}}yo {{gender}} in {{environment}}, acute asthma, sitting forward, anxious expression, respiratory distress, nebulizer mask',
  
  // Cardiovascular states
  'chest_pain_cardiac': '{{age}}yo {{gender}} in {{environment}}, clutching chest, Levine sign, diaphoresis, grimacing, cardiac monitor visible',
  'heart_failure': '{{age}}yo {{gender}} in {{environment}}, dyspnea, orthopnea, elevated head of bed, fatigued expression',
  
  // Neurological states
  'stroke_acute': '{{age}}yo {{gender}} in {{environment}}, facial droop, arm weakness, confused expression, CT scanner in background',
  'seizure_postictal': '{{age}}yo {{gender}} in {{environment}}, confused, disoriented, fatigued, side-lying position',
  
  // Pain states
  'abdominal_pain_severe': '{{age}}yo {{gender}} in {{environment}}, curled in fetal position, grimacing, hands on abdomen',
  'renal_colic': '{{age}}yo {{gender}} in {{environment}}, writhing in pain, unable to find comfortable position, severe distress',
  
  // Trauma states
  'trauma_stable': '{{age}}yo {{gender}} in {{environment}}, c-spine immobilization, alert, trauma bay setting',
  'trauma_critical': '{{age}}yo {{gender}} in {{environment}}, trauma bay, multiple IVs, oxygen mask, resuscitation in progress',
  
  // Baseline/stable states
  'stable_pleasant': '{{age}}yo {{gender}} in {{environment}}, calm, making eye contact, cooperative demeanor',
  'stable_anxious': '{{age}}yo {{gender}} in {{environment}}, fidgeting, worried expression, frequent glances around',
  'stable_confused': '{{age}}yo {{gender}} in {{environment}}, disoriented, puzzled expression, slow responses',
};

/**
 * Environment-specific scene descriptors.
 */
const ENVIRONMENT_DESCRIPTORS = {
  emergency_department: 'ED trauma bay with cardiac monitor, IV pole, medical equipment visible in background',
  clinic: 'outpatient exam room with examination table, blood pressure cuff, neutral medical office decor',
  home: 'residential living room with couch, home furnishings, natural lighting',
  ambulance: 'ambulance interior with medical equipment, stretcher, paramedic visible',
};

/**
 * Pre-defined patient demographics for consistent appearance.
 * Use reference images to maintain same "actor" across multiple states.
 */
interface PatientDemographics {
  age: number;
  gender: 'male' | 'female' | 'nonbinary';
  ethnicity?: string;
  bodyType?: string;
  referenceImageUrl?: string;
}

export class VeoCameosService {
  private config: VeoCameosConfig;
  private generationCache: Map<string, VeoGenerationResponse> = new Map();

  constructor(config: VeoCameosConfig) {
    this.config = {
      apiEndpoint: 'https://generativelanguage.googleapis.com/v1/models/veo-2:generate',
      ...config,
    };
  }

  /**
   * Generate a video loop for a given clinical state.
   */
  async generateVideo(
    stateId: string,
    demographics: PatientDemographics,
    environment: VideoState['environment'],
    options: {
      style?: VeoGenerationRequest['style'];
      customPrompt?: string;
    } = {}
  ): Promise<VeoGenerationResponse> {
    const cacheKey = `${stateId}-${demographics.age}-${demographics.gender}-${environment}`;

    // Check cache
    const cached = this.generationCache.get(cacheKey);
    if (cached && cached.status === 'completed') {
      return cached;
    }

    // Build prompt
    const prompt = options.customPrompt ?? this.buildPrompt(stateId, demographics, environment);

    const request: VeoGenerationRequest = {
      prompt,
      duration: 5, // 5-second loop for seamless playback
      loop: true,
      style: options.style ?? 'realistic',
      aspectRatio: '16:9',
      referenceImages: demographics.referenceImageUrl ? [demographics.referenceImageUrl] : undefined,
    };

    // Submit generation request
    const response = await this.submitGenerationRequest(request);

    // Cache result
    this.generationCache.set(cacheKey, response);

    return response;
  }

  /**
   * Build video prompt from template and demographics.
   */
  private buildPrompt(
    stateId: string,
    demographics: PatientDemographics,
    environment: VideoState['environment']
  ): string {
    const template = VIDEO_PROMPT_TEMPLATES[stateId as keyof typeof VIDEO_PROMPT_TEMPLATES];
    if (!template) {
      throw new Error(`No prompt template found for state: ${stateId}`);
    }

    const envDescriptor =
      ENVIRONMENT_DESCRIPTORS[environment as keyof typeof ENVIRONMENT_DESCRIPTORS] ??
      'clinical setting';

    return template
      .replace('{{age}}', String(demographics.age))
      .replace('{{gender}}', demographics.gender)
      .replace('{{environment}}', envDescriptor);
  }

  /**
   * Submit video generation request to veo_cameos API.
   */
  private async submitGenerationRequest(
    request: VeoGenerationRequest
  ): Promise<VeoGenerationResponse> {
    try {
      const endpoint = this.config.apiEndpoint ?? 'https://generativelanguage.googleapis.com/v1/models/veo-2:generate';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: request.prompt,
                },
              ],
            },
          ],
          generationConfig: {
            videoDuration: request.duration,
            loop: request.loop,
            style: request.style,
            aspectRatio: request.aspectRatio,
          },
          safetySettings: [
            {
              category: 'HARM_CATEGORY_MEDICAL',
              threshold: 'BLOCK_NONE', // Allow medical content
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Veo API error: ${response.status} ${errorText}`);
      }

      const data = (await response.json()) as {
        status?: string;
        videoId?: string;
        videoUrl?: string;
        uri?: string;
        thumbnailUrl?: string;
      };

      // Poll for completion if async
      if (data.status === 'pending' || data.status === 'processing') {
        const opId = data.videoId ?? `veo-${Date.now()}`;
        return await this.pollForCompletion(opId);
      }

      return {
        videoId: data.videoId ?? `veo-${Date.now()}`,
        status: (data.status as VeoGenerationResponse['status']) ?? 'completed',
        videoUrl: data.videoUrl ?? data.uri,
        thumbnailUrl: data.thumbnailUrl,
        duration: request.duration,
      };
    } catch (error: unknown) {
      console.error('Veo generation error:', error);
      return {
        videoId: `error-${Date.now()}`,
        status: 'failed',
        duration: 0,
        error: String(error),
      };
    }
  }

  /**
   * Poll for video generation completion.
   */
  private async pollForCompletion(
    videoId: string,
    maxAttempts: number = 30,
    intervalMs: number = 2000
  ): Promise<VeoGenerationResponse> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));

      const endpoint = this.config.apiEndpoint ?? 'https://generativelanguage.googleapis.com/v1/models/veo-2:generate';
      const response = await fetch(
        `${endpoint}/operations/${videoId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to poll status: ${response.statusText}`);
      }

      const data = (await response.json()) as {
        status?: string;
        videoUrl?: string;
        uri?: string;
        thumbnailUrl?: string;
        duration?: number;
        error?: string;
      };

      if (data.status === 'completed') {
        return {
          videoId,
          status: 'completed',
          videoUrl: data.videoUrl ?? data.uri,
          thumbnailUrl: data.thumbnailUrl,
          duration: data.duration ?? 5,
        };
      } else if (data.status === 'failed') {
        return {
          videoId,
          status: 'failed',
          duration: 0,
          error: data.error ?? 'Generation failed',
        };
      }
    }

    throw new Error(`Video generation timed out after ${maxAttempts * intervalMs / 1000}s`);
  }

  /**
   * Pre-generate a library of common clinical state videos.
   * Run this during case creation to avoid real-time generation delays.
   */
  async preGenerateLibrary(
    demographics: PatientDemographics,
    environment: VideoState['environment'],
    states: string[]
  ): Promise<Map<string, VeoGenerationResponse>> {
    const results = new Map<string, VeoGenerationResponse>();

    for (const stateId of states) {
      try {
        const result = await this.generateVideo(stateId, demographics, environment);
        results.set(stateId, result);
        
        // Rate limiting: wait 1s between requests
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed to generate video for state ${stateId}:`, error);
        results.set(stateId, {
          videoId: `error-${stateId}`,
          status: 'failed',
          duration: 0,
          error: String(error),
        });
      }
    }

    return results;
  }

  /**
   * Get cached video or return fallback.
   */
  getCachedVideo(
    stateId: string,
    demographics: PatientDemographics,
    environment: VideoState['environment']
  ): VeoGenerationResponse | null {
    const cacheKey = `${stateId}-${demographics.age}-${demographics.gender}-${environment}`;
    return this.generationCache.get(cacheKey) ?? null;
  }

  /**
   * Clear generation cache.
   */
  clearCache(): void {
    this.generationCache.clear();
  }
}

/**
 * Factory function for creating VeoCameosService.
 */
export function createVeoCameosService(apiKey: string): VeoCameosService {
  return new VeoCameosService({ apiKey });
}

/**
 * Example: Pre-generate COPD case video library.
 */
export async function preGenerateCOPDCase(
  service: VeoCameosService,
  demographics: PatientDemographics
): Promise<Map<string, VeoGenerationResponse>> {
  const states = ['copd_mild', 'copd_severe', 'stable_pleasant'];
  return await service.preGenerateLibrary(demographics, 'emergency_department', states);
}

/**
 * Example: Pre-generate MI case video library.
 */
export async function preGenerateMICase(
  service: VeoCameosService,
  demographics: PatientDemographics
): Promise<Map<string, VeoGenerationResponse>> {
  const states = ['chest_pain_cardiac', 'stable_anxious', 'stable_pleasant'];
  return await service.preGenerateLibrary(demographics, 'emergency_department', states);
}
