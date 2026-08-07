# Database Operations Guide

## Migration Procedures

### Forward Migration

**Before Migration:**
1. Create database backup
2. Notify stakeholders of maintenance window
3. Stop application deployments
4. Test migration in staging environment

**Execute Migration:**
```bash
# Check current version
docker-compose exec api python -m app.db.migrations current

# Review pending migrations
docker-compose exec api python -m app.db.migrations history

# Apply all pending migrations
docker-compose exec api python -m app.db.migrations upgrade head

# Verify new version
docker-compose exec api python -m app.db.migrations current
```

**After Migration:**
1. Run smoke tests
2. Monitor error rates for 15 minutes
3. Resume deployments if successful
4. Document migration in changelog

### Rollback Procedure

**When to Rollback:**
- Migration causes application errors
- Data corruption detected
- Performance degradation > 50%

**Execute Rollback:**
```bash
# Rollback one version
docker-compose exec api python -m app.db.migrations downgrade -1

# Rollback to specific version
docker-compose exec api python -m app.db.migrations downgrade <version_id>

# Rollback all migrations (dangerous!)
docker-compose exec api python -m app.db.migrations downgrade base
```

**Important Notes:**
- Never manually edit migration scripts after deployment
- Test rollback in staging before production
- Some migrations may be irreversible (data loss)
- Always have pre-migration backup

### Roll-Forward Procedure

If rollback is not possible:
1. Create fix migration that addresses the issue
2. Test thoroughly in staging
3. Deploy fix migration with emergency change process
4. Document technical debt for later cleanup

---

## Backup Configuration

### Automated Backups

**PostgreSQL:**
- Frequency: Every 6 hours
- Retention: 30 days
- Storage: Encrypted S3 bucket
- Verification: Weekly restore test in staging

**Redis:**
- RDB snapshots: Every 15 minutes
- AOF logs: Every second
- Retention: 7 days

**Object Storage:**
- Versioning: Enabled
- Cross-region replication: Enabled
- Lifecycle policies: Archive after 90 days

### Manual Backup

```bash
# PostgreSQL full backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# PostgreSQL with compression
pg_dump $DATABASE_URL | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Single table backup
pg_dump -t applications $DATABASE_URL > applications_backup.sql

# Redis backup
docker-compose exec redis redis-cli BGSAVE
cp /var/lib/redis/dump.rdb ./redis_backup_$(date +%Y%m%d_%H%M%S).rdb
```

---

## Restore Drill

**Frequency:** Quarterly in non-production environment

### Preparation

1. **Schedule**: Choose low-traffic window
2. **Environment**: Use isolated staging environment
3. **Team**: DBA, backend engineer, on-call
4. **Communication**: Notify team of drill

### Restore Steps

```bash
# 1. Stop application writes
docker-compose stop api worker beat

# 2. Drop existing database (staging only!)
docker-compose exec postgres dropdb -U postgres scholarmatch_dev

# 3. Create fresh database
docker-compose exec postgres createdb -U postgres scholarmatch_dev

# 4. Restore from backup
gunzip < backup_20240101_120000.sql.gz | \
  docker-compose exec -T postgres psql -U postgres -d scholarmatch_dev

# 5. Verify row counts
docker-compose exec postgres psql -U postgres -d scholarmatch_dev -c "
  SELECT 'users' as table_name, COUNT(*) FROM users
  UNION ALL SELECT 'applications', COUNT(*) FROM applications
  UNION ALL SELECT 'scholarships', COUNT(*) FROM scholarships;
"

# 6. Restart services
docker-compose start api worker beat

# 7. Run health checks
curl http://localhost:8000/health

# 8. Execute smoke tests
./docs/run_smoke_tests.sh
```

### Verification Checklist

- [ ] All tables restored with correct row counts
- [ ] Foreign key constraints intact
- [ ] Indexes rebuilt successfully
- [ ] pgvector embeddings accessible
- [ ] Application can connect and query
- [ ] Critical user flows work (login, profile, applications)
- [ ] No data corruption detected

### Post-Drill Activities

1. **Document**: Record restore time, issues encountered
2. **Improve**: Update procedures based on lessons learned
3. **Report**: Share results with security/compliance teams
4. **Schedule**: Set next drill date (quarterly)

---

## Readiness Behavior

### Startup Checks

The application performs these checks on startup:

**Required Dependencies** (block traffic if unavailable):
- PostgreSQL connection
- Redis connection
- Object storage access
- Required environment variables

**Optional Dependencies** (log warning, continue):
- Qwen AI service
- Email provider
- Sentry/observability

### Health Endpoint

```json
GET /health

{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00Z",
  "version": "v1.2.3",
  "dependencies": {
    "database": {
      "status": "connected",
      "latency_ms": 5
    },
    "redis": {
      "status": "connected",
      "latency_ms": 2
    },
    "storage": {
      "status": "available"
    },
    "qwen_ai": {
      "status": "unavailable",
      "note": "Optional service, matches will use deterministic scoring only"
    }
  }
}
```

### Graceful Degradation

When optional services are unavailable:

| Service Unavailable | Behavior |
|---------------------|----------|
| Qwen AI | Return deterministic matches, `explanation_status=pending_or_unavailable` |
| Email Provider | Queue notifications for retry, log warnings |
| Sentry | Continue operation, buffer logs locally |
| Embedding Service | Skip semantic search, use keyword matching |

---

## Connection Pooling

### PostgreSQL

```python
# Recommended pool settings for production
POOL_SIZE = 20  # connections per worker
MAX_OVERFLOW = 10  # temporary extra connections
POOL_TIMEOUT = 30  # seconds to wait for connection
POOL_RECYCLE = 1800  # recycle connections after 30 minutes
```

### Redis

```python
# Recommended Redis pool settings
REDIS_MAX_CONNECTIONS = 50
REDIS_SOCKET_TIMEOUT = 5  # seconds
REDIS_RETRY_ON_TIMEOUT = True
```

---

## Monitoring Queries

### Database Health

```sql
-- Connection count
SELECT count(*) FROM pg_stat_activity;

-- Long-running queries (> 5 minutes)
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';

-- Table sizes
SELECT 
  schemaname || '.' || relname AS table_name,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;

-- Index usage
SELECT 
  schemaname || '.' || relname AS table_name,
  indexrelname AS index_name,
  idx_scan AS index_scans
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;
```

### pgvector Health

```sql
-- Embedding count by version
SELECT embedding_version, entity_type, COUNT(*) 
FROM embeddings 
GROUP BY embedding_version, entity_type;

-- Vector similarity index status
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'embeddings';
```

---

## Emergency Contacts

| Role | Contact | Escalation |
|------|---------|------------|
| On-call Engineer | pagerduty:oncall | Immediate |
| Database Team | #dba-slack-channel | 15 minutes |
| Security Team | security@scholarmatch.org | P1 incidents only |
| Platform Lead | platform-lead@scholarmatch.org | After hours escalation |
