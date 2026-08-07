# ScholarMatch Runbooks

## Table of Contents
1. [API Unavailable](#api-unavailable)
2. [Queue Backlog](#queue-backlog)
3. [Failed Ingestion](#failed-ingestion)
4. [Qwen Outage](#qwen-outage)
5. [Email Failure](#email-failure)
6. [Credential Exposure](#credential-exposure)
7. [Bad Migration](#bad-migration)
8. [Rollback Procedure](#rollback-procedure)
9. [Data Deletion Request](#data-deletion-request)

---

## API Unavailable

**Symptoms:**
- Health endpoint returns 5xx errors
- Increased latency or timeouts
- Container restarts in logs

**Alerts:**
- `api_health_check_failed` (Owner: On-call Engineer)
- `api_error_rate_high` (Owner: On-call Engineer)

**Dashboard:** [Grafana API Dashboard](https://grafana.scholarmatch.org/d/api)

**Recovery Steps:**
1. Check container logs: `docker-compose logs api --tail=100`
2. Verify database connectivity: `docker-compose exec api python -c "from app.db.session import get_connection; get_connection()"`
3. Check memory/CPU usage: `docker stats`
4. If OOM: Scale horizontally or increase memory limits
5. If DB connection issue: Check PostgreSQL health and connection pool
6. Restart service: `docker-compose restart api`
7. If persists: Roll back to previous version (see [Rollback Procedure](#rollback-procedure))

---

## Queue Backlog

**Symptoms:**
- Celery queue depth increasing
- Task age exceeding thresholds
- Delayed notifications or embeddings

**Alerts:**
- `celery_queue_depth_high` (Owner: Backend Team)
- `celery_task_age_high` (Owner: Backend Team)

**Dashboard:** [Grafana Celery Dashboard](https://grafana.scholarmatch.org/d/celery)

**Thresholds:**
- Queue depth > 1000: Warning
- Queue depth > 5000: Critical
- Task age > 5 minutes: Warning
- Task age > 30 minutes: Critical

**Recovery Steps:**
1. Identify affected queue: `celery -A app.jobs inspect active`
2. Check worker health: `celery -A app.jobs inspect ping`
3. Scale workers: `docker-compose up -d --scale worker=3`
4. If specific queue stuck: Purge if safe `celery -A app.jobs purge -Q <queue_name>`
5. Check for poison pills in dead-letter queue
6. Investigate root cause: long-running tasks, external dependency failures

---

## Failed Ingestion

**Symptoms:**
- Ingestion jobs failing repeatedly
- Scholarship data not updating
- Error logs with parsing/validation failures

**Alerts:**
- `ingestion_failure_rate_high` (Owner: Data Team)

**Dashboard:** [Grafana Ingestion Dashboard](https://grafana.scholarmatch.org/d/ingestion)

**Recovery Steps:**
1. Check ingestion job logs: `docker-compose logs worker | grep ingestion`
2. Identify failing source URLs
3. Validate source accessibility: `curl -I <source_url>`
4. If HTML structure changed: Update parsers and redeploy
5. If rate-limited: Implement backoff and retry later
6. Re-run failed ingestion with dry-run first: `python -m app.jobs.ingestion --dry-run --source=<source>`
7. Monitor re-ingestion progress

---

## Qwen Outage

**Symptoms:**
- Explanation generation failing
- Increased latency in match endpoints
- `explanation_status=pending_or_unavailable` in responses

**Alerts:**
- `qwen_error_rate_high` (Owner: AI Team)
- `qwen_latency_high` (Owner: AI Team)

**Dashboard:** [Grafana AI Dashboard](https://grafana.scholarmatch.org/d/ai)

**Recovery Steps:**
1. Verify Qwen API status externally
2. Check API key validity and rate limits
3. If outage confirmed: Explanations will gracefully degrade
4. Deterministic matches continue unaffected
5. Enable cached explanations only mode if needed
6. Monitor for automatic retries when service recovers
7. Consider fallback model if prolonged outage

---

## Email Failure

**Symptoms:**
- Deadline reminders not sent
- Notification jobs failing
- Bounce rate increasing

**Alerts:**
- `email_delivery_failure_high` (Owner: Platform Team)
- `email_bounce_rate_high` (Owner: Platform Team)

**Dashboard:** [Grafana Notifications Dashboard](https://grafana.scholarmatch.org/d/notifications)

**Recovery Steps:**
1. Check email provider status page
2. Verify API credentials: `echo $EMAIL_PROVIDER_API_KEY`
3. Check sender domain reputation
4. Review bounce reasons in logs
5. If provider issue: Switch to backup provider if configured
6. Re-queue failed notifications after fix
7. Manually send critical notifications if needed

---

## Credential Exposure

**Symptoms:**
- Unauthorized access detected
- Unusual API traffic patterns
- Credentials leaked in logs or repositories

**Alerts:**
- `security_credential_exposure` (Owner: Security Team - P1)

**Immediate Actions:**
1. **ROTATE ALL EXPOSED CREDENTIALS IMMEDIATELY**
   - Database passwords
   - API keys (Qwen, Email, Sentry)
   - JWT secret keys
   - Redis passwords
2. Revoke compromised tokens/sessions
3. Audit access logs for unauthorized activity
4. Notify affected users if personal data exposed
5. File incident report

**Recovery Steps:**
1. Update secrets in hosting platform
2. Redeploy services with new credentials
3. Invalidate all existing JWT tokens
4. Force password reset for affected accounts
5. Review and enhance secret management practices

---

## Bad Migration

**Symptoms:**
- Database errors after deployment
- Schema mismatch errors
- Application crashes on startup

**Alerts:**
- `migration_failure` (Owner: Database Team - P1)

**Recovery Steps:**
1. Stop application deployments immediately
2. Check migration status: `python -m app.db.migrations current`
3. If migration partially applied:
   - Do NOT attempt manual fixes
   - Restore from pre-migration backup
4. Execute rollback: `python -m app.db.migrations rollback`
5. If rollback fails: Follow [Rollback Procedure](#rollback-procedure)
6. Investigate migration script in staging environment
7. Fix and re-test before re-applying

---

## Rollback Procedure

**When to Rollback:**
- Critical bug in production
- Bad database migration
- Performance degradation > 50%
- Security vulnerability discovered

**Prerequisites:**
- Previous stable Docker image tag available
- Database backup from before deployment
- Staging environment verified working

**Steps:**
1. Announce rollback in incident channel
2. Stop auto-scaling: `kubectl scale deployment api --replicas=0`
3. Deploy previous version:
   ```bash
   kubectl set image deployment/api api=ghcr.io/org/scholarmatch:<previous-tag>
   kubectl set image deployment/worker worker=ghcr.io/org/scholarmatch:<previous-tag>
   ```
4. If DB migration involved: Execute rollback migration
5. Verify health endpoints: `curl https://api.scholarmatch.org/health`
6. Run smoke tests manually
7. Monitor error rates and latency
8. Post-mortem within 48 hours

---

## Data Deletion Request

**Trigger:** User requests account deletion via UI or support

**SLA:** Complete within 30 days (configurable via `ACCOUNT_DELETION_GRACE_DAYS`)

**Steps:**
1. Verify user identity and request authenticity
2. Mark account for deletion with grace period start
3. Send confirmation email to user
4. After grace period expires, execute deletion job:
   ```python
   celery -A app.jobs delete_user_data --user_id=<id>
   ```
5. Delete records in order:
   - Applications and notes
   - Profile data and embeddings
   - Cached matches
   - Audit logs (anonymize instead of delete if required by law)
   - User record
6. Delete objects from storage
7. Cancel pending jobs for user
8. Send deletion confirmation email
9. Log deletion event for compliance

**Verification:**
- Query database to confirm no PII remains
- Check storage buckets for orphaned files
- Verify embeddings removed from pgvector

---

## Dashboards and Alerts Summary

| Dashboard | URL | Owner | Key Alerts |
|-----------|-----|-------|------------|
| API Health | grafana.scholarmatch.org/d/api | On-call | health_check_failed, error_rate_high |
| Celery Queues | grafana.scholarmatch.org/d/celery | Backend | queue_depth_high, task_age_high |
| Ingestion | grafana.scholarmatch.org/d/ingestion | Data | ingestion_failure_rate |
| AI Services | grafana.scholarmatch.org/d/ai | AI Team | qwen_error_rate, qwen_latency |
| Notifications | grafana.scholarmatch.org/d/notifications | Platform | email_delivery_failure, bounce_rate |

## Alert Thresholds

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| API Error Rate | > 1% | > 5% | Investigate logs |
| API Latency (p95) | > 500ms | > 2s | Scale or optimize |
| Queue Depth | > 1000 | > 5000 | Scale workers |
| Task Age | > 5min | > 30min | Check for stuck tasks |
| Email Bounce Rate | > 5% | > 10% | Review list hygiene |
| Qwen Error Rate | > 10% | > 50% | Enable fallback |
