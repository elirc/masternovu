import { IsOptional, IsString } from 'class-validator';
import { EnvironmentWithUserCommand } from '../../../shared/commands/project.command';

export class ReplayWorkflowRunCommand extends EnvironmentWithUserCommand {
  @IsString()
  workflowRunId: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
