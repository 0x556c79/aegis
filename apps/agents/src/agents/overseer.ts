/**
 * OVERSEER Agent - Orchestrator
 * 
 * Coordinates all agents, manages consensus, and handles human-in-the-loop.
 * This is the brain of the AEGIS swarm.
 */

import { z } from 'zod';
import { 
  AgentProposal, 
  ConsensusResult, 
  PendingAction, 
  SwarmTask, 
  TaskResult 
} from '@aegis/shared';

export const OverseerConfigSchema = z.object({
  consensusThreshold: z.number().min(0.5).max(1).default(0.6),
  maxConcurrentTasks: z.number().int().positive().default(5),
  humanApprovalThreshold: z.number().positive().default(100), // USD value requiring approval
});

export type OverseerConfig = z.infer<typeof OverseerConfigSchema>;

export class Overseer {
  private config: OverseerConfig;

  constructor(config: Partial<OverseerConfig> = {}) {
    this.config = OverseerConfigSchema.parse(config);
  }

  /**
   * Coordinate agent consensus on a proposed action
   */
  async coordinateConsensus(proposal: AgentProposal, votes: { agent: string; vote: boolean; confidence: number }[]): Promise<ConsensusResult> {
    // Calculate weighted score based on confidence
    let totalScore = 0;
    let maxPossibleScore = 0;

    for (const vote of votes) {
      // Confidence is 0-1
      const weight = vote.confidence;
      maxPossibleScore += weight;
      if (vote.vote) {
        totalScore += weight;
      }
    }

    // Normalize score to 0-1
    const finalScore = maxPossibleScore > 0 ? totalScore / maxPossibleScore : 0;
    const approved = finalScore >= this.config.consensusThreshold;

    return {
      approved,
      votes,
      finalScore
    };
  }

  /**
   * Check if an action requires human approval
   * Returns true if approval is REQUIRED and NOT YET GRANTED.
   * In a real flow, this would trigger the wallet UI.
   */
  async requestHumanApproval(action: PendingAction): Promise<boolean> {
    // If the value is below threshold, auto-approve (return false = no human approval needed)
    if (action.estimatedValue < this.config.humanApprovalThreshold) {
      return false; 
    }

    // If above threshold, we need human approval.
    // In this backend simulation, we return true to indicate "Pending Approval".
    // The calling workflow would then pause or send a notification.
    console.log(`[Overseer] Action ${action.id} ($${action.estimatedValue}) requires human approval.`);
    return true;
  }

  /**
   * Dispatch tasks to specialized agents
   */
  async dispatchTask(task: SwarmTask): Promise<TaskResult> {
    console.log(`[Overseer] Dispatching task: ${task.type} (${task.id})`);

    try {
      // Mock dispatch logic - in a real system this would use an event bus or direct agent calls
      switch (task.type) {
        case 'analyze_token':
          return { success: true, data: { message: "Dispatched to Analyst" } };
        case 'execute_trade':
          return { success: true, data: { message: "Dispatched to Trader" } };
        case 'check_risk':
          return { success: true, data: { message: "Dispatched to Sentinel" } };
        case 'generate_report':
          return { success: true, data: { message: "Dispatched to Scribe" } };
        default:
          return { success: false, error: `Unknown task type: ${task.type}` };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
