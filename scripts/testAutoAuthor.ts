#!/usr/bin/env tsx
/**
 * Test Auto-Author Content Generation
 * 
 * Validates that the content generator works without touching the database.
 * Useful for testing prompts and API connectivity.
 */

import { config } from "dotenv";
import { generateConditionContent } from "../lib/services/autoAuthor/contentGenerator";
import type { GeneratedConditionContent } from "../lib/services/autoAuthor/types";

config();

const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "";

if (!apiKey) {
  console.error("❌ Error: GEMINI_API_KEY or GOOGLE_API_KEY environment variable is required");
  process.exit(1);
}

async function testContentGeneration() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║         Auto-Author Content Generation Test               ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  const testConditions = [
    { conditionName: "Atrial Fibrillation", system: "CV" },
    { conditionName: "Acute Coronary Syndrome", system: "CV" },
    { conditionName: "Community-Acquired Pneumonia", system: "PULM" },
  ];

  let successCount = 0;
  let failCount = 0;

  for (const { conditionName, system } of testConditions) {
    console.log(`\n🧪 Testing: ${conditionName} (${system})`);
    console.log("━".repeat(60));

    try {
      const result = await generateConditionContent(apiKey, {
        conditionName,
        system,
        includeExtendedFields: true,
      });

      if (result.success && result.content) {
        successCount++;
        console.log("✅ Generation successful!");
        
        // Validate structure
        const content = result.content;
        console.log("\n📋 Generated Content:");
        console.log(`   Overview: ${content.overview.substring(0, 80)}...`);
        console.log(`   Symptoms: ${content.symptoms.length} items`);
        console.log(`   Risk Factors: ${content.riskFactors.length} items`);
        console.log(`   Clinical Pearls: ${content.clinicalPearls.length} items`);
        
        // Validate required fields
        const requiredFields = ['overview', 'symptoms', 'diagnosis', 'treatment', 'riskFactors', 'clinicalPearls'];
        const missingFields = requiredFields.filter(field => {
          const value = (content as any)[field];
          if (Array.isArray(value)) {
            return value.length === 0;
          }
          return !value;
        });
        
        if (missingFields.length > 0) {
          console.log(`\n⚠️  Warning: Missing or empty fields: ${missingFields.join(', ')}`);
        } else {
          console.log("\n✅ All required fields present and populated");
        }
        
      } else {
        failCount++;
        console.log(`❌ Generation failed: ${result.error}`);
      }
    } catch (error: any) {
      failCount++;
      console.log(`❌ Exception: ${error.message}`);
    }

    // Rate limiting
    if (testConditions.indexOf({ conditionName, system }) < testConditions.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║                       Test Summary                         ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  console.log(`Total Tests: ${testConditions.length}`);
  console.log(`✅ Passed: ${successCount}`);
  console.log(`❌ Failed: ${failCount}\n`);

  if (failCount === 0) {
    console.log("🎉 All tests passed! Auto-author is working correctly.\n");
    process.exit(0);
  } else {
    console.log("⚠️  Some tests failed. Check errors above.\n");
    process.exit(1);
  }
}

testContentGeneration().catch((error) => {
  console.error("\n❌ Fatal error:", error);
  process.exit(1);
});
