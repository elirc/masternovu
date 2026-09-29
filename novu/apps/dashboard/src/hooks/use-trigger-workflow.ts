import { IEnvironment } from '@novu/shared';
import { useMutation } from '@tanstack/react-query';
import { triggerWorkflow } from '@/api/workflows';
import { useEnvironment } from '../context/environment/hooks';

export const useTriggerWorkflow = (environmentHint?: IEnvironment) => {
  const { currentEnvironment } = useEnvironment();
  const { mutateAsync, isPending, error, data } = useMutation({
    mutationFn: async ({
      name,
      to,
      payload,
      context,
      dryRun,
      idempotencyKey,
      priority,
    }: {
      name: string;
      to: unknown;
      payload: unknown;
      context?: unknown;
      dryRun?: boolean;
      idempotencyKey?: string;
      priority?: 'low' | 'normal' | 'high' | 'critical';
    }) =>
      triggerWorkflow({
        environment: environmentHint ?? currentEnvironment ?? ({} as IEnvironment),
        name,
        to,
        payload,
        context,
        dryRun,
        idempotencyKey,
        priority,
      }),
  });

  return {
    triggerWorkflow: mutateAsync,
    isPending,
    error,
    data,
  };
};
