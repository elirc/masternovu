export enum ProviderFailureCategoryEnum {
  AUTHENTICATION = 'authentication',
  RATE_LIMIT = 'rate_limit',
  RECIPIENT = 'recipient',
  PROVIDER_OUTAGE = 'provider_outage',
  UNKNOWN = 'unknown',
}

export enum IntegrationHealthStatusEnum {
  HEALTHY = 'healthy',
  WARNING = 'warning',
  UNHEALTHY = 'unhealthy',
}

export enum IntegrationIncidentStatusEnum {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  DISABLED = 'disabled',
  MAINTENANCE = 'maintenance',
}

export type ProviderHealthCheck = {
  status?: IntegrationHealthStatusEnum;
  checkedAt?: string;
  checkedBy?: string;
  message?: string;
};

export type CredentialRotationReminder = {
  lastRotatedAt?: string;
  reminderAfterDays?: number;
  updatedBy?: string;
};

export type ProviderRateLimitConfig = {
  enabled?: boolean;
  maxPerWindow?: number;
  windowMs?: number;
};

export type ProviderFailoverRule = {
  enabled?: boolean;
  fallbackIntegrationIds?: string[];
  failureCategories?: ProviderFailureCategoryEnum[];
};

export type IntegrationIncident = {
  status?: IntegrationIncidentStatusEnum;
  message?: string;
  updatedAt?: string;
  updatedBy?: string;
};

export type WebhookSecurityConfig = {
  sharedSecret?: string;
  sharedSecretSet?: boolean;
  requiredHeaders?: string[];
  signatureHeader?: string;
};

export type WebhookSignatureAudit = {
  verified?: boolean;
  checkedAt?: string;
  source?: string;
  reason?: string;
};

export type IntegrationOperationsConfig = {
  healthCheck?: ProviderHealthCheck;
  credentialRotation?: CredentialRotationReminder;
  rateLimit?: ProviderRateLimitConfig;
  failover?: ProviderFailoverRule;
  incident?: IntegrationIncident;
  webhookSecurity?: WebhookSecurityConfig;
  webhookSignatureAudit?: WebhookSignatureAudit;
};
