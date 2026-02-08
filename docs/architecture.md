# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    GenLayer Network                       │
│                                                          │
│  ┌──────────────────┐    ┌──────────────────┐           │
│  │  Intelligent      │    │  Intelligent      │           │
│  │  Contract A       │    │  Contract B       │           │
│  │                   │    │                   │           │
│  │  SecureAPI("owm") │    │  SecureAPI("news")│           │
│  └────────┬──────────┘    └────────┬──────────┘           │
│           │ proxy request          │ proxy request         │
└───────────┼────────────────────────┼──────────────────────┘
            │                        │
            ▼                        ▼
┌──────────────────────────────────────────────────────────┐
│                gl-keyvault Proxy (Vercel)                  │
│                                                           │
│  ┌─────────┐  ┌───────────┐  ┌──────────┐  ┌──────────┐ │
│  │  Auth    │  │  Key      │  │  Rate    │  │  Audit   │ │
│  │  Module  │──│  Store    │──│  Limiter │──│  Logger  │ │
│  │ (HMAC)  │  │ (AES-256) │  │ (bucket) │  │ (append) │ │
│  └─────────┘  └───────────┘  └──────────┘  └──────────┘ │
│       │              │                                    │
│       ▼              ▼                                    │
│  ┌──────────────────────────┐                            │
│  │    Vercel KV (Redis)     │                            │
│  │  - Encrypted key records │                            │
│  │  - Audit log entries     │                            │
│  │  - Rate limit counters   │                            │
│  └──────────────────────────┘                            │
└────────────┬─────────────────────────────────────────────┘
             │ authenticated request (real API key injected)
             ▼
┌──────────────────────────────────────────────────────────┐
│              External APIs                                │
│  ┌────────────┐  ┌───────────┐  ┌──────────────────┐    │
│  │ OpenWeather │  │  NewsAPI  │  │  Alpha Vantage   │    │
│  └────────────┘  └───────────┘  └──────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

## Component Details

### Proxy Service (`/api`)

Vercel serverless functions handling two categories of requests:

1. **Proxy requests** (`POST /api/proxy`): Authenticated relay of contract API calls
2. **Management requests** (`/api/keys/*`): Admin operations for key lifecycle

Each serverless function is stateless. State is persisted in Vercel KV.
Module-level singletons cache connections across warm invocations.

### Core Library (`/lib`)

| Module | Responsibility |
|--------|---------------|
| `encryption.ts` | AES-256-GCM encrypt/decrypt, key generation, sub-key derivation |
| `auth.ts` | HMAC-SHA256 request signing, signature verification, admin token auth |
| `storage.ts` | Key record CRUD, storage backend abstraction, quota management |
| `audit.ts` | Append-only audit log, time-range queries, aggregate stats |
| `config.ts` | Environment variable loading and validation |
| `types.ts` | TypeScript type definitions for all data structures |

### CLI Tool (`/cli`)

Commander.js-based CLI that communicates with the proxy via HTTP.
Designed for developer workstation use, not for on-chain execution.

### Python SDK (`/sdk`)

Minimal Python package (zero external dependencies) that wraps the proxy
interaction pattern for use inside GenVM. The `SecureAPI` class handles
HMAC signing, payload construction, and response parsing.

### Example Contracts (`/contracts`)

Reference implementations showing common patterns:
- Basic weather data retrieval (deterministic, `strict_eq`)
- News sentiment analysis (non-deterministic, `prompt_comparative`)

## Data Flow: Proxy Request

```
1. Contract calls SecureAPI.get("/weather?q=Tokyo")
2. SDK builds payload: {alias, path, method, timestamp, nonce}
3. SDK computes HMAC signature
4. gl.get_webpage() sends request to proxy
5. Proxy verifies HMAC signature (constant-time comparison)
6. Proxy checks timestamp freshness (reject if > 30s old)
7. Proxy checks rate limit (token bucket per alias)
8. Proxy decrypts API key from storage (AES-256-GCM)
9. Proxy constructs target URL: base_url + path + api_key param
10. Proxy forwards request to external API
11. Proxy records audit entry
12. Proxy strips sensitive data from response
13. Proxy returns clean JSON to contract
14. GenLayer validators reach consensus on the response
```

## Storage Schema

All data stored in Vercel KV with the following key patterns:

| Key Pattern | Value | Description |
|------------|-------|-------------|
| `glvault:key:<alias>` | JSON(KeyRecord) | Encrypted API key + metadata |
| `glvault:index` | JSON(string[]) | List of all registered aliases |
| `glvault:audit:<alias>:<id>` | JSON(AuditEntry) | Individual audit log entry |
| `glvault:audit_index:<alias>` | JSON({id,ts}[]) | Per-alias audit index |
