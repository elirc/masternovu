import { createHmac, timingSafeEqual } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { GetDecryptedIntegrations, encryptCredentials } from '@novu/application-generic';
import { IntegrationEntity, IntegrationRepository } from '@novu/dal';
import {
  ChannelTypeEnum,
  IntegrationHealthStatusEnum,
  IntegrationOperationsConfig,
  UserSessionData,
  classifyProviderFailure,
} from '@novu/shared';
import { CheckIntegrationCommand } from '../check-integration/check-integration.command';
import { CheckIntegration } from '../check-integration/check-integration.usecase';
import {
  IntegrationHealthCheckResponseDto,
  ProviderFailureClassificationRequestDto,
  ProviderFailureClassificationResponseDto,
  UpdateIntegrationOperationsRequestDto,
  WebhookSignatureVerificationRequestDto,
  WebhookSignatureVerificationResponseDto,
} from '../../dtos/sprint-three-provider-ops.dto';

@Injectable()
export class SprintThreeProviderOpsUsecase {
  constructor(
    private integrationRepository: IntegrationRepository,
    private checkIntegration: CheckIntegration
  ) {}

  async updateOperations({
    user,
    integrationId,
    body,
  }: {
    user: UserSessionData;
    integrationId: string;
    body: UpdateIntegrationOperationsRequestDto;
  }): Promise<IntegrationEntity> {
    const integration = await this.fetchIntegration(user, integrationId);
    const { operations: operationsUpdate, signingSecret } = this.extractWebhookSigningSecret(body.operations);
    const operations = this.mergeOperations(integration.operations, operationsUpdate, user._id);
    const credentials = signingSecret
      ? encryptCredentials({
          ...(GetDecryptedIntegrations.getDecryptedCredentials({
            ...integration,
            credentials: { ...(integration.credentials || {}) },
          }).credentials || {}),
          signingSecret,
        })
      : undefined;

    await this.integrationRepository.update(
      {
        _id: integration._id,
        _environmentId: integration._environmentId,
        _organizationId: user.organizationId,
      },
      {
        $set: {
          operations,
          ...(credentials && { credentials }),
        },
      }
    );

    return (await this.fetchIntegration(user, integrationId)) as IntegrationEntity;
  }

  async healthCheck(user: UserSessionData, integrationId: string): Promise<IntegrationHealthCheckResponseDto> {
    const integration = await this.fetchIntegration(user, integrationId);
    const decrypted = GetDecryptedIntegrations.getDecryptedCredentials(integration);
    const checkedAt = new Date().toISOString();
    let response: IntegrationHealthCheckResponseDto;

    try {
      if (decrypted.channel === ChannelTypeEnum.EMAIL) {
        await this.checkIntegration.execute(
          CheckIntegrationCommand.create({
            environmentId: user.environmentId,
            organizationId: user.organizationId,
            providerId: decrypted.providerId,
            channel: decrypted.channel,
            credentials: decrypted.credentials,
          })
        );

        response = {
          status: IntegrationHealthStatusEnum.HEALTHY,
          checkedAt,
          message: 'Provider credentials validated successfully.',
        };
      } else if (!decrypted.credentials || Object.keys(decrypted.credentials).length === 0) {
        response = {
          status: IntegrationHealthStatusEnum.UNHEALTHY,
          checkedAt,
          message: 'Integration has no credentials configured.',
        };
      } else {
        response = {
          status: IntegrationHealthStatusEnum.WARNING,
          checkedAt,
          message: 'Provider-specific network health check is not implemented for this channel yet.',
        };
      }
    } catch (error) {
      response = {
        status: IntegrationHealthStatusEnum.UNHEALTHY,
        checkedAt,
        message: error instanceof Error ? error.message : 'Provider credentials failed validation.',
      };
    }

    await this.integrationRepository.update(
      { _id: integration._id, _environmentId: integration._environmentId, _organizationId: user.organizationId },
      {
        $set: {
          'operations.healthCheck': {
            ...response,
            checkedBy: user._id,
          },
        },
      }
    );

    return response;
  }

  async verifyWebhookSignature({
    user,
    integrationId,
    body,
  }: {
    user: UserSessionData;
    integrationId: string;
    body: WebhookSignatureVerificationRequestDto;
  }): Promise<WebhookSignatureVerificationResponseDto> {
    const integration = await this.fetchIntegration(user, integrationId);
    const decrypted = GetDecryptedIntegrations.getDecryptedCredentials({
      ...integration,
      credentials: { ...(integration.credentials || {}) },
    });
    const secret = decrypted.credentials?.signingSecret || integration.operations?.webhookSecurity?.sharedSecret;

    if (!secret) {
      throw new BadRequestException('Integration does not have a webhook signing secret configured');
    }

    const checkedAt = new Date().toISOString();
    const expected = createHmac('sha256', secret).update(JSON.stringify(body.payload)).digest('hex');
    const verified = this.safeCompare(expected, body.signature);
    const response = {
      verified,
      checkedAt,
      reason: verified ? undefined : 'Signature did not match expected HMAC SHA-256 digest',
    };

    await this.integrationRepository.update(
      { _id: integration._id, _environmentId: integration._environmentId, _organizationId: user.organizationId },
      {
        $set: {
          'operations.webhookSignatureAudit': {
            ...response,
            source: body.source,
          },
        },
      }
    );

    return response;
  }

  classifyFailure(body: ProviderFailureClassificationRequestDto): ProviderFailureClassificationResponseDto {
    return {
      category: classifyProviderFailure(body.error),
    };
  }

  private async fetchIntegration(user: UserSessionData, integrationId: string): Promise<IntegrationEntity> {
    const integration = await this.integrationRepository.findOne({
      _id: integrationId,
      _environmentId: user.environmentId,
      _organizationId: user.organizationId,
    });

    if (!integration) {
      throw new NotFoundException(`Integration with id ${integrationId} was not found`);
    }

    return integration;
  }

  private mergeOperations(
    current: IntegrationOperationsConfig | undefined,
    update: IntegrationOperationsConfig,
    userId: string
  ): IntegrationOperationsConfig {
    const now = new Date().toISOString();

    return {
      ...(current || {}),
      ...update,
      ...(update.webhookSecurity && {
        webhookSecurity: {
          ...(current?.webhookSecurity || {}),
          ...update.webhookSecurity,
        },
      }),
      ...(update.incident && {
        incident: {
          ...(current?.incident || {}),
          ...update.incident,
          updatedAt: now,
          updatedBy: userId,
        },
      }),
      ...(update.credentialRotation && {
        credentialRotation: {
          ...(current?.credentialRotation || {}),
          ...update.credentialRotation,
          updatedBy: userId,
        },
      }),
    };
  }

  private extractWebhookSigningSecret(operations: IntegrationOperationsConfig): {
    operations: IntegrationOperationsConfig;
    signingSecret?: string;
  } {
    const signingSecret = operations.webhookSecurity?.sharedSecret;

    if (!signingSecret) {
      return { operations };
    }

    const { sharedSecret: _sharedSecret, ...webhookSecurity } = operations.webhookSecurity;

    return {
      signingSecret,
      operations: {
        ...operations,
        webhookSecurity: {
          ...webhookSecurity,
          sharedSecretSet: true,
        },
      },
    };
  }

  private safeCompare(expected: string, actual: string): boolean {
    const normalizedActual = actual?.startsWith('sha256=') ? actual.slice('sha256='.length) : actual;
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(normalizedActual || '');

    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, actualBuffer);
  }
}
