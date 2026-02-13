export interface UsageBucket {
  utilization: number;
  resets_at: string | null;
}

export interface UsageData {
  five_hour: UsageBucket;
  seven_day: UsageBucket;
  seven_day_sonnet?: UsageBucket;
}
