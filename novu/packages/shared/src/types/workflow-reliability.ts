export enum NotificationPriorityEnum {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ReliabilityGuardKindEnum {
  IDEMPOTENCY = 'idempotency',
  DEDUPLICATION = 'deduplication',
  RATE_LIMIT = 'rate_limit',
}

export enum ReliabilityControlActionEnum {
  SKIP = 'skip',
  DELAY = 'delay',
  FAIL = 'fail',
}

export enum RetryBackoffStrategyEnum {
  FIXED = 'fixed',
  EXPONENTIAL = 'exponential',
}

export type StepRetryConfig = {
  attempts?: number;
  backoffMs?: number;
  strategy?: RetryBackoffStrategyEnum;
};

export type WorkflowDeduplicationConfig = {
  enabled?: boolean;
  windowMs?: number;
  payloadPaths?: string[];
  action?: ReliabilityControlActionEnum;
};

export type WorkflowRateLimitConfig = {
  enabled?: boolean;
  maxPerWindow?: number;
  windowMs?: number;
  action?: ReliabilityControlActionEnum;
};

export type WorkflowReliabilityConfig = {
  retry?: StepRetryConfig;
  deduplication?: WorkflowDeduplicationConfig;
  rateLimit?: WorkflowRateLimitConfig;
  defaultPriority?: NotificationPriorityEnum;
};
