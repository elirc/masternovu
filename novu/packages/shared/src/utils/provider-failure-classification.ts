import { ProviderFailureCategoryEnum } from '../types';

export function classifyProviderFailure(error: unknown): ProviderFailureCategoryEnum {
  const status = getStatus(error);
  const message = getMessage(error).toLowerCase();

  if (status === 401 || status === 403 || /unauthorized|forbidden|invalid api|invalid key|auth/.test(message)) {
    return ProviderFailureCategoryEnum.AUTHENTICATION;
  }

  if (status === 429 || /rate limit|too many requests|quota|throttle/.test(message)) {
    return ProviderFailureCategoryEnum.RATE_LIMIT;
  }

  if (
    status === 400 ||
    status === 404 ||
    /invalid recipient|invalid phone|invalid email|recipient|not found|unknown user|bad request/.test(message)
  ) {
    return ProviderFailureCategoryEnum.RECIPIENT;
  }

  if (status >= 500 || /timeout|timed out|econnreset|econnrefused|unavailable|service down|gateway/.test(message)) {
    return ProviderFailureCategoryEnum.PROVIDER_OUTAGE;
  }

  return ProviderFailureCategoryEnum.UNKNOWN;
}

function getStatus(error: unknown): number | undefined {
  const record = error as Record<string, any>;

  return record?.status || record?.statusCode || record?.response?.status || record?.response?.statusCode;
}

function getMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  const record = error as Record<string, any>;

  return record?.message || record?.name || record?.response?.data?.message || JSON.stringify(error || {});
}
