import { ChannelTypeEnum, IEnvironment, IIntegration } from '@novu/shared';
import { del, get, post, put } from './api.client';

export type HealthCheckStatus = 'ready' | 'pending' | 'failed';

export type MsTeamsHealthCheckResult = {
  appRegistration: HealthCheckStatus | null;
  azureBotCreated: HealthCheckStatus | null;
  teamsAppCatalog: HealthCheckStatus | null;
  permissions: HealthCheckStatus | null;
  allReady: boolean;
};

export type CreateIntegrationData = {
  providerId: string;
  channel: ChannelTypeEnum;
  credentials: Record<string, unknown>;
  configurations: Record<string, string>;
  name: string;
  identifier?: string;
  active: boolean;
  primary?: boolean;
  _environmentId: string;
};

export enum CheckIntegrationResponseEnum {
  INVALID_EMAIL = 'invalid_email',
  BAD_CREDENTIALS = 'bad_credentials',
  SUCCESS = 'success',
  FAILED = 'failed',
}

export type UpdateIntegrationData = {
  name: string;
  identifier: string;
  active: boolean;
  primary: boolean;
  credentials: Record<string, unknown>;
  configurations: Record<string, string>;
  check: boolean;
};

export type IntegrationOperationsConfig = Record<string, unknown>;

export type IntegrationHealthCheckResponse = {
  status: 'healthy' | 'warning' | 'unhealthy';
  checkedAt: string;
  message?: string;
};

export type WebhookSignatureVerificationResponse = {
  verified: boolean;
  checkedAt: string;
  reason?: string;
};

export type ProviderFailureClassificationResponse = {
  category: 'authentication' | 'rate_limit' | 'recipient' | 'provider_outage' | 'unknown';
};

export async function getIntegrations({ environment }: { environment: IEnvironment }) {
  // TODO: This is a technical debt on the API side.
  // Integrations work across environments, so we should not need to pass the environment ID here.
  const { data } = await get<{ data: IIntegration[] }>('/integrations', { environment });

  return data;
}

export async function deleteIntegration({ id, environment }: { id: string; environment: IEnvironment }) {
  return del<{ acknowledged: boolean; status: number }>(`/integrations/${id}`, {
    environment: environment,
  });
}

export async function createIntegration(data: CreateIntegrationData, environment: IEnvironment) {
  return await post<{ data: IIntegration }>('/integrations', {
    body: data,
    environment: environment,
  });
}

export async function setAsPrimaryIntegration(integrationId: string, environment: IEnvironment) {
  return post(`/integrations/${integrationId}/set-primary`, {
    environment: environment,
  });
}

export type AutoConfigureIntegrationResponse = {
  success: boolean;
  message?: string;
  integration?: IIntegration;
};

export async function autoConfigureIntegration(integrationId: string, environment: IEnvironment) {
  const response = await post<{ data: AutoConfigureIntegrationResponse }>(
    `/integrations/${integrationId}/auto-configure`,
    {
      environment: environment,
    }
  );

  return response.data;
}

export async function updateIntegration(integrationId: string, data: UpdateIntegrationData, environment: IEnvironment) {
  return await put<IIntegration>(`/integrations/${integrationId}`, {
    body: data,
    environment: environment,
  });
}

export async function updateIntegrationOperations({
  integrationId,
  operations,
  environment,
}: {
  integrationId: string;
  operations: IntegrationOperationsConfig;
  environment: IEnvironment;
}) {
  const { data } = await put<{ data: IIntegration }>(`/integrations/${integrationId}/operations`, {
    body: { operations },
    environment,
  });

  return data;
}

export async function runIntegrationHealthCheck({
  integrationId,
  environment,
}: {
  integrationId: string;
  environment: IEnvironment;
}): Promise<IntegrationHealthCheckResponse> {
  const { data } = await post<{ data: IntegrationHealthCheckResponse }>(`/integrations/${integrationId}/health-check`, {
    environment,
  });

  return data;
}

export async function verifyIntegrationWebhookSignature({
  integrationId,
  payload,
  signature,
  source,
  environment,
}: {
  integrationId: string;
  payload: Record<string, unknown>;
  signature: string;
  source?: string;
  environment: IEnvironment;
}): Promise<WebhookSignatureVerificationResponse> {
  const { data } = await post<{ data: WebhookSignatureVerificationResponse }>(
    `/integrations/${integrationId}/webhook-signature/verify`,
    {
      body: { payload, signature, source },
      environment,
    }
  );

  return data;
}

export async function classifyProviderFailure({
  error,
  environment,
}: {
  error: Record<string, unknown>;
  environment: IEnvironment;
}): Promise<ProviderFailureClassificationResponse> {
  const { data } = await post<{ data: ProviderFailureClassificationResponse }>('/integrations/provider-failure/classify', {
    body: { error },
    environment,
  });

  return data;
}

export type SlackQuickSetupParams = {
  configToken: string;
  agentId: string;
  subscriberId?: string;
  connectionIdentifier?: string;
};

export async function slackQuickSetup(
  integrationId: string,
  params: SlackQuickSetupParams,
  environment: IEnvironment
): Promise<void> {
  await post(`/integrations/${integrationId}/slack-quick-setup`, {
    body: params,
    environment,
  });
}

export async function getMsTeamsArmTemplateDeployUrl(
  integrationId: string,
  environment: IEnvironment
): Promise<{ deployUrl: string }> {
  const { data } = await get<{ data: { deployUrl: string } }>(
    `/integrations/${integrationId}/msteams-arm-template/deploy-url`,
    { environment }
  );

  return data;
}

export async function getAzureSetupOauthUrl(
  integrationId: string,
  environment: IEnvironment
): Promise<{ url: string }> {
  const { data } = await get<{ data: { url: string } }>(
    `/integrations/${integrationId}/msteams-azure-setup/oauth-url`,
    { environment }
  );

  return data;
}

export async function getMsTeamsHealthCheck(
  integrationId: string,
  environment: IEnvironment,
  checks?: string[]
): Promise<MsTeamsHealthCheckResult> {
  const params = checks?.length ? `?checks=${checks.join(',')}` : '';
  const { data } = await get<{ data: MsTeamsHealthCheckResult }>(
    `/integrations/${integrationId}/msteams-health${params}`,
    { environment }
  );

  return data;
}
