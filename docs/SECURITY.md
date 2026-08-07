# ScholarMatch Threat Model and Security Documentation

## 1. Data Classification

### 1.1 Data Categories

| Category | Examples | Sensitivity | Retention |
|----------|----------|-------------|-----------|
| **Public** | Scholarship titles, descriptions, deadlines | Low | Indefinite |
| **Internal** | Match scores (internal), admin notes | Medium | 7 years |
| **Confidential** | User profiles, applications, essays | High | Account lifetime + 90 days |
| **Restricted** | Passwords, API keys, tokens | Critical | Until rotation/deletion |

### 1.2 PII Inventory

- **User Identity**: Email, name, demographic info (optional)
- **Educational**: GPA, school, major, class year
- **Financial**: Financial need indicators (not full financial data)
- **Biographical**: Essays, extracurriculars, achievements

---

## 2. Threat Model

### 2.1 Trust Boundaries

```
┌─────────────────────────────────────────────────────────┐
│                    External Network                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Browser  │  │ Mobile   │  │ Attacker │              │
│  │ Client   │  │ App      │  │          │              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       │             │             │                     │
│       ▼             ▼             ▼                     │
│  ┌─────────────────────────────────────────┐           │
│  │         API Gateway / Load Balancer     │           │
│  │         (TLS Termination, Rate Limit)   │           │
│  └─────────────────────┬───────────────────┘           │
└────────────────────────┼────────────────────────────────┘
                         │
┌────────────────────────┼────────────────────────────────┐
│                        ▼            DMZ                 │
│  ┌─────────────────────────────────────────┐           │
│  │         FastAPI Application             │           │
│  │         (Auth, Validation, Business Logic)          │
│  └─────┬─────────────┬─────────────┬────────┘           │
│        │             │             │                     │
│        ▼             ▼             ▼                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │PostgreSQL│  │  Redis   │  │  Object  │              │
│  │+pgvector │  │  Cache   │  │  Storage │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### 2.2 STRIDE Analysis

| Threat | Description | Mitigation |
|--------|-------------|------------|
| **Spoofing** | Attacker impersonates user/admin | JWT authentication, MFA for admins, secure session management |
| **Tampering** | Unauthorized data modification | Input validation, ORM with parameterized queries, audit logs |
| **Repudiation** | Denying actions taken | Append-only audit logs, signed requests |
| **Information Disclosure** | Data leakage to unauthorized parties | RBAC, encryption at rest/in transit, data minimization |
| **Denial of Service** | Service disruption | Rate limiting, auto-scaling, circuit breakers |
| **Elevation of Privilege** | Gaining higher access | Strict authorization checks, principle of least privilege |

### 2.3 Attack Vectors

#### A. Authentication/Authorization
- **Risk**: Credential stuffing, token theft, IDOR
- **Mitigations**:
  - Rate limiting on auth endpoints (10 req/min)
  - JWT with short expiry (15 min) + refresh tokens
  - Authorization checks in both routes AND services
  - UUID-based IDs instead of sequential

#### B. Injection Attacks
- **Risk**: SQL injection, XSS, command injection
- **Mitigations**:
  - Parameterized queries via psycopg
  - HTML sanitization for imported content
  - Input validation with Pydantic
  - CSP headers, output encoding

#### C. SSRF/URL Manipulation
- **Risk**: Fetching internal resources via user-provided URLs
- **Mitigations**:
  - Outbound URL allowlist for ingestion
  - Block private IP ranges in URL fetcher
  - Use dedicated egress with firewall rules

#### D. Data Exfiltration
- **Risk**: Bulk data export, cross-user access
- **Mitigations**:
  - Pagination limits on all list endpoints
  - Ownership checks on every record access
  - Audit logging for bulk operations
  - No cross-user data exposure in notifications

#### E. Prompt Injection (AI)
- **Risk**: Malicious input manipulating Qwen explanations
- **Mitigations**:
  - Sanitize inputs before sending to AI
  - Strict output schema validation
  - Reject unsupported scholarship claims
  - Human review for flagged outputs

---

## 3. Retention Policy

### 3.1 Data Retention Schedule

| Data Type | Retention Period | Deletion Method | Legal Basis |
|-----------|------------------|-----------------|-------------|
| Active user accounts | Until deletion request | Soft delete + hard delete after grace period | Consent |
| Deleted user PII | Grace period (30 days default) | Hard delete from all stores | Consent withdrawal |
| Application records | Account lifetime + 90 days | Cascading delete | Contract |
| Scholarship data | 7 years after expiry | Archive then delete | Legitimate interest |
| Audit logs | 7 years | Anonymize (remove user references) | Legal obligation |
| Embeddings | Account lifetime | Delete on account deletion | Consent |
| Cached matches | 30 days | TTL expiration | Legitimate interest |
| Email logs | 90 days | Automatic purge | Legitimate interest |

### 3.2 Account Deletion Workflow

1. **Request**: User submits deletion request via UI or support
2. **Verification**: Confirm identity via email confirmation
3. **Grace Period**: 30-day window to cancel (configurable)
4. **Execution**: Automated job deletes/anonymizes data
5. **Confirmation**: Email sent upon completion
6. **Audit**: Deletion event logged (anonymized)

---

## 4. Incident Response

### 4.1 Severity Levels

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| **P1** | Critical security/data loss | Immediate (< 15 min) | Credential exposure, active breach |
| **P2** | Major functionality impaired | < 1 hour | API outage, payment failure |
| **P3** | Minor functionality impaired | < 4 hours | Non-critical bug, slow performance |
| **P4** | Cosmetic/minor issues | Next business day | UI glitch, documentation error |

### 4.2 Response Process

```
Detection → Triage → Containment → Eradication → Recovery → Post-Mortem
```

#### Roles and Responsibilities

| Role | Responsibilities |
|------|------------------|
| **Incident Commander** | Coordinate response, communication |
| **Tech Lead** | Technical decisions, root cause analysis |
| **On-call Engineer** | Initial investigation, mitigation |
| **Security Team** | Security incidents, forensics |
| **Comms Lead** | User/stakeholder communication |

### 4.3 Communication Plan

- **Internal**: Slack #incidents channel, PagerDuty
- **External**: Status page, email for affected users
- **Regulatory**: Report within 72 hours if GDPR breach

### 4.4 Post-Mortem Requirements

For P1/P2 incidents:
- Timeline of events (detection to resolution)
- Root cause analysis (5 Whys)
- Impact assessment (users affected, data exposed)
- Action items with owners and deadlines
- Review within 2 weeks of closure

---

## 5. Security Controls

### 5.1 Access Control

- **RBAC**: Roles (user, admin, superadmin) with explicit permissions
- **MFA**: Required for admin accounts
- **Session Management**: Short-lived tokens, secure cookies
- **API Keys**: Rotated quarterly, scoped permissions

### 5.2 Encryption

- **In Transit**: TLS 1.3 everywhere, HSTS enabled
- **At Rest**: 
  - PostgreSQL: TDE or disk encryption
  - Redis: Auth + TLS
  - Object Storage: Server-side encryption
- **Secrets**: Managed by hosting platform, never in code

### 5.3 Network Security

- **Firewall**: Allow only required ports (80, 443, 5432, 6379)
- **VPC**: Isolated network for services
- **SSRF Protection**: Private IP blocking, URL allowlists
- **CORS**: Strict origin allowlist

### 5.4 Monitoring & Logging

- **Structured Logs**: JSON format, correlation IDs
- **Redaction**: PII automatically redacted from logs
- **Alerts**: Automated alerts for anomalies
- **Retention**: Logs retained 90 days, archived 7 years

---

## 6. Compliance Considerations

### 6.1 GDPR

- **Lawful Basis**: Consent for profile data, legitimate interest for scholarship matching
- **Data Subject Rights**: Access, rectification, erasure, portability
- **DPA**: Required for processors (hosting, email, AI providers)
- **Cross-border**: Adequacy decisions or SCCs for non-EU transfers

### 6.2 FERPA (if applicable)

- Educational records protection
- Parental consent for minors
- Directory information opt-out

### 6.3 CCPA/CPRA

- Right to know what data is collected
- Right to delete
- Right to opt-out of sale/sharing
- No discrimination for exercising rights

---

## 7. Secure Development Practices

### 7.1 Code Review Requirements

- All changes require PR review
- Security-sensitive changes need security team approval
- Automated security scanning in CI/CD

### 7.2 Dependency Management

- Pin all dependencies with exact versions
- Weekly security scans with `safety` and `bandit`
- Triage vulnerabilities within SLA:
  - Critical: 24 hours
  - High: 1 week
  - Medium: 1 month
- Avoid blind upgrades across breaking versions

### 7.3 Testing Requirements

- Unit tests for all new features
- Security tests: privilege escalation, IDOR, rate-limit bypass
- Penetration testing annually
- Red team exercises biannually

---

## 8. Contact

**Security Team**: security@scholarmatch.org  
**Report Vulnerability**: https://scholarmatch.org/security  
**PGP Key**: Available on security page
