import { IIntegration } from '@novu/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { runIntegrationHealthCheck, updateIntegrationOperations } from '@/api/integrations';
import { Button } from '@/components/primitives/button';
import { InlineToast } from '@/components/primitives/inline-toast';
import { Input } from '@/components/primitives/input';
import { Label } from '@/components/primitives/label';
import { Textarea } from '@/components/primitives/textarea';
import { useEnvironment } from '@/context/environment/hooks';
import { QueryKeys } from '@/utils/query-keys';
import { showErrorToast, showSuccessToast } from '../../../components/primitives/sonner-helpers';

type ProviderOperationsPanelProps = {
  integration: IIntegration;
  isReadOnly?: boolean;
};

type IntegrationOperations = {
  healthCheck?: {
    status?: string;
    checkedAt?: string;
    message?: string;
  };
  credentialRotation?: {
    lastRotatedAt?: string;
    reminderAfterDays?: number;
  };
  rateLimit?: {
    enabled?: boolean;
    maxPerWindow?: number;
    windowMs?: number;
  };
  failover?: {
    enabled?: boolean;
    fallbackIntegrationIds?: string[];
    failureCategories?: string[];
  };
  incident?: {
    status?: string;
    message?: string;
    updatedAt?: string;
  };
  webhookSecurity?: {
    sharedSecretSet?: boolean;
    signatureHeader?: string;
  };
  webhookSignatureAudit?: {
    verified?: boolean;
    checkedAt?: string;
    reason?: string;
  };
};

const INCIDENT_STATUSES = ['healthy', 'degraded', 'disabled', 'maintenance'];
const FAILURE_CATEGORIES = ['provider_outage', 'rate_limit', 'unknown'];

export function ProviderOperationsPanel({ integration, isReadOnly }: ProviderOperationsPanelProps) {
  const queryClient = useQueryClient();
  const { currentEnvironment } = useEnvironment();
  const operations = (integration.operations || {}) as IntegrationOperations;
  const [incidentMessage, setIncidentMessage] = useState(operations.incident?.message || '');
  const [rateLimitEnabled, setRateLimitEnabled] = useState(operations.rateLimit?.enabled ?? false);
  const [rateLimitMax, setRateLimitMax] = useState(String(operations.rateLimit?.maxPerWindow || ''));
  const [rateLimitWindowMs, setRateLimitWindowMs] = useState(String(operations.rateLimit?.windowMs || ''));
  const [fallbackIntegrationIds, setFallbackIntegrationIds] = useState(
    operations.failover?.fallbackIntegrationIds?.join(', ') || ''
  );
  const [webhookSecret, setWebhookSecret] = useState('');
  const [rotationDays, setRotationDays] = useState(String(operations.credentialRotation?.reminderAfterDays || 90));

  const invalidateIntegrations = async () => {
    await queryClient.invalidateQueries({ queryKey: [QueryKeys.fetchIntegrations, currentEnvironment?._id] });
  };

  const updateOperationsMutation = useMutation({
    mutationFn: (operationPatch: Record<string, unknown>) => {
      if (!currentEnvironment) {
        throw new Error('No environment selected');
      }

      return updateIntegrationOperations({
        integrationId: integration._id,
        operations: operationPatch,
        environment: currentEnvironment,
      });
    },
    onSuccess: async () => {
      await invalidateIntegrations();
      showSuccessToast('Provider operations updated');
    },
    onError: (error) => {
      showErrorToast(error instanceof Error ? error.message : 'Provider operations update failed');
    },
  });

  const healthCheckMutation = useMutation({
    mutationFn: () => {
      if (!currentEnvironment) {
        throw new Error('No environment selected');
      }

      return runIntegrationHealthCheck({ integrationId: integration._id, environment: currentEnvironment });
    },
    onSuccess: async (result) => {
      await invalidateIntegrations();
      showSuccessToast(result.message || `Health check finished with ${result.status}`);
    },
    onError: (error) => {
      showErrorToast(error instanceof Error ? error.message : 'Provider health check failed');
    },
  });

  if (!currentEnvironment) {
    return null;
  }

  const incidentStatus = operations.incident?.status || 'healthy';
  const hasIncident = incidentStatus !== 'healthy';

  return (
    <div className="border-neutral-alpha-200 bg-background text-foreground-600 flex flex-col gap-3 rounded-lg border p-3">
      {hasIncident && (
        <InlineToast
          variant={incidentStatus === 'disabled' ? 'warning' : 'tip'}
          title={`Provider ${incidentStatus}`}
          description={operations.incident?.message || 'This integration has an operational status set.'}
        />
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Health check</Label>
          <span className="text-foreground-400 text-xs">
            {operations.healthCheck?.checkedAt
              ? `${operations.healthCheck.status} at ${operations.healthCheck.checkedAt}`
              : 'No health check has been recorded yet.'}
          </span>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="xs"
          disabled={isReadOnly || healthCheckMutation.isPending}
          isLoading={healthCheckMutation.isPending}
          onClick={() => healthCheckMutation.mutate()}
        >
          Run check
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-xs">Incident status</Label>
        <Textarea
          value={incidentMessage}
          onChange={(event) => setIncidentMessage(event.target.value)}
          disabled={isReadOnly}
          placeholder="Optional incident message"
          className="min-h-16"
        />
        <div className="flex flex-wrap gap-2">
          {INCIDENT_STATUSES.map((status) => (
            <Button
              key={status}
              type="button"
              variant={status === incidentStatus ? 'primary' : 'secondary'}
              size="xs"
              disabled={isReadOnly || updateOperationsMutation.isPending}
              onClick={() =>
                updateOperationsMutation.mutate({
                  incident: { status, message: incidentMessage || undefined },
                })
              }
            >
              {status}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Max sends</Label>
          <Input
            value={rateLimitMax}
            disabled={isReadOnly}
            onChange={(event) => setRateLimitMax(event.target.value)}
            placeholder="100"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Window ms</Label>
          <Input
            value={rateLimitWindowMs}
            disabled={isReadOnly}
            onChange={(event) => setRateLimitWindowMs(event.target.value)}
            placeholder="60000"
          />
        </div>
      </div>
      <Button
        type="button"
        variant="secondary"
        size="xs"
        disabled={isReadOnly || updateOperationsMutation.isPending}
        onClick={() => {
          const enabled = !rateLimitEnabled;
          setRateLimitEnabled(enabled);
          updateOperationsMutation.mutate({
            rateLimit: {
              enabled,
              maxPerWindow: Number(rateLimitMax || 0),
              windowMs: Number(rateLimitWindowMs || 0),
            },
          });
        }}
      >
        {rateLimitEnabled ? 'Disable provider rate limit' : 'Enable provider rate limit'}
      </Button>

      <div className="flex flex-col gap-1">
        <Label className="text-xs">Fallback integration IDs</Label>
        <Input
          value={fallbackIntegrationIds}
          disabled={isReadOnly}
          onChange={(event) => setFallbackIntegrationIds(event.target.value)}
          placeholder="integration-id-1, integration-id-2"
        />
      </div>
      <Button
        type="button"
        variant="secondary"
        size="xs"
        disabled={isReadOnly || updateOperationsMutation.isPending}
        onClick={() =>
          updateOperationsMutation.mutate({
            failover: {
              enabled: true,
              fallbackIntegrationIds: fallbackIntegrationIds
                .split(',')
                .map((id) => id.trim())
                .filter(Boolean),
              failureCategories: FAILURE_CATEGORIES,
            },
          })
        }
      >
        Save failover rule
      </Button>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Rotation reminder days</Label>
          <Input
            value={rotationDays}
            disabled={isReadOnly}
            onChange={(event) => setRotationDays(event.target.value)}
            placeholder="90"
          />
        </div>
        <div className="flex flex-col justify-end">
          <Button
            type="button"
            variant="secondary"
            size="xs"
            disabled={isReadOnly || updateOperationsMutation.isPending}
            onClick={() =>
              updateOperationsMutation.mutate({
                credentialRotation: {
                  reminderAfterDays: Number(rotationDays || 0),
                  lastRotatedAt: new Date().toISOString(),
                },
              })
            }
          >
            Record rotation
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs">Webhook signing secret</Label>
        <Input
          type="password"
          value={webhookSecret}
          disabled={isReadOnly}
          onChange={(event) => setWebhookSecret(event.target.value)}
          placeholder={operations.webhookSecurity?.sharedSecretSet ? 'Secret configured' : 'Set a webhook secret'}
        />
      </div>
      <Button
        type="button"
        variant="secondary"
        size="xs"
        disabled={isReadOnly || updateOperationsMutation.isPending || !webhookSecret}
        onClick={() =>
          updateOperationsMutation.mutate({
            webhookSecurity: {
              sharedSecret: webhookSecret,
              signatureHeader: 'x-novu-signature',
            },
          })
        }
      >
        Save webhook secret
      </Button>
    </div>
  );
}
