import React, { forwardRef, useEffect, useState } from 'react';
import { JobStatusEnum } from '@novu/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { replayWorkflowRun } from '@/api/activity';
import { ActivityError } from '@/components/activity/activity-error';
import { ActivityLogs } from '@/components/activity/activity-logs';
import { ActivityPanel } from '@/components/activity/activity-panel';
import { ActivitySkeleton } from '@/components/activity/activity-skeleton';
import { ActivityOverview } from '@/components/activity/components/activity-overview';
import { Button } from '@/components/primitives/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/primitives/sheet';
import { useEnvironment } from '@/context/environment/hooks';
import { usePullActivity } from '@/hooks/use-pull-activity';
import { QueryKeys } from '@/utils/query-keys';

type WorkflowRunActivityDrawerProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  activityId?: string;
};

export const WorkflowRunActivityDrawer = forwardRef<HTMLDivElement, WorkflowRunActivityDrawerProps>(
  (props, forwardedRef) => {
    const { isOpen, onOpenChange, activityId } = props;

    const [currentActivityId, setCurrentActivityId] = useState<string | undefined>(activityId);
    const { currentEnvironment } = useEnvironment();
    const queryClient = useQueryClient();

    useEffect(() => {
      setCurrentActivityId(activityId);
    }, [activityId]);

    const { activity, isPending, error } = usePullActivity(currentActivityId);
    const replayMutation = useMutation({
      mutationFn: () =>
        replayWorkflowRun({
          workflowRunId: currentActivityId || '',
          environment: currentEnvironment!,
          reason: 'Replayed from activity drawer',
        }),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [QueryKeys.fetchActivities, currentEnvironment?._id] });
      },
    });

    const canReplay =
      !!activity &&
      !!currentActivityId &&
      !!currentEnvironment &&
      activity.jobs?.some((job) => job.status === JobStatusEnum.FAILED);

    return (
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent ref={forwardedRef} className="w-[490px]">
          <SheetTitle className="text-label-sm text-text-strong border-b border-neutral-200 p-3">
            Workflow run
          </SheetTitle>

          <div className="flex h-full max-h-full flex-1 flex-col overflow-auto">
            {currentActivityId ? (
              <ActivityPanel>
                {isPending ? (
                  <ActivitySkeleton />
                ) : error || !activity ? (
                  <ActivityError />
                ) : (
                  <React.Fragment key={currentActivityId}>
                    {canReplay && (
                      <div className="border-b border-neutral-200 p-3">
                        <Button
                          size="xs"
                          variant="secondary"
                          onClick={() => replayMutation.mutate()}
                          disabled={replayMutation.isPending}
                        >
                          Replay failed run
                        </Button>
                      </div>
                    )}
                    <ActivityOverview activity={activity} />
                    <ActivityLogs activity={activity} onActivitySelect={setCurrentActivityId} />
                  </React.Fragment>
                )}
              </ActivityPanel>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-6 p-6 text-center">
                <div className="flex flex-col gap-2">
                  <p className="text-foreground-400 max-w-[30ch] text-sm">No activity data available</p>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    );
  }
);

WorkflowRunActivityDrawer.displayName = 'WorkflowRunActivityDrawer';
