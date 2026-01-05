/**
 * AnatomyStructure Generator
 * 
 * Generates comprehensive anatomy structure records with AI assistance
 * Includes high-yield PANCE anatomy structures
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as crypto from 'crypto';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

interface AnatomyStructureData {
  name: string;
  system: string;
  region: string;
  type: string;
  description: string;
  function: string;
  innervation: string;
  bloodSupply: string;
  clinicalSignificance: string;
  imageUrl: string;
  abbreviation: string;
  aliases: string[];
  anastomoses: string[];
  attachments: string[];
  autonomicFunction: string;
  boardYieldFacts: string[];
  borders: string;
  branches: string[];
  clinicalPearls: string[];
  commonMistakes: string[];
  commonPathology: string[];
  contents: string[];
  dermatome: string;
  diagramUrl: string;
  examFindings: string[];
  imagingFindings: string[];
  injuryMechanism: string;
  insertion: string;
  isHighYield: boolean;
  latinName: string;
  layers: string[];
  mnemonics: string[];
  modelUrl: string;
  motorFunction: string;
  myotome: string;
  nervePath: string;
  nerveRoots: string;
  origin: string;
  palpationTips: string;
  panceYield: number;
  relations: string;
  sensoryFunction: string;
  surfaceLandmarks: string[];
  surgicalApproach: string;
  testQuestionTips: string[];
  tributaries: string[];
  vesselPath: string;
  videoUrl: string;
}

const PROMPT_TEMPLATE = `You are a medical education expert creating anatomy content for PA students.

Generate comprehensive data for anatomy structure: "{{ITEM_NAME}}"
Category: {{CATEGORY}}

Create detailed, accurate content with this JSON structure:

{
  "name": "structure name",
  "system": "musculoskeletal/nervous/cardiovascular/etc",
  "region": "head/neck/thorax/abdomen/pelvis/upper extremity/lower extremity",
  "type": "muscle/nerve/artery/vein/bone/ligament/organ",
  "description": "detailed anatomical description",
  "function": "primary function",
  "innervation": "nerve supply",
  "bloodSupply": "arterial supply",
  "clinicalSignificance": "clinical relevance for PAs",
  "imageUrl": "",
  "abbreviation": "common abbreviation if any",
  "aliases": ["alternative names"],
  "anastomoses": ["connections if vessel"],
  "attachments": ["attachment points if muscle/ligament"],
  "autonomicFunction": "autonomic role if applicable",
  "boardYieldFacts": ["high-yield board facts"],
  "borders": "anatomical borders",
  "branches": ["branches if nerve/vessel"],
  "clinicalPearls": ["clinical pearls for practice"],
  "commonMistakes": ["common student mistakes"],
  "commonPathology": ["associated pathology"],
  "contents": ["contents if space/compartment"],
  "dermatome": "dermatome if nerve",
  "diagramUrl": "",
  "examFindings": ["physical exam findings"],
  "imagingFindings": ["imaging characteristics"],
  "injuryMechanism": "common injury mechanism",
  "insertion": "insertion point if muscle",
  "isHighYield": true,
  "latinName": "Latin anatomical term",
  "layers": ["layers if applicable"],
  "mnemonics": ["helpful mnemonics"],
  "modelUrl": "",
  "motorFunction": "motor function if nerve",
  "myotome": "myotome if nerve",
  "nervePath": "nerve course",
  "nerveRoots": "nerve root levels",
  "origin": "origin point if muscle",
  "palpationTips": "how to palpate",
  "panceYield": 7,
  "relations": "anatomical relations",
  "sensoryFunction": "sensory distribution if nerve",
  "surfaceLandmarks": ["surface anatomy landmarks"],
  "surgicalApproach": "surgical considerations",
  "testQuestionTips": ["PANCE question tips"],
  "tributaries": ["tributaries if vein"],
  "vesselPath": "vessel course if applicable",
  "videoUrl": ""
}

CRITICAL JSON RULES:
- Return ONLY valid JSON with NO markdown formatting
- Use straight apostrophes (') never curly quotes
- Write "greater than" not ">" symbol
- NO special characters: ≥ ≤ × ÷ → ∞
- NO double quotes inside string values
- NO null values - use empty arrays [] or "Not applicable"
- Remove ALL trailing commas
- All text fields should have meaningful medical content

Return the JSON now:`;

async function generateAnatomyStructure(item: { name: string; category: string }, retryCount = 0): Promise<AnatomyStructureData | null> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
  
  let prompt = PROMPT_TEMPLATE
    .replace('{{ITEM_NAME}}', item.name)
    .replace('{{CATEGORY}}', item.category);
  
  // Simplified retry prompt
  if (retryCount > 0) {
    prompt = `Generate valid JSON for anatomy structure: "${item.name}"
Category: ${item.category}

Return this exact JSON structure with NO markdown, filled with accurate medical content:
{
  "name": "${item.name}",
  "system": "value",
  "region": "value",
  "type": "value",
  "description": "value",
  "function": "value",
  "innervation": "value",
  "bloodSupply": "value",
  "clinicalSignificance": "value",
  "imageUrl": "",
  "abbreviation": "value",
  "aliases": [],
  "anastomoses": [],
  "attachments": [],
  "autonomicFunction": "Not applicable",
  "boardYieldFacts": ["fact1", "fact2"],
  "borders": "value",
  "branches": [],
  "clinicalPearls": ["pearl1"],
  "commonMistakes": ["mistake1"],
  "commonPathology": ["pathology1"],
  "contents": [],
  "dermatome": "Not applicable",
  "diagramUrl": "",
  "examFindings": ["finding1"],
  "imagingFindings": ["finding1"],
  "injuryMechanism": "value",
  "insertion": "Not applicable",
  "isHighYield": true,
  "latinName": "value",
  "layers": [],
  "mnemonics": [],
  "modelUrl": "",
  "motorFunction": "Not applicable",
  "myotome": "Not applicable",
  "nervePath": "Not applicable",
  "nerveRoots": "Not applicable",
  "origin": "Not applicable",
  "palpationTips": "value",
  "panceYield": 7,
  "relations": "value",
  "sensoryFunction": "Not applicable",
  "surfaceLandmarks": [],
  "surgicalApproach": "value",
  "testQuestionTips": ["tip1"],
  "tributaries": [],
  "vesselPath": "Not applicable",
  "videoUrl": ""
}

Rules: Use apostrophes not quotes inside strings, spell out symbols, no null values`;
  }

  try {
    const result = await model.generateContent(prompt);
    let jsonStr = result.response.text().trim();
    
    // Clean up response
    jsonStr = jsonStr
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/, '')
      .replace(/```\s*$/, '')
      .replace(/^\uFEFF/, '')
      .replace(/\r\n/g, '\n');
    
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error('No JSON found');
    }
    jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
    
    // Fix common issues
    jsonStr = jsonStr
      .replace(/≥/g, ' greater than or equal to ')
      .replace(/≤/g, ' less than or equal to ')
      .replace(/>/g, ' greater than ')
      .replace(/</g, ' less than ')
      .replace(/['']/g, "'")
      .replace(/[""]/g, '"')
      .replace(/,(\s*[}\]])/g, '$1');
    
    let parsed: AnatomyStructureData;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error(`  ⚠️  JSON parse error: ${parseError}`);
      
      // Try fixing string values with proper type annotations
      const fixed = jsonStr.replace(
        /"([^"]+)"\s*:\s*"([^"]*)"/g,
        (_match: string, key: string, value: string) => {
          if (value.includes('"')) {
            return `"${key}": "${value.replace(/"/g, "'")}"`;
          }
          return _match;
        }
      );
      
      try {
        parsed = JSON.parse(fixed);
        console.log(`  ℹ️  JSON fixed automatically`);
      } catch {
        if (retryCount === 0) {
          console.log(`  🔄 Retrying with simplified prompt...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          return generateAnatomyStructure(item, 1);
        }
        throw parseError;
      }
    }
    
    return parsed;
  } catch (error) {
    console.error(`  ❌ Error: ${error}`);
    if (retryCount === 0) {
      console.log(`  🔄 Retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return generateAnatomyStructure(item, 1);
    }
    return null;
  }
}

async function removeDuplicates() {
  console.log('\n🔍 Checking for duplicates...');
  const all = await prisma.anatomyStructure.findMany({
    select: { id: true, name: true, createdAt: true }
  });
  
  const toDelete: string[] = [];
  const seen = new Map<string, typeof all[0]>();
  
  for (const item of all) {
    const key = item.name.toLowerCase().trim();
    const existing = seen.get(key);
    
    if (existing) {
      if (item.createdAt > existing.createdAt) {
        toDelete.push(item.id);
        console.log(`  🗑️  Duplicate: "${item.name}"`);
      } else {
        toDelete.push(existing.id);
        seen.set(key, item);
        console.log(`  🗑️  Duplicate: "${existing.name}"`);
      }
    } else {
      seen.set(key, item);
    }
  }
  
  if (toDelete.length > 0) {
    await prisma.anatomyStructure.deleteMany({ where: { id: { in: toDelete } } });
    console.log(`  ✅ Removed ${toDelete.length} duplicate(s)`);
  } else {
    console.log(`  ✅ No duplicates found`);
  }
}

async function main() {
  console.log('🦴 AnatomyStructure Generator');
  console.log('='.repeat(60));
  
  await removeDuplicates();
  
  // High-yield PANCE anatomy structures organized by system/region
  const ITEMS_TO_GENERATE = [
    // HEAD & NECK - Nerves
    { name: 'Facial Nerve (CN VII)', category: 'Cranial Nerve' },
    { name: 'Trigeminal Nerve (CN V)', category: 'Cranial Nerve' },
    { name: 'Vagus Nerve (CN X)', category: 'Cranial Nerve' },
    { name: 'Glossopharyngeal Nerve (CN IX)', category: 'Cranial Nerve' },
    { name: 'Hypoglossal Nerve (CN XII)', category: 'Cranial Nerve' },
    { name: 'Accessory Nerve (CN XI)', category: 'Cranial Nerve' },
    { name: 'Oculomotor Nerve (CN III)', category: 'Cranial Nerve' },
    { name: 'Trochlear Nerve (CN IV)', category: 'Cranial Nerve' },
    { name: 'Abducens Nerve (CN VI)', category: 'Cranial Nerve' },
    { name: 'Optic Nerve (CN II)', category: 'Cranial Nerve' },
    { name: 'Olfactory Nerve (CN I)', category: 'Cranial Nerve' },
    { name: 'Vestibulocochlear Nerve (CN VIII)', category: 'Cranial Nerve' },
    
    // HEAD & NECK - Vessels
    { name: 'Carotid Artery', category: 'Head/Neck Vessel' },
    { name: 'Internal Jugular Vein', category: 'Head/Neck Vessel' },
    { name: 'External Jugular Vein', category: 'Head/Neck Vessel' },
    { name: 'Vertebral Artery', category: 'Head/Neck Vessel' },
    { name: 'Circle of Willis', category: 'Cerebral Vessel' },
    
    // HEAD & NECK - Muscles
    { name: 'Sternocleidomastoid Muscle', category: 'Neck Muscle' },
    { name: 'Scalene Muscles', category: 'Neck Muscle' },
    { name: 'Trapezius Muscle', category: 'Neck/Back Muscle' },
    
    // HEAD & NECK - Structures
    { name: 'Thyroid Gland', category: 'Endocrine Organ' },
    { name: 'Parathyroid Glands', category: 'Endocrine Organ' },
    { name: 'Parotid Gland', category: 'Salivary Gland' },
    { name: 'Submandibular Gland', category: 'Salivary Gland' },
    { name: 'Carotid Triangle', category: 'Anatomical Triangle' },
    { name: 'Posterior Triangle of Neck', category: 'Anatomical Triangle' },
    
    // UPPER EXTREMITY - Nerves
    { name: 'Brachial Plexus', category: 'Peripheral Nerve' },
    { name: 'Median Nerve', category: 'Peripheral Nerve' },
    { name: 'Ulnar Nerve', category: 'Peripheral Nerve' },
    { name: 'Radial Nerve', category: 'Peripheral Nerve' },
    { name: 'Musculocutaneous Nerve', category: 'Peripheral Nerve' },
    { name: 'Axillary Nerve', category: 'Peripheral Nerve' },
    { name: 'Long Thoracic Nerve', category: 'Peripheral Nerve' },
    
    // UPPER EXTREMITY - Muscles
    { name: 'Rotator Cuff', category: 'Shoulder Muscle Group' },
    { name: 'Supraspinatus Muscle', category: 'Shoulder Muscle' },
    { name: 'Infraspinatus Muscle', category: 'Shoulder Muscle' },
    { name: 'Subscapularis Muscle', category: 'Shoulder Muscle' },
    { name: 'Teres Minor Muscle', category: 'Shoulder Muscle' },
    { name: 'Deltoid Muscle', category: 'Shoulder Muscle' },
    { name: 'Biceps Brachii', category: 'Arm Muscle' },
    { name: 'Triceps Brachii', category: 'Arm Muscle' },
    { name: 'Thenar Muscles', category: 'Hand Muscle' },
    { name: 'Hypothenar Muscles', category: 'Hand Muscle' },
    { name: 'Interosseous Muscles of Hand', category: 'Hand Muscle' },
    
    // UPPER EXTREMITY - Bones/Joints
    { name: 'Shoulder Joint', category: 'Joint' },
    { name: 'Elbow Joint', category: 'Joint' },
    { name: 'Wrist Joint', category: 'Joint' },
    { name: 'Scaphoid Bone', category: 'Carpal Bone' },
    { name: 'Lunate Bone', category: 'Carpal Bone' },
    { name: 'Clavicle', category: 'Bone' },
    { name: 'Humerus', category: 'Bone' },
    { name: 'Radius', category: 'Bone' },
    { name: 'Ulna', category: 'Bone' },
    
    // UPPER EXTREMITY - Ligaments/Structures
    { name: 'Carpal Tunnel', category: 'Anatomical Space' },
    { name: 'Cubital Tunnel', category: 'Anatomical Space' },
    { name: 'Guyon Canal', category: 'Anatomical Space' },
    { name: 'Anatomical Snuffbox', category: 'Anatomical Region' },
    
    // THORAX
    { name: 'Heart', category: 'Thoracic Organ' },
    { name: 'Lungs', category: 'Thoracic Organ' },
    { name: 'Diaphragm', category: 'Thoracic Muscle' },
    { name: 'Intercostal Muscles', category: 'Thoracic Muscle' },
    { name: 'Aorta', category: 'Major Vessel' },
    { name: 'Superior Vena Cava', category: 'Major Vessel' },
    { name: 'Inferior Vena Cava', category: 'Major Vessel' },
    { name: 'Pulmonary Arteries', category: 'Pulmonary Vessel' },
    { name: 'Pulmonary Veins', category: 'Pulmonary Vessel' },
    { name: 'Coronary Arteries', category: 'Cardiac Vessel' },
    { name: 'Phrenic Nerve', category: 'Thoracic Nerve' },
    { name: 'Recurrent Laryngeal Nerve', category: 'Thoracic Nerve' },
    { name: 'Esophagus', category: 'Thoracic Organ' },
    { name: 'Trachea', category: 'Airway Structure' },
    { name: 'Bronchi', category: 'Airway Structure' },
    
    // ABDOMEN
    { name: 'Liver', category: 'Abdominal Organ' },
    { name: 'Gallbladder', category: 'Abdominal Organ' },
    { name: 'Stomach', category: 'Abdominal Organ' },
    { name: 'Small Intestine', category: 'Abdominal Organ' },
    { name: 'Large Intestine', category: 'Abdominal Organ' },
    { name: 'Appendix', category: 'Abdominal Organ' },
    { name: 'Spleen', category: 'Abdominal Organ' },
    { name: 'Pancreas', category: 'Abdominal Organ' },
    { name: 'Kidneys', category: 'Retroperitoneal Organ' },
    { name: 'Adrenal Glands', category: 'Retroperitoneal Organ' },
    { name: 'Abdominal Aorta', category: 'Abdominal Vessel' },
    { name: 'Celiac Trunk', category: 'Abdominal Vessel' },
    { name: 'Superior Mesenteric Artery', category: 'Abdominal Vessel' },
    { name: 'Inferior Mesenteric Artery', category: 'Abdominal Vessel' },
    { name: 'Portal Vein', category: 'Abdominal Vessel' },
    { name: 'Inguinal Canal', category: 'Abdominal Structure' },
    { name: 'Rectus Abdominis', category: 'Abdominal Muscle' },
    { name: 'External Oblique Muscle', category: 'Abdominal Muscle' },
    { name: 'Internal Oblique Muscle', category: 'Abdominal Muscle' },
    { name: 'Transversus Abdominis', category: 'Abdominal Muscle' },
    
    // PELVIS
    { name: 'Bladder', category: 'Pelvic Organ' },
    { name: 'Prostate Gland', category: 'Male Reproductive' },
    { name: 'Uterus', category: 'Female Reproductive' },
    { name: 'Ovaries', category: 'Female Reproductive' },
    { name: 'Fallopian Tubes', category: 'Female Reproductive' },
    { name: 'Rectum', category: 'Pelvic Organ' },
    { name: 'Pelvic Floor Muscles', category: 'Pelvic Muscle' },
    { name: 'Pudendal Nerve', category: 'Pelvic Nerve' },
    { name: 'Iliac Arteries', category: 'Pelvic Vessel' },
    
    // SPINE
    { name: 'Cervical Vertebrae', category: 'Spine' },
    { name: 'Thoracic Vertebrae', category: 'Spine' },
    { name: 'Lumbar Vertebrae', category: 'Spine' },
    { name: 'Sacrum', category: 'Spine' },
    { name: 'Coccyx', category: 'Spine' },
    { name: 'Intervertebral Disc', category: 'Spine Structure' },
    { name: 'Spinal Cord', category: 'Central Nervous System' },
    { name: 'Cauda Equina', category: 'Spinal Structure' },
    { name: 'Ligamentum Flavum', category: 'Spinal Ligament' },
    { name: 'Anterior Longitudinal Ligament', category: 'Spinal Ligament' },
    { name: 'Posterior Longitudinal Ligament', category: 'Spinal Ligament' },
    
    // LOWER EXTREMITY - Nerves
    { name: 'Sciatic Nerve', category: 'Peripheral Nerve' },
    { name: 'Femoral Nerve', category: 'Peripheral Nerve' },
    { name: 'Tibial Nerve', category: 'Peripheral Nerve' },
    { name: 'Common Peroneal Nerve', category: 'Peripheral Nerve' },
    { name: 'Deep Peroneal Nerve', category: 'Peripheral Nerve' },
    { name: 'Superficial Peroneal Nerve', category: 'Peripheral Nerve' },
    { name: 'Obturator Nerve', category: 'Peripheral Nerve' },
    { name: 'Lateral Femoral Cutaneous Nerve', category: 'Peripheral Nerve' },
    
    // LOWER EXTREMITY - Muscles
    { name: 'Quadriceps Femoris', category: 'Thigh Muscle' },
    { name: 'Hamstring Muscles', category: 'Thigh Muscle' },
    { name: 'Gluteus Maximus', category: 'Hip Muscle' },
    { name: 'Gluteus Medius', category: 'Hip Muscle' },
    { name: 'Iliopsoas Muscle', category: 'Hip Flexor' },
    { name: 'Adductor Muscles', category: 'Thigh Muscle' },
    { name: 'Gastrocnemius Muscle', category: 'Leg Muscle' },
    { name: 'Soleus Muscle', category: 'Leg Muscle' },
    { name: 'Tibialis Anterior', category: 'Leg Muscle' },
    { name: 'Tibialis Posterior', category: 'Leg Muscle' },
    { name: 'Peroneal Muscles', category: 'Leg Muscle' },
    
    // LOWER EXTREMITY - Bones/Joints
    { name: 'Hip Joint', category: 'Joint' },
    { name: 'Knee Joint', category: 'Joint' },
    { name: 'Ankle Joint', category: 'Joint' },
    { name: 'Femur', category: 'Bone' },
    { name: 'Tibia', category: 'Bone' },
    { name: 'Fibula', category: 'Bone' },
    { name: 'Patella', category: 'Bone' },
    { name: 'Calcaneus', category: 'Tarsal Bone' },
    { name: 'Talus', category: 'Tarsal Bone' },
    
    // LOWER EXTREMITY - Ligaments/Structures
    { name: 'Anterior Cruciate Ligament (ACL)', category: 'Knee Ligament' },
    { name: 'Posterior Cruciate Ligament (PCL)', category: 'Knee Ligament' },
    { name: 'Medial Collateral Ligament (MCL)', category: 'Knee Ligament' },
    { name: 'Lateral Collateral Ligament (LCL)', category: 'Knee Ligament' },
    { name: 'Meniscus', category: 'Knee Structure' },
    { name: 'Achilles Tendon', category: 'Tendon' },
    { name: 'Plantar Fascia', category: 'Foot Structure' },
    { name: 'Tarsal Tunnel', category: 'Anatomical Space' },
    { name: 'Femoral Triangle', category: 'Anatomical Triangle' },
    { name: 'Popliteal Fossa', category: 'Anatomical Region' },
    
    // LOWER EXTREMITY - Vessels
    { name: 'Femoral Artery', category: 'Lower Extremity Vessel' },
    { name: 'Popliteal Artery', category: 'Lower Extremity Vessel' },
    { name: 'Posterior Tibial Artery', category: 'Lower Extremity Vessel' },
    { name: 'Dorsalis Pedis Artery', category: 'Lower Extremity Vessel' },
    { name: 'Great Saphenous Vein', category: 'Lower Extremity Vessel' },
    { name: 'Small Saphenous Vein', category: 'Lower Extremity Vessel' },
    { name: 'Deep Veins of Lower Extremity', category: 'Lower Extremity Vessel' },
    
    // DERMATOMES & MYOTOMES (high-yield for PANCE)
    { name: 'C5 Dermatome/Myotome', category: 'Dermatome' },
    { name: 'C6 Dermatome/Myotome', category: 'Dermatome' },
    { name: 'C7 Dermatome/Myotome', category: 'Dermatome' },
    { name: 'C8 Dermatome/Myotome', category: 'Dermatome' },
    { name: 'T1 Dermatome/Myotome', category: 'Dermatome' },
    { name: 'L4 Dermatome/Myotome', category: 'Dermatome' },
    { name: 'L5 Dermatome/Myotome', category: 'Dermatome' },
    { name: 'S1 Dermatome/Myotome', category: 'Dermatome' },
    
    // === ADDITIONAL COMPREHENSIVE PANCE ANATOMY ===
    
    // HEAD - Additional Structures
    { name: 'Cerebrum', category: 'Brain Structure' },
    { name: 'Cerebellum', category: 'Brain Structure' },
    { name: 'Brainstem', category: 'Brain Structure' },
    { name: 'Thalamus', category: 'Brain Structure' },
    { name: 'Hypothalamus', category: 'Brain Structure' },
    { name: 'Pituitary Gland', category: 'Brain Structure' },
    { name: 'Basal Ganglia', category: 'Brain Structure' },
    { name: 'Hippocampus', category: 'Brain Structure' },
    { name: 'Amygdala', category: 'Brain Structure' },
    { name: 'Corpus Callosum', category: 'Brain Structure' },
    { name: 'Frontal Lobe', category: 'Brain Region' },
    { name: 'Parietal Lobe', category: 'Brain Region' },
    { name: 'Temporal Lobe', category: 'Brain Region' },
    { name: 'Occipital Lobe', category: 'Brain Region' },
    { name: 'Meninges', category: 'CNS Covering' },
    { name: 'Dura Mater', category: 'CNS Covering' },
    { name: 'Arachnoid Mater', category: 'CNS Covering' },
    { name: 'Pia Mater', category: 'CNS Covering' },
    { name: 'Cerebral Ventricles', category: 'CSF System' },
    { name: 'Choroid Plexus', category: 'CSF System' },
    
    // EYE Anatomy
    { name: 'Retina', category: 'Eye Structure' },
    { name: 'Cornea', category: 'Eye Structure' },
    { name: 'Lens', category: 'Eye Structure' },
    { name: 'Iris', category: 'Eye Structure' },
    { name: 'Ciliary Body', category: 'Eye Structure' },
    { name: 'Optic Disc', category: 'Eye Structure' },
    { name: 'Macula', category: 'Eye Structure' },
    { name: 'Aqueous Humor', category: 'Eye Structure' },
    { name: 'Vitreous Humor', category: 'Eye Structure' },
    { name: 'Extraocular Muscles', category: 'Eye Muscle' },
    
    // EAR Anatomy
    { name: 'External Ear', category: 'Ear Structure' },
    { name: 'Tympanic Membrane', category: 'Ear Structure' },
    { name: 'Ossicles', category: 'Middle Ear' },
    { name: 'Cochlea', category: 'Inner Ear' },
    { name: 'Semicircular Canals', category: 'Inner Ear' },
    { name: 'Eustachian Tube', category: 'Ear Structure' },
    
    // ORAL/PHARYNGEAL
    { name: 'Tongue', category: 'Oral Structure' },
    { name: 'Soft Palate', category: 'Oral Structure' },
    { name: 'Tonsils', category: 'Lymphoid Tissue' },
    { name: 'Adenoids', category: 'Lymphoid Tissue' },
    { name: 'Larynx', category: 'Airway Structure' },
    { name: 'Vocal Cords', category: 'Laryngeal Structure' },
    { name: 'Epiglottis', category: 'Laryngeal Structure' },
    
    // CARDIAC Detailed
    { name: 'Right Atrium', category: 'Cardiac Chamber' },
    { name: 'Left Atrium', category: 'Cardiac Chamber' },
    { name: 'Right Ventricle', category: 'Cardiac Chamber' },
    { name: 'Left Ventricle', category: 'Cardiac Chamber' },
    { name: 'Mitral Valve', category: 'Cardiac Valve' },
    { name: 'Tricuspid Valve', category: 'Cardiac Valve' },
    { name: 'Aortic Valve', category: 'Cardiac Valve' },
    { name: 'Pulmonic Valve', category: 'Cardiac Valve' },
    { name: 'SA Node', category: 'Cardiac Conduction' },
    { name: 'AV Node', category: 'Cardiac Conduction' },
    { name: 'Bundle of His', category: 'Cardiac Conduction' },
    { name: 'Purkinje Fibers', category: 'Cardiac Conduction' },
    { name: 'Pericardium', category: 'Cardiac Structure' },
    { name: 'Interventricular Septum', category: 'Cardiac Structure' },
    
    // PULMONARY Detailed
    { name: 'Right Lung', category: 'Pulmonary Organ' },
    { name: 'Left Lung', category: 'Pulmonary Organ' },
    { name: 'Lung Lobes', category: 'Pulmonary Structure' },
    { name: 'Alveoli', category: 'Pulmonary Structure' },
    { name: 'Bronchioles', category: 'Airway Structure' },
    { name: 'Pleura', category: 'Pulmonary Covering' },
    { name: 'Pleural Space', category: 'Thoracic Space' },
    { name: 'Mediastinum', category: 'Thoracic Space' },
    
    // GI Detailed
    { name: 'Duodenum', category: 'Small Intestine' },
    { name: 'Jejunum', category: 'Small Intestine' },
    { name: 'Ileum', category: 'Small Intestine' },
    { name: 'Ascending Colon', category: 'Large Intestine' },
    { name: 'Transverse Colon', category: 'Large Intestine' },
    { name: 'Descending Colon', category: 'Large Intestine' },
    { name: 'Sigmoid Colon', category: 'Large Intestine' },
    { name: 'Cecum', category: 'Large Intestine' },
    { name: 'Hepatic Flexure', category: 'Large Intestine' },
    { name: 'Splenic Flexure', category: 'Large Intestine' },
    { name: 'Common Bile Duct', category: 'Biliary System' },
    { name: 'Cystic Duct', category: 'Biliary System' },
    { name: 'Hepatic Duct', category: 'Biliary System' },
    { name: 'Ampulla of Vater', category: 'Biliary System' },
    { name: 'Sphincter of Oddi', category: 'Biliary System' },
    { name: 'Greater Omentum', category: 'Peritoneal Structure' },
    { name: 'Lesser Omentum', category: 'Peritoneal Structure' },
    { name: 'Mesentery', category: 'Peritoneal Structure' },
    
    // RENAL/URINARY Detailed
    { name: 'Renal Cortex', category: 'Kidney Structure' },
    { name: 'Renal Medulla', category: 'Kidney Structure' },
    { name: 'Nephron', category: 'Kidney Structure' },
    { name: 'Glomerulus', category: 'Kidney Structure' },
    { name: 'Renal Pelvis', category: 'Urinary System' },
    { name: 'Ureter', category: 'Urinary System' },
    { name: 'Urethra', category: 'Urinary System' },
    { name: 'Renal Artery', category: 'Renal Vessel' },
    { name: 'Renal Vein', category: 'Renal Vessel' },
    
    // ENDOCRINE
    { name: 'Anterior Pituitary', category: 'Endocrine Gland' },
    { name: 'Posterior Pituitary', category: 'Endocrine Gland' },
    { name: 'Pineal Gland', category: 'Endocrine Gland' },
    { name: 'Pancreatic Islets', category: 'Endocrine Gland' },
    { name: 'Adrenal Cortex', category: 'Adrenal Gland' },
    { name: 'Adrenal Medulla', category: 'Adrenal Gland' },
    { name: 'Thymus', category: 'Lymphoid/Endocrine' },
    
    // LYMPHATIC
    { name: 'Cervical Lymph Nodes', category: 'Lymph Node' },
    { name: 'Axillary Lymph Nodes', category: 'Lymph Node' },
    { name: 'Inguinal Lymph Nodes', category: 'Lymph Node' },
    { name: 'Mediastinal Lymph Nodes', category: 'Lymph Node' },
    { name: 'Thoracic Duct', category: 'Lymphatic Vessel' },
    { name: 'Right Lymphatic Duct', category: 'Lymphatic Vessel' },
    
    // REPRODUCTIVE - Male
    { name: 'Testes', category: 'Male Reproductive' },
    { name: 'Epididymis', category: 'Male Reproductive' },
    { name: 'Vas Deferens', category: 'Male Reproductive' },
    { name: 'Seminal Vesicles', category: 'Male Reproductive' },
    { name: 'Penis', category: 'Male Reproductive' },
    { name: 'Scrotum', category: 'Male Reproductive' },
    
    // REPRODUCTIVE - Female Detailed
    { name: 'Cervix', category: 'Female Reproductive' },
    { name: 'Vagina', category: 'Female Reproductive' },
    { name: 'Vulva', category: 'Female Reproductive' },
    { name: 'Endometrium', category: 'Female Reproductive' },
    { name: 'Myometrium', category: 'Female Reproductive' },
    { name: 'Broad Ligament', category: 'Female Reproductive' },
    { name: 'Round Ligament', category: 'Female Reproductive' },
    
    // SKIN/INTEGUMENTARY
    { name: 'Epidermis', category: 'Skin Layer' },
    { name: 'Dermis', category: 'Skin Layer' },
    { name: 'Hypodermis', category: 'Skin Layer' },
    { name: 'Hair Follicle', category: 'Skin Appendage' },
    { name: 'Sebaceous Gland', category: 'Skin Appendage' },
    { name: 'Sweat Glands', category: 'Skin Appendage' },
    { name: 'Nail', category: 'Skin Appendage' }
  ];
  
  console.log(`\nGenerating ${ITEMS_TO_GENERATE.length} anatomy structure records...\n`);
  
  const existing = await prisma.anatomyStructure.findMany({ 
    select: { name: true, id: true } 
  });
  const existingNames = new Set(existing.map(e => e.name.toLowerCase()));
  
  let created = 0;
  let skipped = 0;
  let failed = 0;
  
  for (const item of ITEMS_TO_GENERATE) {
    if (existingNames.has(item.name.toLowerCase())) {
      console.log(`  ⏭️  Skipped: ${item.name}`);
      skipped++;
      continue;
    }
    
    console.log(`  🔄 Creating: ${item.name}...`);
    const data = await generateAnatomyStructure(item);
    
    if (!data) {
      failed++;
      continue;
    }
    
    try {
      // Remove any relation fields that might be in the response
      const { AnatomyConditionLink, Condition, ...createData } = data as any;
      
      await prisma.anatomyStructure.create({
        data: {
          id: crypto.randomUUID(),
          ...createData,
          updatedAt: new Date()
        }
      });
      
      existingNames.add(item.name.toLowerCase());
      created++;
      console.log(`  ✅ Created: ${item.name}`);
    } catch (error) {
      console.error(`  ❌ Failed to save: ${error}`);
      failed++;
    }
    
    await new Promise(resolve => setTimeout(resolve, 800));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:');
  console.log(`   Created: ${created}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Failed: ${failed}`);
  
  const total = await prisma.anatomyStructure.count();
  console.log(`   Total in database: ${total}`);
  
  await prisma.$disconnect();
}

main().catch(console.error);
