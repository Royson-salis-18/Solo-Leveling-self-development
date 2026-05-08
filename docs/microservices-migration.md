# Solo Leveling Microservices Migration Blueprint

## Goals
- Migrate from current app-coupled service layer to independently deployable services.
- Keep compatibility with current frontend while progressively moving endpoints.
- Enforce strong security defaults for local Docker and future AWS deployment.

## Target Service Boundaries
- `api-gateway`: single public entrypoint, auth verification, rate limiting, request routing.
- `identity-service`: login/register/session/profile identity operations.
- `quest-service`: tasks, raids, recurring sweeps, deadlines, gate lifecycle.
- `progression-service`: XP, levels, streaks, mode rules, penalties, rewards calculations.
- `social-service`: clans, guilds, leaderboard, notifications.
- `ai-service`: Oracle/Architect calls and prompt handling.

## Shared Infrastructure
- `postgres` (or Supabase Postgres in managed mode).
- `redis` for cache, rate limits, idempotency keys, job state.
- `nats` or `sqs/sns` equivalent for async events (`task.completed`, `xp.updated`, `shadow.extracted`).
- `otel-collector` for tracing/log export.

## Security Baseline (Non-Negotiable)
- JWT validation at gateway and service-level authorization checks (defense in depth).
- Service-to-service auth using mTLS or signed service tokens (AWS IAM role based when on ECS/EKS).
- Secrets only from secret manager (AWS Secrets Manager / SSM), never hardcoded env in repo.
- Input validation at every service boundary (schema validation + payload size limits).
- Idempotency keys for mutating endpoints (`completeGate`, `failGate`, `saveGate`).
- Strict CORS allowlist, CSP headers, and secure cookies for browser auth flows.
- Rate limiting and abuse protection on auth and AI endpoints.
- Audit logs for privileged actions and mode switches.

## Migration Strategy
1. **Strangler Phase**
   - Keep current frontend routes unchanged.
   - Point `SystemAPI` to gateway endpoints behind feature flags.
2. **Extract High-Value Domain First**
   - Start with `quest-service` + `progression-service` because they drive dashboard correctness.
3. **Event-Driven Sync**
   - Publish domain events from quest actions; progression/social consume asynchronously.
4. **Cutover by Capability**
   - Gate by endpoint group, not by big-bang release.
5. **Rollback Design**
   - Per-service feature flags to switch calls back to monolith behavior instantly.

## AWS Deployment Path
- **Compute**: ECS Fargate (fastest) or EKS (if you need advanced control).
- **Network**: private subnets for services/data, public ALB only for gateway.
- **Security**: WAF on ALB, IAM roles per task/service, SG least privilege.
- **Data**: RDS Postgres (or Supabase managed), ElastiCache Redis.
- **Messaging**: SQS/SNS or EventBridge.
- **Observability**: CloudWatch + X-Ray/OpenTelemetry + alarms (latency/error/SLO).

## Immediate Next Step
- Stand up local Docker topology (`infra/docker-compose.microservices.yml`) and add a minimal `api-gateway` skeleton.
- Then migrate one endpoint end-to-end (`GET /dashboard`) behind a feature flag.
