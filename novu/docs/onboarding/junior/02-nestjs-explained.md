# NestJS Explained

NestJS gives Node.js backends a consistent shape. In Novu, the API, worker, websocket service, and webhook service all use NestJS patterns so code can be split into modules, controllers, services/use cases, and decorators.

## Four Concepts

### Modules

A module is a box of related providers and controllers. Example: `apps/api/src/app/events/events.module.ts` wires the event trigger controller and use cases.

The biggest map is `apps/api/src/app.module.ts`. If you want to know whether a feature is loaded by the API, start there.

### Controllers

A controller receives HTTP requests. Example: `apps/api/src/app/events/events.controller.ts`.

`@Controller({ path: 'events', scope: Scope.REQUEST })` tells Nest that this class owns routes under `/events`. `@Post('/trigger')` marks a method as the handler for a POST route.

### Services And Use Cases

Most Novu business logic lives in injectable use-case classes. Example: `ParseEventRequest` in `apps/api/src/app/events/usecases/parse-event-request/parse-event-request.usecase.ts`.

The controller should be the doorway. The use case should do the work.

### Decorators

Decorators are small annotations that make Nest do work around your code.

Examples from Novu:

- `@Controller`: declares a route group.
- `@Post`, `@Get`, `@Patch`, `@Delete`: declare HTTP methods.
- `@Body`, `@Param`, `@Headers`: read parts of a request.
- `@Injectable`: lets Nest create and inject the class.
- `@RequireAuthentication`: applies the auth guard from `apps/api/src/app/auth/framework/auth.decorator.ts`.
- `@ExternalApiAccessible`: marks routes that may use API key auth.
- `@UseInterceptors`: applies interceptors such as class serialization or response handling.
- `@HealthCheck`: marks Terminus health-check endpoints.

## Dependency Injection

Dependency injection means a class asks Nest for the tools it needs instead of creating them itself. Think of a restaurant kitchen: the cook does not build an oven for every order; the kitchen provides one.

Example: `Webhook` in `apps/webhook/src/webhooks/usecases/webhook/webhook.usecase.ts` asks for `IntegrationRepository`, `MessageRepository`, `AnalyticsService`, and `CreateExecutionDetails` in its constructor. Nest provides those instances.

This matters because Novu uses many shared services: repositories, queues, feature flags, loggers, provider factories, and enterprise modules. Injection keeps those dependencies visible.

## How To Navigate

Given a feature name:

1. Search for its controller with `rg "@Controller.*feature" apps/api/src/app`.
2. Open the module next to it.
3. Read the controller method for route shape.
4. Follow the injected use case.
5. Follow repository calls into `libs/dal`.

Example: subscribers.

- Controller: `apps/api/src/app/subscribers-v2/subscribers.controller.ts`
- DTOs: `apps/api/src/app/subscribers-v2/dtos`
- Use cases: `apps/api/src/app/subscribers-v2/usecases`
- Data: `libs/dal/src/repositories/subscriber`

## Decorator Glossary

- `@ApiTags`, `@ApiOperation`, `@ApiResponse`: Swagger/OpenAPI documentation.
- `@ApiExcludeController`: hides internal controllers such as health checks from Swagger.
- `@SkipPermissionsCheck`: skips permission checks for special test/internal routes.
- `@Instrument` and `@InstrumentUsecase`: wraps methods for instrumentation.
- `@ValidateNested`, `@IsString`, `@IsOptional`, `@IsEnum`: validation decorators from `class-validator` used on DTOs and command classes.

