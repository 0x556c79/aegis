import { describe, it, expect, beforeEach } from 'vitest';
import { Overseer, OverseerConfig } from '../src/agents/overseer';
import { AgentProposal, PendingAction } from '@aegis/shared';

describe('Overseer Agent', () => {
  let overseer: Overseer;
  const config: Partial<OverseerConfig> = {
    consensusThreshold: 0.6,
    humanApprovalThreshold: 1000
  };

  beforeEach(() => {
    overseer = new Overseer(config);
  });

  describe('coordinateConsensus', () => {
    const proposal: AgentProposal = {
      id: 'prop-1',
      type: 'trade',
      proposedBy: 'analyst',
      details: {},
      timestamp: new Date()
    };

    it('should approve when consensus threshold is met', async () => {
      const votes = [
        { agent: 'analyst', vote: true, confidence: 0.9 },
        { agent: 'sentinel', vote: true, confidence: 0.8 },
        { agent: 'trader', vote: false, confidence: 0.2 } // Disagreement but low confidence
      ];

      // Total weight: 1.9
      // Yes weight: 1.7
      // Score: 1.7 / 1.9 = 0.89 > 0.6
      const result = await overseer.coordinateConsensus(proposal, votes);
      expect(result.approved).toBe(true);
      expect(result.finalScore).toBeGreaterThan(0.6);
    });

    it('should reject when consensus threshold is not met', async () => {
      const votes = [
        { agent: 'analyst', vote: true, confidence: 0.5 },
        { agent: 'sentinel', vote: false, confidence: 0.9 }, // Strong reject
        { agent: 'trader', vote: false, confidence: 0.8 }
      ];

      // Total weight: 2.2
      // Yes weight: 0.5
      // Score: 0.5 / 2.2 = 0.22 < 0.6
      const result = await overseer.coordinateConsensus(proposal, votes);
      expect(result.approved).toBe(false);
    });
  });

  describe('requestHumanApproval', () => {
    it('should require approval for high value actions', async () => {
      const action: PendingAction = {
        id: 'act-1',
        type: 'swap',
        estimatedValue: 2000, // > 1000
        description: 'Swap SOL for USDC'
      };

      const requiresApproval = await overseer.requestHumanApproval(action);
      expect(requiresApproval).toBe(true);
    });

    it('should auto-approve low value actions', async () => {
      const action: PendingAction = {
        id: 'act-2',
        type: 'swap',
        estimatedValue: 500, // < 1000
        description: 'Small swap'
      };

      const requiresApproval = await overseer.requestHumanApproval(action);
      expect(requiresApproval).toBe(false);
    });
  });
});
