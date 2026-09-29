import type {
  CreateWorkflowDto,
  DuplicateWorkflowDto,
  IEnvironment,
  ListWorkflowResponse,
  PatchWorkflowDto,
  SyncWorkflowDto,
  UpdateWorkflowDto,
  WorkflowResponseDto,
  WorkflowTestDataResponseDto,
} from '@novu/shared';
import { delV2, getV2, patchV2, post, postV2, putV2 } from './api.client';

export type WorkflowPayloadValidationResponse = {
  valid: boolean;
  errors: string[];
  payload: Record<string, unknown>;
};

export type WorkflowDiffResponse = {
  hasChanges: boolean;
  changes: Array<{
    path: string;
    before: unknown;
    after: unknown;
    changeType: 'added' | 'removed' | 'changed';
  }>;
};

export type WorkflowTestCase = {
  _id: string;
  _workflowId: string;
  name: string;
  payload: Record<string, unknown>;
  recipientSample?: unknown;
  tenantSample?: unknown;
  expectedResultNotes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type WorkflowTestCasePayload = {
  name: string;
  payload: Record<string, unknown>;
  recipientSample?: unknown;
  tenantSample?: unknown;
  expectedResultNotes?: string;
};

export type PreferenceSimulationResponse = {
  wouldSend: boolean;
  reasons: string[];
  channels: Array<{
    stepId: string;
    stepType: string;
    channel?: string;
    wouldSend: boolean;
    reasons: string[];
  }>;
};

export type IntegrationConditionDebugResponse = {
  steps: Array<{
    stepId: string;
    stepType: string;
    channel?: string;
    active: boolean;
    filtersCount: number;
    integrations: Array<{
      id: string;
      providerId: string;
      identifier: string;
      name: string;
      active: boolean;
      connected?: boolean;
      primary: boolean;
      conditionsCount: number;
      reasons: string[];
    }>;
    reasons: string[];
  }>;
};

export type WorkflowMigrationAssistantResponse = {
  summary: {
    breaking: number;
    warnings: number;
    safe: number;
  };
  changes: Array<{
    path: string;
    classification: 'breaking' | 'warning' | 'safe';
    message: string;
  }>;
  testCases: Array<{
    id: string;
    name: string;
    valid: boolean;
    errors: string[];
  }>;
};

export type WorkflowVersion = {
  _id: string;
  version: number;
  publishedAt?: string;
  publishedBy?: string;
  rollbackReason?: string;
};

export type WorkflowRollbackPayload = {
  reason?: string;
};

export type WorkflowReliabilityConfig = Record<string, unknown>;

export type WorkflowReliabilityResponse = {
  reliability?: WorkflowReliabilityConfig;
};

export type DeliveryAttemptTimelineResponse = {
  workflowId: string;
  transactionId: string;
  jobs: Array<{
    jobId: string;
    stepId?: string;
    stepName?: string;
    stepType?: string;
    status: string;
    providerId?: string;
    priority?: string;
    retry?: unknown;
    cancellation?: unknown;
    attempts: Array<{
      attemptNumber: number;
      detail: string;
      status: string;
      source: string;
      isRetry: boolean;
      providerId?: string;
      raw?: string | null;
      createdAt: string;
    }>;
  }>;
};

export type TriggerReliabilityPreviewResponse = {
  workflowId: string;
  reliability?: WorkflowReliabilityConfig;
  notes: string[];
};

export const getWorkflow = async ({
  environment,
  workflowSlug,
  targetEnvironmentId,
}: {
  environment: IEnvironment;
  workflowSlug?: string;
  targetEnvironmentId?: string;
}): Promise<WorkflowResponseDto> => {
  const { data } = await getV2<{ data: WorkflowResponseDto }>(
    `/workflows/${workflowSlug}?${targetEnvironmentId ? `environmentId=${targetEnvironmentId}` : ''}`,
    {
      environment,
    }
  );

  return data;
};

export const getWorkflows = async ({
  environment,
  limit,
  query,
  offset,
  orderBy,
  orderDirection,
  tags,
  status,
}: {
  environment: IEnvironment;
  limit: number;
  offset: number;
  query: string;
  orderBy?: string;
  orderDirection?: string;
  tags?: string[];
  status?: string[];
}): Promise<ListWorkflowResponse> => {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
    query,
  });

  if (orderBy) {
    params.append('orderBy', orderBy);
  }

  if (orderDirection) {
    params.append('orderDirection', orderDirection.toUpperCase());
  }

  if (tags && tags.length > 0) {
    for (const tag of tags) {
      params.append('tags[]', tag);
    }
  }

  if (status && status.length > 0) {
    for (const s of status) {
      params.append('status[]', s);
    }
  }

  const { data } = await getV2<{ data: ListWorkflowResponse }>(`/workflows?${params.toString()}`, { environment });

  return data;
};

export const getWorkflowTestData = async ({
  environment,
  workflowSlug,
}: {
  environment: IEnvironment;
  workflowSlug?: string;
}): Promise<WorkflowTestDataResponseDto> => {
  const { data } = await getV2<{ data: WorkflowTestDataResponseDto }>(`/workflows/${workflowSlug}/test-data`, {
    environment,
  });

  return data;
};

export async function triggerWorkflow({
  environment,
  name,
  payload,
  to,
  context,
  overrides,
  dryRun,
  idempotencyKey,
  priority,
}: {
  environment: IEnvironment;
  name: string;
  payload: unknown;
  to: unknown;
  context?: unknown;
  overrides?: Record<string, unknown>;
  dryRun?: boolean;
  idempotencyKey?: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
}) {
  return post<{ data: { transactionId?: string } }>(`/events/trigger`, {
    environment,
    body: {
      name,
      to,
      payload: { ...(payload ?? {}), __source: (payload as any)?.__source ?? 'dashboard' },
      context: context ?? undefined,
      ...(overrides && Object.keys(overrides).length > 0 ? { overrides } : {}),
      ...(dryRun ? { dryRun } : {}),
      ...(idempotencyKey ? { idempotencyKey } : {}),
      ...(priority ? { priority } : {}),
    },
  });
}

export async function createWorkflow({
  environment,
  workflow,
}: {
  environment: IEnvironment;
  workflow: CreateWorkflowDto;
}) {
  return postV2<{ data: WorkflowResponseDto }>(`/workflows`, { environment, body: workflow });
}

export async function syncWorkflow({
  environment,
  workflowSlug,
  payload,
}: {
  environment: IEnvironment;
  workflowSlug: string;
  payload: SyncWorkflowDto;
}) {
  return putV2<{ data: WorkflowResponseDto }>(`/workflows/${workflowSlug}/sync`, { environment, body: payload });
}

export const updateWorkflow = async ({
  environment,
  workflow,
  workflowSlug,
}: {
  environment: IEnvironment;
  workflow: UpdateWorkflowDto;
  workflowSlug: string;
}): Promise<WorkflowResponseDto> => {
  const { data } = await putV2<{ data: WorkflowResponseDto }>(`/workflows/${workflowSlug}`, {
    environment,
    body: workflow,
  });

  return data;
};

export const deleteWorkflow = async ({
  environment,
  workflowSlug,
}: {
  environment: IEnvironment;
  workflowSlug: string;
}): Promise<void> => {
  return delV2(`/workflows/${workflowSlug}`, { environment });
};

export const patchWorkflow = async ({
  environment,
  workflow,
  workflowSlug,
}: {
  environment: IEnvironment;
  workflow: PatchWorkflowDto;
  workflowSlug: string;
}): Promise<WorkflowResponseDto> => {
  const res = await patchV2<{ data: WorkflowResponseDto }>(`/workflows/${workflowSlug}`, {
    environment,
    body: workflow,
  });

  return res.data;
};

export const duplicateWorkflow = async ({
  environment,
  workflow,
  workflowSlug,
}: {
  environment: IEnvironment;
  workflow: DuplicateWorkflowDto;
  workflowSlug: string;
}) => {
  return postV2<{ data: WorkflowResponseDto }>(`/workflows/${workflowSlug}/duplicate`, {
    environment,
    body: workflow,
  });
};

export const getWorkflowVersions = async ({
  environment,
  workflowSlug,
}: {
  environment: IEnvironment;
  workflowSlug: string;
}): Promise<WorkflowVersion[]> => {
  const { data } = await getV2<{ data: WorkflowVersion[] }>(`/workflows/${workflowSlug}/versions`, {
    environment,
  });

  return data;
};

export const rollbackWorkflowVersion = async ({
  environment,
  workflowSlug,
  version,
  payload,
}: {
  environment: IEnvironment;
  workflowSlug: string;
  version: number;
  payload: WorkflowRollbackPayload;
}): Promise<WorkflowVersion> => {
  const { data } = await postV2<{ data: WorkflowVersion }>(
    `/workflows/${workflowSlug}/versions/${version}/rollback`,
    {
      body: payload,
      environment,
    }
  );

  return data;
};

export const validateWorkflowPayload = async ({
  environment,
  workflowSlug,
  payload,
}: {
  environment: IEnvironment;
  workflowSlug: string;
  payload: Record<string, unknown>;
}): Promise<WorkflowPayloadValidationResponse> => {
  const { data } = await postV2<{ data: WorkflowPayloadValidationResponse }>(
    `/workflows/${workflowSlug}/payload-schema/validate`,
    {
      environment,
      body: { payload },
    }
  );

  return data;
};

export const diffWorkflow = async ({
  environment,
  workflowSlug,
  proposedWorkflow,
}: {
  environment: IEnvironment;
  workflowSlug: string;
  proposedWorkflow: Record<string, unknown>;
}): Promise<WorkflowDiffResponse> => {
  const { data } = await postV2<{ data: WorkflowDiffResponse }>(`/workflows/${workflowSlug}/diff`, {
    environment,
    body: { proposedWorkflow },
  });

  return data;
};

export const listWorkflowTestCases = async ({
  environment,
  workflowSlug,
}: {
  environment: IEnvironment;
  workflowSlug: string;
}): Promise<WorkflowTestCase[]> => {
  const { data } = await getV2<{ data: WorkflowTestCase[] }>(`/workflows/${workflowSlug}/test-cases`, {
    environment,
  });

  return data;
};

export const createWorkflowTestCase = async ({
  environment,
  workflowSlug,
  testCase,
}: {
  environment: IEnvironment;
  workflowSlug: string;
  testCase: WorkflowTestCasePayload;
}): Promise<WorkflowTestCase> => {
  const { data } = await postV2<{ data: WorkflowTestCase }>(`/workflows/${workflowSlug}/test-cases`, {
    environment,
    body: testCase,
  });

  return data;
};

export const updateWorkflowTestCase = async ({
  environment,
  workflowSlug,
  testCaseId,
  testCase,
}: {
  environment: IEnvironment;
  workflowSlug: string;
  testCaseId: string;
  testCase: WorkflowTestCasePayload;
}): Promise<WorkflowTestCase> => {
  const { data } = await putV2<{ data: WorkflowTestCase }>(`/workflows/${workflowSlug}/test-cases/${testCaseId}`, {
    environment,
    body: testCase,
  });

  return data;
};

export const deleteWorkflowTestCase = async ({
  environment,
  workflowSlug,
  testCaseId,
}: {
  environment: IEnvironment;
  workflowSlug: string;
  testCaseId: string;
}): Promise<void> => {
  return delV2(`/workflows/${workflowSlug}/test-cases/${testCaseId}`, { environment });
};

export const simulateWorkflowPreferences = async ({
  environment,
  workflowSlug,
  subscriberId,
  tenantId,
  payload,
}: {
  environment: IEnvironment;
  workflowSlug: string;
  subscriberId: string;
  tenantId?: string;
  payload?: Record<string, unknown>;
}): Promise<PreferenceSimulationResponse> => {
  const { data } = await postV2<{ data: PreferenceSimulationResponse }>(
    `/workflows/${workflowSlug}/preference-simulation`,
    {
      environment,
      body: { subscriberId, tenantId, payload },
    }
  );

  return data;
};

export const debugWorkflowIntegrationConditions = async ({
  environment,
  workflowSlug,
  payload,
  includeInactive,
}: {
  environment: IEnvironment;
  workflowSlug: string;
  payload?: Record<string, unknown>;
  includeInactive?: boolean;
}): Promise<IntegrationConditionDebugResponse> => {
  const { data } = await postV2<{ data: IntegrationConditionDebugResponse }>(
    `/workflows/${workflowSlug}/integration-condition-debug`,
    {
      environment,
      body: { payload, includeInactive },
    }
  );

  return data;
};

export const analyzeWorkflowMigration = async ({
  environment,
  workflowSlug,
  payloadSchema,
  testCaseIds,
}: {
  environment: IEnvironment;
  workflowSlug: string;
  payloadSchema: Record<string, unknown>;
  testCaseIds?: string[];
}): Promise<WorkflowMigrationAssistantResponse> => {
  const { data } = await postV2<{ data: WorkflowMigrationAssistantResponse }>(
    `/workflows/${workflowSlug}/migration-assistant`,
    {
      environment,
      body: { payloadSchema, testCaseIds },
    }
  );

  return data;
};

export const getWorkflowReliability = async ({
  environment,
  workflowSlug,
}: {
  environment: IEnvironment;
  workflowSlug: string;
}): Promise<WorkflowReliabilityResponse> => {
  const { data } = await getV2<{ data: WorkflowReliabilityResponse }>(`/workflows/${workflowSlug}/reliability`, {
    environment,
  });

  return data;
};

export const updateWorkflowReliability = async ({
  environment,
  workflowSlug,
  reliability,
}: {
  environment: IEnvironment;
  workflowSlug: string;
  reliability: WorkflowReliabilityConfig;
}): Promise<WorkflowResponseDto> => {
  const { data } = await patchV2<{ data: WorkflowResponseDto }>(`/workflows/${workflowSlug}/reliability`, {
    environment,
    body: { reliability },
  });

  return data;
};

export const previewWorkflowReliability = async ({
  environment,
  workflowSlug,
  payload,
  subscriberId,
}: {
  environment: IEnvironment;
  workflowSlug: string;
  payload?: Record<string, unknown>;
  subscriberId?: string;
}): Promise<TriggerReliabilityPreviewResponse> => {
  const { data } = await postV2<{ data: TriggerReliabilityPreviewResponse }>(
    `/workflows/${workflowSlug}/reliability/preview`,
    {
      environment,
      body: { payload, subscriberId },
    }
  );

  return data;
};

export const getDeliveryAttemptTimeline = async ({
  environment,
  workflowSlug,
  transactionId,
}: {
  environment: IEnvironment;
  workflowSlug: string;
  transactionId: string;
}): Promise<DeliveryAttemptTimelineResponse> => {
  const params = new URLSearchParams({ transactionId });
  const { data } = await getV2<{ data: DeliveryAttemptTimelineResponse }>(
    `/workflows/${workflowSlug}/delivery-attempts?${params.toString()}`,
    {
      environment,
    }
  );

  return data;
};
