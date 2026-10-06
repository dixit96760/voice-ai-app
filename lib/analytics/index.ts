export interface CampaignAnalyticsSummary {
  totalCalls: number;
  answered: number;
  completed: number;
  failed: number;
  noAnswer: number;
  busy: number;
  averageDurationSeconds: number;
  totalTalkTimeSeconds: number;
  interestedCount: number;
  callbackCount: number;
  notInterestedCount: number;
  dncCount: number;
}
