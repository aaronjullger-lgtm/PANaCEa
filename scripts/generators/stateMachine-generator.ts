/**
 * State Machine Generator
 * 
 * Uses Gemini to generate PatientAVStateMachine JSON for clinical cases.
 * 
 * Usage:
 * ```bash
 * npx ts-node scripts/generators/stateMachine-generator.ts "Shortness of Breath" "COPD"
 * ```
 */

import { StateMachineBuilder } from '../../services/av/patientAVEngine';
import type { PatientAVStateMachine, ClinicalTrigger, AVState } from '../../types/patient-av-state-machine';

// Gemini API configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
const GEMINI_MODEL = 'gemini-2.0-flash-exp'; // Latest preview model

/**
 * Generate state machine using Gemini.
 */
async function generateStateMachine(
  chiefComplaint: string,
  diagnosis: string,
  patientAge: number = 60,
  patientSex: 'M' | 'F' = 'M'
): Promise<PatientAVStateMachine> {
  const prompt = `You are a clinical simulation expert. Generate a JSON state machine for a patient encounter simulation.

**Case Details:**
- Chief Complaint: ${chiefComplaint}
- Diagnosis: ${diagnosis}
- Patient: ${patientAge}yo ${patientSex}

**Task:**
Generate a complete PatientAVStateMachine with 3-5 clinical states representing the patient's progression during the encounter.

**Required States (minimum 3):**
1. **baseline** - Initial presentation (stable but symptomatic)
2. **moderate** or **worsening** - Condition progresses if untreated
3. **critical** - Severe decompensation requiring immediate intervention
4. **stabilized** (optional) - After successful intervention
5. **recovered** (optional) - After complete treatment

**For Each State Include:**
- **Voice configuration**: voiceId, rate (0.5-1.5), pitch (-2 to +2), toneDescriptors
- **Video prompt**: Detailed veo_cameos prompt (patient appearance, position, clinical signs, environment)
- **Clinical context**: What the patient is experiencing in this state
- **Auto-transitions**: Conditions that trigger state changes (vitals, interventions)

**Clinical Triggers:**
Define triggers based on vital signs and clinical findings:
- **Respiratory**: O2 saturation, respiratory rate, breath sounds
- **Cardiovascular**: Heart rate, blood pressure, cardiac signs
- **Neurological**: Mental status, GCS, focal deficits
- **Pain**: Pain scale, location, character

**Example Vitals Triggers:**
- O2 < 88%: Severe hypoxia → critical state
- O2 88-92%: Moderate hypoxia → worsening state
- HR > 120: Tachycardia → moderate state
- BP < 90 systolic: Hypotension → critical state

**Voice Modulation Guidelines:**
- **Baseline**: rate=1.0, pitch=0, toneDescriptors=["concerned", "cooperative"]
- **Moderate**: rate=0.9, pitch=+1, toneDescriptors=["uncomfortable", "breathless"]
- **Critical**: rate=0.7, pitch=+2, toneDescriptors=["gasping", "panicked", "weak"]
- **Stabilized**: rate=0.9, pitch=0, toneDescriptors=["relieved", "tired"]

**Video Prompt Guidelines:**
- Include: Age, sex, environment (ED/clinic), position, clinical signs, equipment visible
- Example: "60yo male in ED, sitting upright, mild dyspnea, nasal cannula, pursed-lip breathing"
- Be specific about physical findings (Levine sign, tripod position, accessory muscle use, etc.)

**Output Format:**
Return ONLY valid JSON matching this structure (no markdown, no explanations):

{
  "id": "case-${diagnosis.toLowerCase().replace(/\s+/g, '-')}-001",
  "version": "1.0.0",
  "initialState": "baseline",
  "metadata": {
    "caseId": "generated",
    "patientName": "Generated Patient",
    "chiefComplaint": "${chiefComplaint}",
    "createdAt": "${new Date().toISOString()}",
    "updatedAt": "${new Date().toISOString()}"
  },
  "states": {
    "baseline": { ... },
    "worsening": { ... },
    "critical": { ... }
  },
  "globalTransitions": [
    {
      "toState": "critical",
      "triggers": [{ ... }],
      "cooldown": 0,
      "reversible": true
    }
  ],
  "stateTransitions": {}
}

**Important:**
- Use realistic vital sign thresholds for the diagnosis
- Include auto-transitions with reversibility
- Add cooldowns to prevent oscillation
- Ensure clinical accuracy`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Clean response
    const cleaned = text.replace(/```json|```/gi, '').trim();
    const parsed = JSON.parse(cleaned);

    return parsed as PatientAVStateMachine;
  } catch (error) {
    console.error('Error generating state machine:', error);
    throw new Error(`Failed to generate state machine: ${error}`);
  }
}

/**
 * Generate a simple fallback state machine (no Gemini).
 */
function generateFallbackStateMachine(
  caseId: string,
  patientName: string,
  chiefComplaint: string,
  diagnosis: string
): PatientAVStateMachine {
  const builder = new StateMachineBuilder();

  return builder
    .withId(caseId)
    .withVersion('1.0.0')
    .withInitialState('baseline')
    .withMetadata({
      caseId,
      patientName,
      chiefComplaint,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .addState({
      id: 'baseline',
      name: 'Baseline Presentation',
      clinicalContext: 'Patient presenting with initial complaint',
      voice: {
        voiceId: 'Kore',
        rate: 1.0,
        pitch: 0,
        volume: 0.9,
        toneDescriptors: ['concerned', 'cooperative'],
        applyVocalStrain: false,
      },
      video: {
        videoId: `${caseId}-baseline`,
        prompt: `${patientName} presenting with ${chiefComplaint} in emergency department`,
        physicalPresentation: 'Initial presentation',
        environment: 'emergency_department',
        duration: 5,
        transitionType: 'immediate',
        transitionDuration: 0,
        status: 'pending',
      },
    })
    .build();
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: ts-node stateMachine-generator.ts <chiefComplaint> <diagnosis>');
    console.log('Example: ts-node stateMachine-generator.ts "Shortness of Breath" "COPD Exacerbation"');
    process.exit(1);
  }

  const [chiefComplaint, diagnosis] = args;

  console.log(`Generating state machine for: ${diagnosis}`);
  console.log(`Chief Complaint: ${chiefComplaint}`);
  console.log('---');

  try {
    const stateMachine = await generateStateMachine(chiefComplaint!, diagnosis!);
    
    console.log('State Machine Generated Successfully!');
    console.log('---');
    console.log(JSON.stringify(stateMachine, null, 2));
    console.log('---');
    console.log(`States: ${Object.keys(stateMachine.states).length}`);
    console.log(`Transitions: ${stateMachine.globalTransitions.length}`);
  } catch (error) {
    console.error('Failed to generate state machine:', error);
    console.log('---');
    console.log('Using fallback state machine instead...');
    
    const fallback = generateFallbackStateMachine(
      'case-fallback',
      'Test Patient',
      chiefComplaint!,
      diagnosis!
    );
    
    console.log(JSON.stringify(fallback, null, 2));
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { generateStateMachine, generateFallbackStateMachine };
