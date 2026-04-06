export interface AgentCreditsStats {
  available: number;
  unlockGap: number;
  unlockLabel: string;
  unlockProgress: number;
  weeklyDelta: string;
  spentOnAi: string;
  referralBonus: string;
  inviteReward: string;
}

export const AGENT_CREDITS_STATS: AgentCreditsStats = {
  available: 2360,
  unlockGap: 640,
  unlockLabel: 'Pro Agent Routing',
  unlockProgress: 79,
  weeklyDelta: '+980',
  spentOnAi: '-410',
  referralBonus: '+650',
  inviteReward: '+1,000',
};
