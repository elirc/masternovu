import mongoose, { Schema } from 'mongoose';
import { schemaOptions } from '../schema-default.options';
import { WorkflowVersionDBModel } from './workflow-version.entity';

const workflowVersionSchema = new Schema<WorkflowVersionDBModel>(
  {
    _organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      index: true,
      required: true,
    },
    _environmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Environment',
      index: true,
      required: true,
    },
    _workflowId: {
      type: Schema.Types.ObjectId,
      ref: 'NotificationTemplate',
      index: true,
      required: true,
    },
    version: {
      type: Schema.Types.Number,
      required: true,
    },
    snapshot: {
      type: Schema.Types.Mixed,
      required: true,
    },
    publishedAt: {
      type: Schema.Types.String,
    },
    publishedBy: {
      type: Schema.Types.String,
    },
    rollback: {
      fromVersion: Schema.Types.Number,
      actorId: Schema.Types.String,
      reason: Schema.Types.String,
      createdAt: Schema.Types.String,
    },
  },
  { ...schemaOptions, minimize: false }
);

workflowVersionSchema.index(
  {
    _environmentId: 1,
    _organizationId: 1,
    _workflowId: 1,
    version: 1,
  },
  { unique: true }
);

export const WorkflowVersion =
  (mongoose.models.WorkflowVersion as mongoose.Model<WorkflowVersionDBModel>) ||
  mongoose.model<WorkflowVersionDBModel>('WorkflowVersion', workflowVersionSchema);
