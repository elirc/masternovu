import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  type ProviderLatencyPercentileDataPoint,
  ReportTypeEnum,
  type WorkflowErrorBudgetDataPoint,
  type WorkflowTriggerUsageDataPoint,
} from '@/api/activity';
import { ActivityFeedContent } from '@/components/activity/activity-feed-content';
import { TestWorkflowDrawer } from '@/components/workflow-editor/test-workflow/test-workflow-drawer';
import { useWorkflow } from '@/components/workflow-editor/workflow-provider';
import { useFetchCharts } from '@/hooks/use-fetch-charts';
import { useFetchWorkflowTestData } from '@/hooks/use-fetch-workflow-test-data';

const WORKFLOW_OPERATIONS_REPORTS = [
  ReportTypeEnum.WORKFLOW_TRIGGER_USAGE,
  ReportTypeEnum.PROVIDER_LATENCY_PERCENTILES,
  ReportTypeEnum.WORKFLOW_ERROR_BUDGET,
];

const SEVEN_DAYS_IN_MS = 7 * 24 * 60 * 60 * 1000;

export function WorkflowActivity() {
  const { workflow } = useWorkflow();
  const { workflowSlug = '' } = useParams<{ workflowSlug?: string }>();
  const [isTriggerDrawerOpen, setIsTriggerDrawerOpen] = useState(false);
  const { testData } = useFetchWorkflowTestData({ workflowSlug });
  const createdAtGte = useMemo(() => new Date(Date.now() - SEVEN_DAYS_IN_MS).toISOString(), []);

  const initialFilters = useMemo(() => {
    if (!workflow?._id) return {};

    return {
      workflows: [workflow._id],
    };
  }, [workflow?._id]);
  const { charts, isLoading: areOperationMetricsLoading } = useFetchCharts({
    createdAtGte,
    reportType: WORKFLOW_OPERATIONS_REPORTS,
    workflowIds: workflow?._id ? [workflow._id] : undefined,
    enabled: !!workflow?._id,
  });

  const triggerUsage = (charts?.[ReportTypeEnum.WORKFLOW_TRIGGER_USAGE] ??
    []) as WorkflowTriggerUsageDataPoint[];
  const providerLatency = (charts?.[ReportTypeEnum.PROVIDER_LATENCY_PERCENTILES] ??
    []) as ProviderLatencyPercentileDataPoint[];
  const errorBudget = (charts?.[ReportTypeEnum.WORKFLOW_ERROR_BUDGET] ?? []) as WorkflowErrorBudgetDataPoint[];

  if (!workflow) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-foreground-600">Loading workflow...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <WorkflowOperationalMetrics
        isLoading={areOperationMetricsLoading}
        triggerUsage={triggerUsage}
        providerLatency={providerLatency}
        errorBudget={errorBudget}
      />
      <ActivityFeedContent
        initialFilters={initialFilters}
        hideFilters={['workflows']}
        className="min-h-0 flex-1 max-w-full"
        contentHeight="h-[calc(100%-50px)]"
        onTriggerWorkflow={() => setIsTriggerDrawerOpen(true)}
      />
      <TestWorkflowDrawer
        isOpen={isTriggerDrawerOpen}
        onOpenChange={setIsTriggerDrawerOpen}
        testData={testData}
      />
    </div>
  );
}

function WorkflowOperationalMetrics({
  isLoading,
  triggerUsage,
  providerLatency,
  errorBudget,
}: {
  isLoading: boolean;
  triggerUsage: WorkflowTriggerUsageDataPoint[];
  providerLatency: ProviderLatencyPercentileDataPoint[];
  errorBudget: WorkflowErrorBudgetDataPoint[];
}) {
  const totalTriggers = triggerUsage.reduce((total, point) => total + point.count, 0);
  const slowestProvider = [...providerLatency].sort((left, right) => right.p95 - left.p95)[0];
  const workflowBudget = errorBudget[0];
  const failureRate = workflowBudget ? `${(workflowBudget.failureRate * 100).toFixed(2)}%` : '-';
  const p95RunDuration = workflowBudget?.p95RunDurationMs ? `${Math.round(workflowBudget.p95RunDurationMs)}ms` : '-';
  const p95ProviderLatency = slowestProvider ? `${Math.round(slowestProvider.p95)}ms` : '-';
  const providerLabel = slowestProvider ? `${slowestProvider.providerId} / ${slowestProvider.channel}` : '-';

  return (
    <div className="border-b border-neutral-200 bg-white px-4 py-3">
      <div className="grid gap-3 md:grid-cols-4">
        <WorkflowMetric label="Triggers, 7d" value={isLoading ? '...' : totalTriggers.toLocaleString()} />
        <WorkflowMetric label="Failure rate" value={isLoading ? '...' : failureRate} />
        <WorkflowMetric label="Workflow p95" value={isLoading ? '...' : p95RunDuration} />
        <WorkflowMetric label="Slowest provider p95" value={isLoading ? '...' : p95ProviderLatency} subValue={providerLabel} />
      </div>
    </div>
  );
}

function WorkflowMetric({ label, value, subValue }: { label: string; value: string; subValue?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 px-3 py-2">
      <div className="text-xs font-medium text-neutral-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-neutral-950">{value}</div>
      {subValue && <div className="mt-1 truncate text-xs text-neutral-500">{subValue}</div>}
    </div>
  );
}
