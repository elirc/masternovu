import { ReliabilityGuardKindEnum } from '@novu/shared';
import mongoose, { Schema } from 'mongoose';
import { schemaOptions } from '../schema-default.options';
import { TriggerReliabilityDBModel } from './trigger-reliability.entity';

const triggerReliabilitySchema = new Schema<TriggerReliabilityDBModel>(
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
    kind: {
      type: Schema.Types.String,
      required: true,
      enum: Object.values(ReliabilityGuardKindEnum),
      index: true,
    },
    workflowIdentifier: {
      type: Schema.Types.String,
      required: true,
      index: true,
    },
    keyHash: {
      type: Schema.Types.String,
      required: true,
    },
    subscriberHash: {
      type: Schema.Types.String,
      required: false,
    },
    tenantHash: {
      type: Schema.Types.String,
      required: false,
    },
    transactionId: {
      type: Schema.Types.String,
      required: true,
    },
    expiresAt: {
      type: Schema.Types.Date,
      required: true,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      required: false,
    },
  },
  { ...schemaOptions, minimize: false }
);

triggerReliabilitySchema.index(
  {
    _environmentId: 1,
    kind: 1,
    workflowIdentifier: 1,
    keyHash: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      kind: { $in: [ReliabilityGuardKindEnum.IDEMPOTENCY, ReliabilityGuardKindEnum.DEDUPLICATION] },
    },
  }
);

triggerReliabilitySchema.index({
  _environmentId: 1,
  kind: 1,
  workflowIdentifier: 1,
  subscriberHash: 1,
  createdAt: 1,
});

triggerReliabilitySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const TriggerReliability =
  (mongoose.models.TriggerReliability as mongoose.Model<TriggerReliabilityDBModel>) ||
  mongoose.model<TriggerReliabilityDBModel>('TriggerReliability', triggerReliabilitySchema);
