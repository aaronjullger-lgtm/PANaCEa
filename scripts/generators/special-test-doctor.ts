#!/usr/bin/env npx tsx
/**
 * Special Test Doctor - Physical Exam Special Tests Generator
 *
 * Generates special tests/maneuvers for conditions - key for PANCE physical exam questions.
 * These are named clinical tests like "Lachman test", "Murphy's sign", etc.
 *
 * SpecialTest Schema:
 *   id, name (unique), displayName?, aliases[], system?, region?, description?,
 *   sensitivity?, specificity?, technique?, positiveTest?, interpretation?,
 *   imageUrl?, videoUrl?, conditions[]
 *
 * Usage:
 *   npx tsx scripts/generators/special-test-doctor.ts --dry-run
 *   npx tsx scripts/generators/special-test-doctor.ts
 *   npx tsx scripts/generators/special-test-doctor.ts --analyze
 *   npx tsx scripts/generators/special-test-doctor.ts --known-only
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const prisma = new PrismaClient();

// Rate limiting
class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private capacity: number,
    private refillRate: number
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;

    if (this.tokens < 1) {
      const waitTime = ((1 - this.tokens) / this.refillRate) * 1000;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      this.tokens = 0;
    } else {
      this.tokens -= 1;
    }
  }
}

const rateLimiter = new TokenBucket(5, 0.5);

interface SpecialTestCandidate {
  name: string;
  displayName?: string;
  aliases: string[];
  system: string;
  region?: string;
  description?: string;
  sensitivity?: number;
  specificity?: number;
  technique?: string;
  positiveTest?: string;
  interpretation?: string;
  conditions: string[];
  source: 'known' | 'ai';
}

// Known high-yield special tests (PANCE board favorites)
const KNOWN_SPECIAL_TESTS: SpecialTestCandidate[] = [
  // MUSCULOSKELETAL - KNEE
  {
    name: 'Lachman Test',
    system: 'MSK',
    region: 'Knee',
    aliases: ["Lachman's Test"],
    description: 'Most sensitive test for ACL tear',
    sensitivity: 85,
    specificity: 94,
    technique:
      'Patient supine, knee flexed 20-30°. Stabilize distal femur with one hand, grasp proximal tibia with the other, and pull anteriorly.',
    positiveTest:
      'Increased anterior translation of tibia relative to femur with soft/mushy endpoint',
    interpretation: 'Positive test indicates ACL injury/tear',
    conditions: ['ACL Tear', 'ACL Injury'],
    source: 'known',
  },
  {
    name: 'Anterior Drawer Test',
    system: 'MSK',
    region: 'Knee',
    aliases: ['Knee Anterior Drawer'],
    description: 'Classic test for ACL integrity',
    sensitivity: 55,
    specificity: 92,
    technique:
      "Patient supine, knee flexed to 90°, foot flat on table. Sit on patient's foot to stabilize, pull tibia anteriorly.",
    positiveTest: 'Increased anterior translation of tibia >6mm compared to uninjured side',
    interpretation: 'Positive test suggests ACL injury; less sensitive than Lachman',
    conditions: ['ACL Tear', 'ACL Injury'],
    source: 'known',
  },
  {
    name: 'Posterior Drawer Test',
    system: 'MSK',
    region: 'Knee',
    aliases: ['Knee Posterior Drawer'],
    description: 'Test for PCL integrity',
    sensitivity: 90,
    specificity: 99,
    technique: 'Patient supine, knee flexed 90°. Push tibia posteriorly.',
    positiveTest: 'Posterior translation of tibia >10mm',
    interpretation: 'Positive test indicates PCL injury',
    conditions: ['PCL Tear', 'PCL Injury'],
    source: 'known',
  },
  {
    name: 'McMurray Test',
    system: 'MSK',
    region: 'Knee',
    aliases: ["McMurray's Test"],
    description: 'Test for meniscal tears',
    sensitivity: 70,
    specificity: 71,
    technique:
      'Patient supine. Flex knee maximally, apply valgus stress + external rotation (lateral meniscus) or varus stress + internal rotation (medial meniscus), then extend knee.',
    positiveTest: 'Click, pop, or pain along the joint line',
    interpretation: 'Positive test suggests meniscal tear',
    conditions: ['Meniscal Tear', 'Meniscus Injury'],
    source: 'known',
  },
  {
    name: 'Valgus Stress Test',
    system: 'MSK',
    region: 'Knee',
    aliases: ['MCL Stress Test'],
    description: 'Test for MCL integrity',
    sensitivity: 86,
    specificity: 91,
    technique:
      'Patient supine, knee in 30° flexion. Apply valgus force (push knee medially) while stabilizing ankle.',
    positiveTest: 'Increased medial joint space opening, pain along MCL',
    interpretation: 'Positive test indicates MCL injury; test at 0° and 30° flexion',
    conditions: ['MCL Sprain', 'MCL Injury', 'Medial Collateral Ligament Injury'],
    source: 'known',
  },
  {
    name: 'Varus Stress Test',
    system: 'MSK',
    region: 'Knee',
    aliases: ['LCL Stress Test'],
    description: 'Test for LCL integrity',
    sensitivity: 85,
    specificity: 90,
    technique:
      'Patient supine, knee in 30° flexion. Apply varus force (push knee laterally) while stabilizing ankle.',
    positiveTest: 'Increased lateral joint space opening, pain along LCL',
    interpretation: 'Positive test indicates LCL injury',
    conditions: ['LCL Sprain', 'LCL Injury', 'Lateral Collateral Ligament Injury'],
    source: 'known',
  },
  {
    name: 'Patellar Apprehension Test',
    system: 'MSK',
    region: 'Knee',
    aliases: ['Fairbanks Test', 'Patellar Instability Test'],
    description: 'Test for patellar instability/subluxation',
    sensitivity: 87,
    specificity: 95,
    technique:
      'Patient supine, knee in slight flexion (20-30°). Apply lateral pressure to patella.',
    positiveTest: 'Patient apprehension, guarding, or feeling of impending dislocation',
    interpretation: 'Positive test suggests patellar instability or history of dislocation',
    conditions: ['Patellar Dislocation', 'Patellar Instability', 'Patellofemoral Syndrome'],
    source: 'known',
  },

  // MUSCULOSKELETAL - SHOULDER
  {
    name: 'Neer Impingement Test',
    system: 'MSK',
    region: 'Shoulder',
    aliases: ['Neer Test', 'Neer Sign'],
    description: 'Test for subacromial impingement',
    sensitivity: 79,
    specificity: 53,
    technique:
      "Examiner stabilizes scapula while passively flexing the patient's arm forward with the arm internally rotated.",
    positiveTest: 'Pain in the anterolateral shoulder',
    interpretation: 'Positive test suggests subacromial impingement syndrome',
    conditions: [
      'Shoulder Impingement Syndrome',
      'Rotator Cuff Tendinitis',
      'Subacromial Bursitis',
    ],
    source: 'known',
  },
  {
    name: 'Hawkins-Kennedy Test',
    system: 'MSK',
    region: 'Shoulder',
    aliases: ['Hawkins Test'],
    description: 'Test for subacromial impingement',
    sensitivity: 87,
    specificity: 43,
    technique: 'Forward flex the shoulder to 90°, then forcibly internally rotate.',
    positiveTest: 'Pain in the anterior shoulder',
    interpretation: 'Positive test suggests subacromial impingement',
    conditions: ['Shoulder Impingement Syndrome', 'Rotator Cuff Tendinitis'],
    source: 'known',
  },
  {
    name: 'Drop Arm Test',
    system: 'MSK',
    region: 'Shoulder',
    aliases: ["Codman's Sign"],
    description: 'Test for complete rotator cuff tear',
    sensitivity: 35,
    specificity: 88,
    technique: "Passively abduct patient's arm to 90°, then ask them to slowly lower it.",
    positiveTest: 'Arm drops suddenly or patient cannot hold arm up',
    interpretation: 'Positive test suggests complete rotator cuff tear (especially supraspinatus)',
    conditions: ['Rotator Cuff Tear', 'Supraspinatus Tear'],
    source: 'known',
  },
  {
    name: 'Empty Can Test',
    system: 'MSK',
    region: 'Shoulder',
    aliases: ['Jobe Test', 'Supraspinatus Test'],
    description: 'Test for supraspinatus tendon integrity',
    sensitivity: 69,
    specificity: 62,
    technique:
      'Patient abducts arms to 90° in the scapular plane (30° forward), internally rotates (thumbs down), and resists downward pressure.',
    positiveTest: 'Weakness or pain',
    interpretation: 'Positive test suggests supraspinatus pathology',
    conditions: ['Supraspinatus Tendinitis', 'Supraspinatus Tear', 'Rotator Cuff Injury'],
    source: 'known',
  },
  {
    name: "Speed's Test",
    system: 'MSK',
    region: 'Shoulder',
    aliases: ['Speed Test', 'Biceps Tendon Test'],
    description: 'Test for biceps tendinitis or SLAP lesion',
    sensitivity: 63,
    specificity: 58,
    technique:
      'Patient flexes shoulder to 90° with elbow extended and forearm supinated. Examiner resists forward flexion.',
    positiveTest: 'Pain in the bicipital groove',
    interpretation: 'Positive test suggests biceps tendinitis or SLAP lesion',
    conditions: ['Biceps Tendinitis', 'SLAP Lesion', 'Biceps Tendon Pathology'],
    source: 'known',
  },
  {
    name: 'Apprehension Test (Shoulder)',
    system: 'MSK',
    region: 'Shoulder',
    aliases: ['Anterior Apprehension Test', 'Crank Test'],
    description: 'Test for anterior shoulder instability',
    sensitivity: 72,
    specificity: 96,
    technique:
      'Patient supine. Abduct shoulder to 90°, externally rotate while applying gentle anterior pressure on humeral head.',
    positiveTest: 'Patient apprehension or feeling of impending dislocation',
    interpretation: 'Positive test suggests anterior shoulder instability/prior dislocation',
    conditions: ['Anterior Shoulder Instability', 'Shoulder Dislocation', 'Bankart Lesion'],
    source: 'known',
  },
  {
    name: "O'Brien Test",
    system: 'MSK',
    region: 'Shoulder',
    aliases: ['Active Compression Test'],
    description: 'Test for SLAP lesion or AC joint pathology',
    sensitivity: 63,
    specificity: 73,
    technique:
      'Arm at 90° flexion, 10° adduction, thumb down. Resist downward force. Repeat with thumb up.',
    positiveTest: 'Deep shoulder pain with thumb down that improves with thumb up',
    interpretation: 'Positive test suggests SLAP lesion; AC joint pain suggests AC pathology',
    conditions: ['SLAP Lesion', 'AC Joint Pathology', 'Superior Labral Tear'],
    source: 'known',
  },

  // MUSCULOSKELETAL - HIP
  {
    name: 'FABER Test',
    system: 'MSK',
    region: 'Hip',
    aliases: ['Patrick Test', 'Figure-4 Test'],
    description: 'Test for hip or SI joint pathology',
    sensitivity: 77,
    specificity: 100,
    technique:
      'Patient supine. Place ankle on opposite knee (figure-4). Apply downward pressure on flexed knee.',
    positiveTest: 'Groin pain = hip pathology; Posterior pain = SI joint pathology',
    interpretation: 'Differentiates between hip and SI joint dysfunction',
    conditions: ['Hip Osteoarthritis', 'Sacroiliac Joint Dysfunction', 'Hip Pathology'],
    source: 'known',
  },
  {
    name: 'Thomas Test',
    system: 'MSK',
    region: 'Hip',
    aliases: ['Hip Flexion Contracture Test'],
    description: 'Test for hip flexor tightness/contracture',
    sensitivity: 89,
    specificity: 92,
    technique: 'Patient supine. Flex one hip to chest, hold. Observe opposite leg.',
    positiveTest: 'Opposite thigh rises off the table',
    interpretation: 'Positive test indicates hip flexor (iliopsoas) tightness or contracture',
    conditions: ['Hip Flexor Tightness', 'Hip Flexion Contracture', 'Iliopsoas Tightness'],
    source: 'known',
  },
  {
    name: 'Trendelenburg Test',
    system: 'MSK',
    region: 'Hip',
    aliases: ['Trendelenburg Sign'],
    description: 'Test for hip abductor weakness',
    sensitivity: 73,
    specificity: 77,
    technique: 'Patient stands on one leg. Observe contralateral pelvis.',
    positiveTest: 'Contralateral pelvis drops or trunk leans toward stance leg',
    interpretation:
      'Positive test indicates weakness of hip abductors (gluteus medius) on stance side',
    conditions: ['Hip Abductor Weakness', 'Gluteus Medius Weakness', 'Hip Pathology'],
    source: 'known',
  },
  {
    name: 'Ober Test',
    system: 'MSK',
    region: 'Hip',
    aliases: ['IT Band Test'],
    description: 'Test for IT band tightness',
    sensitivity: 80,
    specificity: 78,
    technique: 'Patient side-lying. Examiner abducts and extends the upper leg, then releases.',
    positiveTest: 'Leg remains abducted and does not drop to table',
    interpretation: 'Positive test indicates IT band tightness',
    conditions: ['IT Band Syndrome', 'IT Band Tightness', 'Iliotibial Band Syndrome'],
    source: 'known',
  },

  // MUSCULOSKELETAL - SPINE/BACK
  {
    name: 'Straight Leg Raise Test',
    system: 'MSK',
    region: 'Spine',
    aliases: ['Lasègue Test', 'SLR Test'],
    description: 'Test for lumbar disc herniation/sciatica',
    sensitivity: 91,
    specificity: 26,
    technique: "Patient supine. Passively raise patient's leg with knee extended.",
    positiveTest: 'Radicular pain (sciatic distribution) at 30-70° of elevation',
    interpretation: 'Positive test suggests L4-S1 nerve root compression (disc herniation)',
    conditions: ['Lumbar Disc Herniation', 'Sciatica', 'Lumbar Radiculopathy'],
    source: 'known',
  },
  {
    name: 'Crossed Straight Leg Raise',
    system: 'MSK',
    region: 'Spine',
    aliases: ['Crossed SLR', 'Contralateral SLR'],
    description: 'Highly specific test for disc herniation',
    sensitivity: 29,
    specificity: 88,
    technique: 'Patient supine. Raise the asymptomatic leg.',
    positiveTest: 'Pain in the symptomatic leg',
    interpretation: 'Positive test is highly specific for large disc herniation',
    conditions: ['Lumbar Disc Herniation', 'Large Disc Herniation'],
    source: 'known',
  },
  {
    name: 'Spurling Test',
    system: 'MSK',
    region: 'Cervical Spine',
    aliases: ["Spurling's Maneuver", 'Cervical Compression Test'],
    description: 'Test for cervical radiculopathy',
    sensitivity: 50,
    specificity: 86,
    technique:
      'Patient seated. Extend, laterally flex, and rotate neck toward symptomatic side. Apply axial compression.',
    positiveTest: 'Reproduction of radicular arm pain',
    interpretation: 'Positive test suggests cervical nerve root compression',
    conditions: [
      'Cervical Radiculopathy',
      'Cervical Disc Herniation',
      'Cervical Foraminal Stenosis',
    ],
    source: 'known',
  },
  {
    name: 'Sacroiliac Joint Compression Test',
    system: 'MSK',
    region: 'Pelvis',
    aliases: ['SI Joint Compression', 'Pelvic Compression Test'],
    description: 'Test for SI joint pathology',
    sensitivity: 69,
    specificity: 69,
    technique: 'Patient side-lying. Apply downward pressure to the iliac crest.',
    positiveTest: 'Pain at SI joint',
    interpretation: 'Positive test suggests SI joint pathology',
    conditions: ['Sacroiliac Joint Dysfunction', 'SI Joint Pain'],
    source: 'known',
  },

  // MUSCULOSKELETAL - ANKLE/FOOT
  {
    name: 'Anterior Drawer Test (Ankle)',
    system: 'MSK',
    region: 'Ankle',
    aliases: ['Ankle Anterior Drawer'],
    description: 'Test for anterior talofibular ligament (ATFL) integrity',
    sensitivity: 73,
    specificity: 97,
    technique: 'Patient supine, ankle in neutral. Stabilize tibia and pull talus anteriorly.',
    positiveTest: 'Increased anterior translation of talus',
    interpretation: 'Positive test suggests ATFL injury (most common ankle ligament injured)',
    conditions: ['Ankle Sprain', 'ATFL Tear', 'Lateral Ankle Instability'],
    source: 'known',
  },
  {
    name: 'Talar Tilt Test',
    system: 'MSK',
    region: 'Ankle',
    aliases: ['Inversion Stress Test'],
    description: 'Test for calcaneofibular ligament (CFL) integrity',
    sensitivity: 52,
    specificity: 88,
    technique: 'Patient supine, ankle in neutral. Invert the calcaneus while stabilizing tibia.',
    positiveTest: 'Excessive talar tilt compared to uninjured side',
    interpretation: 'Positive test suggests CFL injury',
    conditions: ['Ankle Sprain', 'CFL Tear', 'Lateral Ankle Instability'],
    source: 'known',
  },
  {
    name: 'Thompson Test',
    system: 'MSK',
    region: 'Ankle',
    aliases: ['Calf Squeeze Test', "Thompson's Test"],
    description: 'Test for Achilles tendon rupture',
    sensitivity: 96,
    specificity: 93,
    technique: 'Patient prone with feet hanging off table. Squeeze calf muscles.',
    positiveTest: 'Absence of plantar flexion',
    interpretation: 'Positive test (no plantar flexion) indicates Achilles tendon rupture',
    conditions: ['Achilles Tendon Rupture', 'Achilles Rupture'],
    source: 'known',
  },

  // MUSCULOSKELETAL - WRIST/HAND
  {
    name: "Phalen's Test",
    system: 'MSK',
    region: 'Wrist',
    aliases: ["Phalen's Maneuver", 'Wrist Flexion Test'],
    description: 'Test for carpal tunnel syndrome',
    sensitivity: 68,
    specificity: 73,
    technique: 'Patient holds wrists in complete flexion for 60 seconds (backs of hands together).',
    positiveTest: 'Paresthesias in median nerve distribution (thumb, index, middle finger)',
    interpretation: 'Positive test suggests carpal tunnel syndrome',
    conditions: ['Carpal Tunnel Syndrome'],
    source: 'known',
  },
  {
    name: "Tinel's Sign (Wrist)",
    system: 'MSK',
    region: 'Wrist',
    aliases: ["Tinel's Test"],
    description: 'Test for carpal tunnel syndrome',
    sensitivity: 50,
    specificity: 77,
    technique: 'Tap over the carpal tunnel at the wrist.',
    positiveTest: 'Tingling or paresthesias in median nerve distribution',
    interpretation: 'Positive test suggests carpal tunnel syndrome',
    conditions: ['Carpal Tunnel Syndrome'],
    source: 'known',
  },
  {
    name: 'Finkelstein Test',
    system: 'MSK',
    region: 'Wrist',
    aliases: ["Finkelstein's Test"],
    description: "Test for de Quervain's tenosynovitis",
    sensitivity: 88,
    specificity: 14,
    technique: 'Patient makes fist with thumb inside, then ulnarly deviate wrist.',
    positiveTest: 'Pain over radial styloid and first dorsal compartment',
    interpretation: "Positive test suggests de Quervain's tenosynovitis",
    conditions: ["De Quervain's Tenosynovitis", 'De Quervain Tenosynovitis'],
    source: 'known',
  },
  {
    name: 'Allen Test',
    system: 'MSK',
    region: 'Wrist',
    aliases: ["Allen's Test"],
    description: 'Test for arterial patency before procedures',
    technique:
      'Have patient clench fist. Compress both radial and ulnar arteries. Patient opens hand. Release one artery.',
    positiveTest: 'Hand re-perfuses within 5-7 seconds',
    interpretation: 'Used to assess collateral circulation before radial artery procedures',
    conditions: ['Pre-procedural Assessment'],
    source: 'known',
  },

  // MUSCULOSKELETAL - ELBOW
  {
    name: "Cozen's Test",
    system: 'MSK',
    region: 'Elbow',
    aliases: ['Resisted Wrist Extension Test'],
    description: 'Test for lateral epicondylitis (tennis elbow)',
    sensitivity: 84,
    specificity: 82,
    technique: 'Patient makes fist with forearm pronated. Resist wrist extension.',
    positiveTest: 'Pain at lateral epicondyle',
    interpretation: 'Positive test suggests lateral epicondylitis',
    conditions: ['Lateral Epicondylitis', 'Tennis Elbow'],
    source: 'known',
  },
  {
    name: "Golfer's Elbow Test",
    system: 'MSK',
    region: 'Elbow',
    aliases: ['Medial Epicondylitis Test', 'Resisted Wrist Flexion Test'],
    description: 'Test for medial epicondylitis',
    sensitivity: 80,
    specificity: 80,
    technique: 'Resist wrist flexion with forearm supinated.',
    positiveTest: 'Pain at medial epicondyle',
    interpretation: 'Positive test suggests medial epicondylitis',
    conditions: ['Medial Epicondylitis', "Golfer's Elbow"],
    source: 'known',
  },

  // ABDOMINAL
  {
    name: "Murphy's Sign",
    system: 'GI',
    region: 'Abdomen',
    aliases: ['Murphy Sign'],
    description: 'Test for acute cholecystitis',
    sensitivity: 65,
    specificity: 87,
    technique: 'Palpate RUQ while patient takes deep breath.',
    positiveTest: 'Patient stops inspiration (inspiratory arrest) due to pain',
    interpretation: "Positive Murphy's sign suggests acute cholecystitis",
    conditions: ['Acute Cholecystitis', 'Cholecystitis'],
    source: 'known',
  },
  {
    name: "McBurney's Point Tenderness",
    system: 'GI',
    region: 'Abdomen',
    aliases: ['McBurney Sign'],
    description: 'Classic finding in appendicitis',
    sensitivity: 81,
    specificity: 53,
    technique: "Palpate at McBurney's point (1/3 distance from ASIS to umbilicus).",
    positiveTest: "Point tenderness at McBurney's point",
    interpretation: 'Classic location for appendiceal tenderness',
    conditions: ['Appendicitis', 'Acute Appendicitis'],
    source: 'known',
  },
  {
    name: "Rovsing's Sign",
    system: 'GI',
    region: 'Abdomen',
    aliases: ['Rovsing Sign'],
    description: 'Indirect rebound tenderness for appendicitis',
    sensitivity: 68,
    specificity: 58,
    technique: 'Palpate deeply in LLQ.',
    positiveTest: "Pain referred to RLQ (at McBurney's point)",
    interpretation: 'Positive test suggests appendicitis (peritoneal irritation)',
    conditions: ['Appendicitis', 'Acute Appendicitis'],
    source: 'known',
  },
  {
    name: 'Psoas Sign',
    system: 'GI',
    region: 'Abdomen',
    aliases: ['Iliopsoas Sign'],
    description: 'Test for retrocecal appendicitis',
    sensitivity: 40,
    specificity: 79,
    technique: 'Patient lies on left side. Extend right hip (stretch psoas).',
    positiveTest: 'RLQ pain',
    interpretation: 'Positive test suggests retrocecal appendicitis',
    conditions: ['Appendicitis', 'Retrocecal Appendicitis'],
    source: 'known',
  },
  {
    name: 'Obturator Sign',
    system: 'GI',
    region: 'Abdomen',
    aliases: ['Obturator Test'],
    description: 'Test for pelvic appendicitis',
    sensitivity: 35,
    specificity: 85,
    technique: 'Patient supine. Flex right hip and knee to 90°, then internally rotate hip.',
    positiveTest: 'RLQ pain',
    interpretation: 'Positive test suggests pelvic appendicitis',
    conditions: ['Appendicitis', 'Pelvic Appendicitis'],
    source: 'known',
  },
  {
    name: "Carnett's Sign",
    system: 'GI',
    region: 'Abdomen',
    aliases: ['Carnett Sign', 'Carnett Test'],
    description: 'Differentiates abdominal wall from intra-abdominal pain',
    technique:
      'Palpate tender area. Have patient tense abdominal muscles (lift head/shoulders or leg raise).',
    positiveTest: 'Pain persists or worsens with tensed muscles',
    interpretation:
      'Positive = abdominal wall source; Negative (decreased pain) = intra-abdominal source',
    conditions: ['Abdominal Wall Pain', 'Rectus Sheath Hematoma'],
    source: 'known',
  },

  // NEUROLOGICAL
  {
    name: "Brudzinski's Sign",
    system: 'NEURO',
    region: 'Neck',
    aliases: ['Brudzinski Sign'],
    description: 'Test for meningeal irritation',
    sensitivity: 66,
    specificity: 95,
    technique: 'Patient supine. Passively flex the neck.',
    positiveTest: 'Involuntary flexion of hips and knees',
    interpretation: 'Positive test suggests meningitis/meningeal irritation',
    conditions: ['Meningitis', 'Bacterial Meningitis', 'Subarachnoid Hemorrhage'],
    source: 'known',
  },
  {
    name: "Kernig's Sign",
    system: 'NEURO',
    region: 'Spine',
    aliases: ['Kernig Sign'],
    description: 'Test for meningeal irritation',
    sensitivity: 53,
    specificity: 98,
    technique: 'Patient supine. Flex hip to 90°, then attempt to extend knee.',
    positiveTest: 'Pain and resistance to knee extension',
    interpretation: 'Positive test suggests meningitis/meningeal irritation',
    conditions: ['Meningitis', 'Bacterial Meningitis', 'Subarachnoid Hemorrhage'],
    source: 'known',
  },
  {
    name: 'Babinski Sign',
    system: 'NEURO',
    region: 'Foot',
    aliases: ['Babinski Reflex', 'Plantar Reflex'],
    description: 'Test for upper motor neuron lesion',
    technique: 'Firmly stroke lateral sole of foot from heel to ball, then curve medially.',
    positiveTest: 'Dorsiflexion of great toe with fanning of other toes',
    interpretation: 'Positive (upgoing toe) = upper motor neuron lesion; Normal in infants <1 year',
    conditions: ['Upper Motor Neuron Lesion', 'Stroke', 'Multiple Sclerosis', 'Spinal Cord Injury'],
    source: 'known',
  },
  {
    name: 'Romberg Test',
    system: 'NEURO',
    region: 'Balance',
    aliases: ['Romberg Sign'],
    description: 'Test for proprioceptive or vestibular dysfunction',
    technique: 'Patient stands with feet together, arms at sides, then closes eyes.',
    positiveTest: 'Significant swaying or falling with eyes closed',
    interpretation:
      'Positive test suggests dorsal column (proprioception) or vestibular dysfunction',
    conditions: ['Peripheral Neuropathy', 'Posterior Column Disease', 'Vestibular Dysfunction'],
    source: 'known',
  },
  {
    name: 'Dix-Hallpike Maneuver',
    system: 'NEURO',
    region: 'Vestibular',
    aliases: ['Dix-Hallpike Test', 'Nylen-Barany Test'],
    description: 'Diagnostic test for BPPV',
    sensitivity: 79,
    specificity: 75,
    technique:
      'Patient sits. Rapidly lie patient down with head hanging 30° below table and rotated 45° to one side.',
    positiveTest: 'Rotatory nystagmus with latency (2-5 sec), lasting <1 minute, with vertigo',
    interpretation: 'Positive test diagnoses posterior canal BPPV',
    conditions: ['BPPV', 'Benign Paroxysmal Positional Vertigo'],
    source: 'known',
  },

  // CARDIOVASCULAR
  {
    name: 'Hepatojugular Reflux',
    system: 'CV',
    region: 'Neck',
    aliases: ['Abdominojugular Test', 'Kussmaul Sign'],
    description: 'Test for right heart failure',
    technique:
      'Apply firm pressure to RUQ for 10-15 seconds while patient breathes normally. Observe JVP.',
    positiveTest: 'Sustained JVP elevation >3cm',
    interpretation: 'Positive test suggests right heart failure or elevated RA pressure',
    conditions: ['Right Heart Failure', 'Congestive Heart Failure', 'Constrictive Pericarditis'],
    source: 'known',
  },
  {
    name: 'Pulsus Paradoxus',
    system: 'CV',
    region: 'Vital Signs',
    aliases: [],
    description: 'Exaggerated BP drop during inspiration',
    technique:
      'Measure BP; note when Korotkoff sounds first appear (only during expiration) and when continuous.',
    positiveTest: 'Difference >10 mmHg',
    interpretation: 'Suggests cardiac tamponade, severe asthma/COPD, or constrictive pericarditis',
    conditions: ['Cardiac Tamponade', 'Severe Asthma', 'Constrictive Pericarditis'],
    source: 'known',
  },

  // VASCULAR
  {
    name: "Homan's Sign",
    system: 'CV',
    region: 'Leg',
    aliases: ['Homans Sign'],
    description: 'Historical test for DVT (low sensitivity)',
    sensitivity: 10,
    specificity: 54,
    technique: 'With knee extended, dorsiflex the foot.',
    positiveTest: 'Calf pain',
    interpretation: 'Historically used for DVT; poor sensitivity - do not rely on this test alone',
    conditions: ['Deep Vein Thrombosis', 'DVT'],
    source: 'known',
  },
];

function getAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Generate special tests using AI for conditions
 */
async function generateAISpecialTests(
  conditions: { name: string; system: string; physicalExam: string | null }[]
): Promise<SpecialTestCandidate[]> {
  const ai = getAI();
  const model = ai.getGenerativeModel({
    model: 'gemini-2.5-pro',
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  });

  const conditionList = conditions.map((c) => ({
    name: c.name,
    system: c.system,
    physicalExam: c.physicalExam,
  }));

  const prompt = `You are a medical education expert creating physical exam special test references.

For each condition, identify any named special tests, maneuvers, or signs that help diagnose it.
Only include tests that have PROPER NAMES (e.g., "Lachman Test", "Murphy's Sign", "Brudzinski's Sign").
Do NOT include generic findings like "tenderness" or "swelling" without a named test.

For each test provide:
- name: The proper name of the test
- system: Body system (MSK, NEURO, CV, GI, PULM, etc.)
- region: Anatomical region (Knee, Shoulder, Abdomen, etc.)
- description: One sentence description
- technique: How to perform the test
- positiveTest: What constitutes a positive result
- interpretation: What a positive test means clinically
- sensitivity: Approximate sensitivity if known (0-100)
- specificity: Approximate specificity if known (0-100)

Return JSON:
[
  {
    "conditionName": "Condition A",
    "tests": [
      {
        "name": "Test Name",
        "system": "MSK",
        "region": "Knee",
        "description": "Description",
        "technique": "How to perform",
        "positiveTest": "Positive result",
        "interpretation": "What it means",
        "sensitivity": 80,
        "specificity": 90
      }
    ]
  }
]

If a condition has no named special tests, return empty array for tests.

Conditions:
${JSON.stringify(conditionList, null, 2)}`;

  await rateLimiter.acquire();

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  try {
    const parsed = JSON.parse(text);
    const candidates: SpecialTestCandidate[] = [];

    for (const item of parsed) {
      const condition = conditions.find((c) => c.name === item.conditionName);
      if (!condition) continue;

      for (const t of item.tests || []) {
        candidates.push({
          name: t.name.trim(),
          system: t.system || condition.system,
          region: t.region,
          aliases: [],
          description: t.description,
          sensitivity: t.sensitivity,
          specificity: t.specificity,
          technique: t.technique,
          positiveTest: t.positiveTest,
          interpretation: t.interpretation,
          conditions: [condition.name],
          source: 'ai',
        });
      }
    }

    return candidates;
  } catch (e) {
    console.error('Failed to parse AI response:', text.substring(0, 500));
    return [];
  }
}

/**
 * Check if special test already exists
 */
async function testExists(testName: string): Promise<{ exists: boolean; id?: string }> {
  const existing = await prisma.specialTest.findFirst({
    where: {
      OR: [{ name: { equals: testName, mode: 'insensitive' } }, { aliases: { has: testName } }],
    },
  });
  return { exists: !!existing, id: existing?.id };
}

/**
 * Phase 1: Analyze current state
 */
async function analyzeState() {
  console.log('\n📊 Analyzing Current State\n');

  const testCount = await prisma.specialTest.count();

  const bySystem = await prisma.specialTest.groupBy({
    by: ['system'],
    _count: true,
    orderBy: { _count: { system: 'desc' } },
  });

  const byRegion = await prisma.specialTest.groupBy({
    by: ['region'],
    _count: true,
    orderBy: { _count: { region: 'desc' } },
  });

  console.log(`  Total Special Tests: ${testCount}`);

  if (bySystem.length > 0) {
    console.log('\n  Tests by System:');
    for (const s of bySystem) {
      console.log(`    ${s.system || 'Unknown'}: ${s._count}`);
    }
  }

  if (byRegion.length > 0) {
    console.log('\n  Tests by Region:');
    for (const r of byRegion.slice(0, 10)) {
      console.log(`    ${r.region || 'Unknown'}: ${r._count}`);
    }
  }

  const samples = await prisma.specialTest.findMany({
    take: 10,
    include: { Condition: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  if (samples.length > 0) {
    console.log('\n  Sample Tests:');
    for (const s of samples) {
      const condNames = s.Condition.map((c) => c.name).join(', ');
      console.log(`    ${s.name} → ${condNames || 'No conditions linked'}`);
    }
  }
}

/**
 * Phase 2: Insert known special tests
 */
async function insertKnownTests(dryRun: boolean) {
  console.log('\n🔍 Inserting Known Special Tests\n');
  console.log(`  Found ${KNOWN_SPECIAL_TESTS.length} known special tests`);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const test of KNOWN_SPECIAL_TESTS) {
    const { exists, id } = await testExists(test.name);

    if (exists && id) {
      // Update conditions linkage
      if (!dryRun) {
        // Find condition IDs
        const conditions = await prisma.condition.findMany({
          where: { name: { in: test.conditions } },
          select: { id: true },
        });

        if (conditions.length > 0) {
          await prisma.specialTest.update({
            where: { id },
            data: {
              Condition: { connect: conditions.map((c) => ({ id: c.id })) },
            },
          });
          console.log(`  🔄 Updated links for: ${test.name}`);
          updated++;
        } else {
          skipped++;
        }
      } else {
        console.log(`  [DRY RUN] Would update: ${test.name}`);
        updated++;
      }
      continue;
    }

    // Find conditions to link
    const conditions = await prisma.condition.findMany({
      where: { name: { in: test.conditions } },
      select: { id: true },
    });

    if (dryRun) {
      console.log(`  [DRY RUN] Would insert: ${test.name} (→ ${test.conditions.join(', ')})`);
      inserted++;
    } else {
      await prisma.specialTest.create({
        data: {
          id: crypto.randomUUID(),
          updatedAt: new Date(),
          name: test.name,
          displayName: test.displayName || test.name,
          aliases: test.aliases,
          system: test.system,
          region: test.region,
          description: test.description,
          sensitivity: test.sensitivity,
          specificity: test.specificity,
          technique: test.technique,
          positiveTest: test.positiveTest,
          interpretation: test.interpretation,
          Condition:
            conditions.length > 0 ? { connect: conditions.map((c) => ({ id: c.id })) } : undefined,
        },
      });
      console.log(`  ✅ ${test.name} (→ ${conditions.length} conditions linked)`);
      inserted++;
    }
  }

  console.log(`\n  Summary: ${inserted} inserted, ${updated} updated, ${skipped} skipped`);
}

/**
 * Phase 3: Generate AI tests for conditions without special tests
 */
async function generateAITests(dryRun: boolean, batchSize: number) {
  console.log('\n🤖 Generating AI Special Tests for Conditions\n');

  // Get conditions that might benefit from special tests (primarily MSK, NEURO, GI)
  const relevantSystems = ['MSK', 'NEURO', 'GI', 'CV', 'PULM', 'HEENT'];

  const conditions = await prisma.medicalContent.findMany({
    where: { system: { in: relevantSystems } },
    select: {
      condition: true,
      system: true,
      physicalExam: true,
    },
  });

  console.log(`  Processing ${conditions.length} conditions in relevant systems`);

  let totalInserted = 0;
  let totalSkipped = 0;

  for (let i = 0; i < conditions.length; i += batchSize) {
    const batch = conditions.slice(i, i + batchSize);
    console.log(
      `\n  Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(conditions.length / batchSize)} (${batch.length} conditions)...`
    );

    const conditionsForAI = batch.map((c) => ({
      name: c.condition,
      system: c.system,
      physicalExam: c.physicalExam,
    }));

    try {
      const candidates = await generateAISpecialTests(conditionsForAI);
      console.log(`    AI found ${candidates.length} special test candidates`);

      for (const candidate of candidates) {
        const { exists } = await testExists(candidate.name);

        if (exists) {
          totalSkipped++;
          continue;
        }

        // Find condition to link
        const condition = await prisma.condition.findFirst({
          where: { name: { in: candidate.conditions } },
          select: { id: true },
        });

        if (dryRun) {
          console.log(`    [DRY RUN] Would insert: ${candidate.name}`);
          totalInserted++;
        } else {
          await prisma.specialTest.create({
            data: {
              id: crypto.randomUUID(),
              updatedAt: new Date(),
              name: candidate.name,
              displayName: candidate.name,
              aliases: candidate.aliases,
              system: candidate.system,
              region: candidate.region,
              description: candidate.description,
              sensitivity: candidate.sensitivity,
              specificity: candidate.specificity,
              technique: candidate.technique,
              positiveTest: candidate.positiveTest,
              interpretation: candidate.interpretation,
              Condition: condition ? { connect: [{ id: condition.id }] } : undefined,
            },
          });
          console.log(`    ✅ ${candidate.name}`);
          totalInserted++;
        }
      }
    } catch (e: any) {
      console.error(`    ❌ Error processing batch:`, e.message || e);
    }

    if (i + batchSize < conditions.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log(`\n  Summary: ${totalInserted} inserted, ${totalSkipped} skipped (duplicates)`);
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const analyzeOnly = args.includes('--analyze');
  const knownOnly = args.includes('--known-only');
  const batchArg = args.find((a) => a.startsWith('--batch='));
  const batchSize = batchArg ? parseInt(batchArg.split('=')[1]) : 15;

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║         🩺 SPECIAL TEST DOCTOR - Physical Exam Generator       ║');
  console.log('╠════════════════════════════════════════════════════════════════╣');
  const modeText = dryRun
    ? 'DRY RUN (no changes)'
    : analyzeOnly
      ? 'ANALYZE ONLY'
      : 'LIVE (will make changes)';
  console.log(`║  Mode: ${modeText.padEnd(55)}║`);
  console.log(`║  Batch Size: ${batchSize.toString().padEnd(50)}║`);
  console.log(
    `║  AI Generation: ${knownOnly ? 'DISABLED (known only)' : 'ENABLED'}${' '.repeat(knownOnly ? 33 : 42)}║`
  );
  console.log('╚════════════════════════════════════════════════════════════════╝');

  try {
    await analyzeState();

    if (analyzeOnly) {
      return;
    }

    await insertKnownTests(dryRun);

    if (!knownOnly) {
      await generateAITests(dryRun, batchSize);
    }

    console.log('\n📈 FINAL STATE:');
    await analyzeState();

    console.log('\n✨ Special Test Doctor complete!');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
