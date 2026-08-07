# ScholarMatch Demo Mode Guide

## Overview

Demo mode allows you to test the ScholarMatch API without needing real authentication tokens. This is useful for:
- Local development and testing
- Exploring API endpoints
- Running integration tests without setting up full auth infrastructure

## ⚠️ Security Warning

**NEVER enable demo mode in production or staging environments.** Demo mode bypasses all authentication and authorization checks.

## Quick Start

### 1. Enable Demo Mode

Set the environment variable before starting the server:

```bash
export SCHOLARMATCH_DEMO_MODE=true
cd /workspace/backend
uvicorn app.main:app --reload --env-file .env.development
```

Or run the demo script directly:

```bash
cd /workspace/backend
SCHOLARMATCH_DEMO_MODE=true python -m app.demo
```

### 2. Verify Demo Mode is Active

Visit `http://localhost:8000/demo/status` to confirm demo mode is enabled.

```bash
curl http://localhost:8000/demo/status
```

Expected response:
```json
{
  "demo_mode_enabled": true,
  "environment": "development",
  "warnings": [
    "Demo mode bypasses authentication",
    "Do not use with production data",
    "Disable before deploying to staging/production"
  ]
}
```

### 3. Make API Calls Without Authentication

In demo mode, you can call protected endpoints without providing an Authorization header:

```bash
# Get current user context (no auth needed)
curl http://localhost:8000/demo/whoami

# Access profile endpoint (normally requires auth)
curl http://localhost:8000/api/v1/profile/me

# Create a scholarship application (normally requires auth)
curl -X POST http://localhost:8000/api/v1/applications \
  -H "Content-Type: application/json" \
  -d '{"scholarship_id": "...", "status": "saved"}'
```

All requests will be authenticated as a demo user automatically.

## Demo Endpoints

### `/demo/whoami` (GET)

Returns information about the current demo user context.

```bash
curl http://localhost:8000/demo/whoami
```

Response:
```json
{
  "demo_mode": true,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "role": "user"
  },
  "admin_user": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "role": "admin"
  },
  "message": "Demo mode is active. All API calls are authenticated as demo users."
}
```

### `/demo/status` (GET)

Returns demo mode configuration and status.

```bash
curl http://localhost:8000/demo/status
```

### `/demo/reset` (POST)

Resets demo state (currently a no-op, reserved for future use).

```bash
curl -X POST http://localhost:8000/demo/reset
```

## Testing User vs Admin Roles

By default, regular API calls use the demo **user** role. For admin-only endpoints, the system automatically uses the demo **admin** role when the route requires it.

To test role-based access:

```bash
# Regular user endpoint (uses demo user)
curl http://localhost:8000/api/v1/profile/me

# Admin endpoint (automatically uses demo admin)
curl http://localhost:8000/api/v1/admin/scholarships
```

## Using with Frontend

If you're testing with the frontend, configure your API client to work in demo mode:

1. Set the API base URL to `http://localhost:8000`
2. Do NOT include Authorization headers (or they'll override demo mode)
3. The backend will inject demo credentials automatically

Example fetch call:
```javascript
// No Authorization header needed in demo mode
const response = await fetch('http://localhost:8000/api/v1/profile/me');
const profile = await response.json();
```

## Docker Compose Setup

To run the full stack in demo mode:

```bash
# In .env.development or docker-compose.override.yml
SCHOLARMATCH_DEMO_MODE=true

# Start all services
docker-compose up -d
```

## Disabling Demo Mode

To disable demo mode:

```bash
unset SCHOLARMATCH_DEMO_MODE
# or
export SCHOLARMATCH_DEMO_MODE=false
```

Then restart the server.

## Troubleshooting

### Demo mode not working?

1. Check that `SCHOLARMATCH_DEMO_MODE=true` is set
2. Verify with `curl http://localhost:8000/demo/status`
3. Ensure you're not sending an Authorization header (it takes precedence)
4. Restart the server after changing environment variables

### Getting 401 errors?

- Make sure demo mode is enabled (`/demo/status`)
- Remove any Authorization headers from your requests
- Check that the middleware is loaded (look for `X-Demo-Mode: enabled` header in responses)

### Admin routes returning 403?

- The route should automatically use the demo admin user
- Verify the route requires `ApplicationRole.ADMIN`
- Check server logs for middleware activation

## Architecture

Demo mode works by:

1. **Middleware Injection**: A custom middleware injects demo user objects into `request.state`
2. **Dependency Override**: The `get_current_user` dependency checks for demo users first
3. **Role Handling**: Admin routes automatically get the demo admin user

See `backend/app/demo.py` and `backend/app/auth/dependencies.py` for implementation details.

## Best Practices

✅ **DO:**
- Use demo mode only for local development
- Test with realistic data scenarios
- Verify behavior matches production expectations
- Disable before committing code or deploying

❌ **DON'T:**
- Enable demo mode with production databases
- Store demo mode credentials in version control
- Assume demo mode perfectly replicates production auth behavior
- Skip testing with real auth before deployment

## Related Documentation

- [Development Setup](../README.md)
- [API Documentation](http://localhost:8000/docs)
- [Security Guidelines](../../docs/SECURITY.md)
- [Testing Guide](tests/README.md)
