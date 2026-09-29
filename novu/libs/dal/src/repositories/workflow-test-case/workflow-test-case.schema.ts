import mongoose, { Schema } from 'mongoose';
import { schemaOptions } from '../schema-default.options';
import { WorkflowTestCaseDBModel } from './workflow-test-case.entity';

const workflowTestCaseSchema = new Schema<WorkflowTestCaseDBModel>(
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
    name: {
      type: Schema.Types.String,
      required: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
      default: {},
    },
    recipientSample: {
      type: Schema.Types.Mixed,
      required: false,
    },
    tenantSample: {
      type: Schema.Types.Mixed,
      required: false,
    },
    expectedResultNotes: {
      type: Schema.Types.String,
      required: false,
    },
    createdBy: {
      type: Schema.Types.String,
      required: false,
    },
    updatedBy: {
      type: Schema.Types.String,
      required: false,
    },
  },
  { ...schemaOptions, minimize: false }
);

workflowTestCaseSchema.index({
  _environmentId: 1,
  _workflowId: 1,
  name: 1,
});

export const WorkflowTestCase =
  (mongoose.models.WorkflowTestCase as mongoose.Model<WorkflowTestCaseDBModel>) ||
  mongoose.model<WorkflowTestCaseDBModel>('WorkflowTestCase', workflowTestCaseSchema);
