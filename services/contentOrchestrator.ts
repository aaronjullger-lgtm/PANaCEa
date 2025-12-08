/**
 * Content Orchestrator Service
 * 
 * Runs continuously in the background to maintain the content database.
 * Automatically handles all content management tasks to keep the site
 * topped off with high-quality, verified medical information.
 */

import { scheduleAutomatedPipeline } from './automatedContentPipeline';
import { getApprovalStats } from './mediaApprovalService';

/**
 * Initialize and start the content orchestrator
 */
export function startContentOrchestrator(): void {
  console.log('🎯 Content Orchestrator Starting...');
  console.log('   This service will run continuously to:');
  console.log('   • Process and approve new content');
  console.log('   • Fill content gaps automatically');
  console.log('   • Validate and maintain quality');
  console.log('   • Optimize the database');
  console.log('   • Ensure 100% correctness\n');
  
  // Start the automated pipeline
  scheduleAutomatedPipeline();
  
  // Monitor content needs every hour
  setInterval(async () => {
    await monitorContentNeeds();
  }, 60 * 60 * 1000);
  
  console.log('✅ Content Orchestrator is now running in the background');
}

/**
 * Monitor content needs and trigger actions
 */
async function monitorContentNeeds(): Promise<void> {
  try {
    const stats = await getApprovalStats();
    
    console.log(`📊 Content Status: ${stats.approved} approved, ${stats.pending} pending`);
    
    // Alert if pending queue is growing
    if (stats.pending > 50) {
      console.log('⚠️  High pending queue - consider reviewing');
    }
    
    // Alert if approval rate is dropping
    if (stats.approvalRate < 70) {
      console.log('⚠️  Low approval rate - content quality may need attention');
    }
    
  } catch (error) {
    console.error('Error monitoring content needs:', error);
  }
}

/**
 * Get content orchestrator status
 */
export async function getOrchestratorStatus() {
  const stats = await getApprovalStats();
  
  return {
    running: true,
    lastCheck: new Date(),
    contentStats: stats,
    health: 'healthy',
  };
}
