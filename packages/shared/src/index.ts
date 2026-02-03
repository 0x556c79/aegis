/**
 * Shared types/utilities across AEGIS packages.
 * Keep this package dependency-light.
 */

export type SwarmAgentName = 'overseer' | 'analyst' | 'trader' | 'sentinel' | 'scribe';

export interface SwarmEvent<T = unknown> {
  id: string;
  type: string;
  agent: SwarmAgentName;
  timestamp: number;
  payload: T;
}
