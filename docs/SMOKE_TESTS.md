# ScholarMatch Smoke Tests

These tests verify a tagged staging release deploys from a clean checkout without manual file edits.

## Prerequisites

- Clean checkout of the release tag
- Access to staging environment variables
- Docker and docker-compose installed
- Network access to staging databases

## Setup

```bash
# Clone the repository at the release tag
git clone --branch <tag> https://github.com/org/scholarmatch.git
cd scholarmatch

# Copy environment template
cp .env.staging .env

# Fill in secrets from hosting platform (DO NOT commit)
# Required: SECRET_KEY, DATABASE_URL, REDIS_URL, etc.
```

## Test Suite

### 1. Health Check

**Test**: API responds to health endpoint

```bash
curl -f http://localhost:8000/health | jq
```

**Expected Response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00Z",
  "version": "<tag>",
  "dependencies": {
    "database": "connected",
    "redis": "connected",
    "storage": "available"
  }
}
```

**Pass Criteria**: HTTP 200, all dependencies healthy

---

### 2. Authentication

**Test**: JWT token issuance and validation

```bash
# Register test user
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@scholarmatch.org", "password": "SecurePass123!"}'

# Login and get token
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@scholarmatch.org", "password": "SecurePass123!"}' | jq -r '.access_token')

# Verify token works
curl -f http://localhost:8000/api/v1/profile/me \
  -H "Authorization: Bearer $TOKEN"
```

**Pass Criteria**: 
- Registration succeeds with valid data
- Login returns JWT token
- Token authenticates subsequent requests
- Invalid tokens rejected with 401

---

### 3. Profile Operations

**Test**: Create, read, update profile

```bash
# Create profile
curl -X POST http://localhost:8000/api/v1/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "gpa": 3.8,
    "school": "Test University",
    "major": "Computer Science",
    "class_year": 2025
  }'

# Read profile
curl -f http://localhost:8000/api/v1/profile/me \
  -H "Authorization: Bearer $TOKEN"

# Update profile
curl -X PUT http://localhost:8000/api/v1/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"gpa": 3.9}'
```

**Pass Criteria**:
- Profile created successfully
- Profile data returned correctly
- Updates persist
- Unauthorized access rejected

---

### 4. Scholarship Catalog

**Test**: List and filter scholarships

```bash
# List scholarships with pagination
curl -f "http://localhost:8000/api/v1/scholarships?limit=10&offset=0"

# Filter by deadline
curl -f "http://localhost:8000/api/v1/scholarships?deadline_after=2024-12-01"

# Search by keyword
curl -f "http://localhost:8000/api/v1/scholarships?q=engineering"
```

**Pass Criteria**:
- Pagination works correctly
- Filters applied accurately
- Search returns relevant results
- No SQL injection vulnerabilities

---

### 5. Deterministic Match Fallback

**Test**: Matching works even when AI is unavailable

```bash
# Trigger match with Qwen disabled
export QWEN_API_KEY=""

curl -f http://localhost:8000/api/v1/matches \
  -H "Authorization: Bearer $TOKEN" | jq
```

**Expected Behavior**:
- Returns matches based on deterministic rules
- `explanation_status` = "pending_or_unavailable"
- No errors or timeouts
- Match scores calculated correctly

**Pass Criteria**:
- Matches returned within timeout
- Deterministic scoring accurate
- Graceful degradation documented

---

### 6. Application Create

**Test**: Create and track scholarship application

```bash
# Create application
APPLICATION_ID=$(curl -s -X POST http://localhost:8000/api/v1/applications \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "scholarship_id": "<valid-scholarship-id>",
    "status": "saved"
  }' | jq -r '.id')

# Verify state history
curl -f http://localhost:8000/api/v1/applications/$APPLICATION_ID \
  -H "Authorization: Bearer $TOKEN" | jq '.status_history'

# Transition state
curl -X PATCH http://localhost:8000/api/v1/applications/$APPLICATION_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "preparing"}'
```

**Pass Criteria**:
- Application created with initial status
- Status history recorded with actor/timestamp
- Valid state transitions succeed
- Invalid transitions rejected (e.g., saved→awarded)

---

### 7. Worker Execution

**Test**: Celery workers process jobs

```bash
# Submit embedding job
curl -X POST http://localhost:8000/api/v1/admin/reindex-embeddings \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"entity_type": "scholarship", "batch_size": 10}'

# Check queue status
docker-compose exec worker celery -A app.jobs inspect active

# Verify embeddings generated
psql $DATABASE_URL -c "SELECT COUNT(*) FROM embeddings WHERE version='v1';"
```

**Pass Criteria**:
- Jobs queued successfully
- Workers process without errors
- Embeddings stored correctly
- No duplicate processing

---

### 8. Notification Delivery

**Test**: Deadline reminders sent correctly

```bash
# Trigger notification job
docker-compose exec worker celery -A app.jobs call app.jobs.notifications.send_deadline_reminders

# Check email logs (using fake provider in staging)
docker-compose logs worker | grep "notification_sent"

# Verify deduplication
# Run same job twice, should not send duplicate
```

**Pass Criteria**:
- Reminders sent for upcoming deadlines
- No duplicates within quiet hours
- Opt-out respected
- Timezone handling correct

---

### 9. Database Migration Validation

**Test**: Migrations apply cleanly

```bash
# Check current migration state
docker-compose exec api python -m app.db.migrations current

# Apply any pending migrations
docker-compose exec api python -m app.db.migrations upgrade head

# Verify rollback works
docker-compose exec api python -m app.db.migrations downgrade -1
docker-compose exec api python -m app.db.migrations upgrade head
```

**Pass Criteria**:
- No pending migrations after upgrade
- Rollback succeeds without data loss
- Re-application works cleanly

---

### 10. Security Headers

**Test**: Security headers present

```bash
curl -I http://localhost:8000/health | grep -E "(Strict-Transport-Security|X-Content-Type-Options|X-Frame-Options|Content-Security-Policy)"
```

**Expected Headers**:
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Content-Security-Policy: default-src 'self'
```

**Pass Criteria**: All security headers present with correct values

---

## Cleanup

```bash
# Delete test user
curl -X DELETE http://localhost:8000/api/v1/account \
  -H "Authorization: Bearer $TOKEN"

# Stop services
docker-compose down
```

---

## Results Template

| Test | Status | Notes |
|------|--------|-------|
| Health Check | ☐ Pass / ☐ Fail | |
| Authentication | ☐ Pass / ☐ Fail | |
| Profile Operations | ☐ Pass / ☐ Fail | |
| Scholarship Catalog | ☐ Pass / ☐ Fail | |
| Deterministic Match | ☐ Pass / ☐ Fail | |
| Application Create | ☐ Pass / ☐ Fail | |
| Worker Execution | ☐ Pass / ☐ Fail | |
| Notification Delivery | ☐ Pass / ☐ Fail | |
| Migration Validation | ☐ Pass / ☐ Fail | |
| Security Headers | ☐ Pass / ☐ Fail | |

**Overall Result**: ☐ PASS / ☐ FAIL

**Tested By**: ________________  
**Date**: ________________  
**Release Tag**: ________________
