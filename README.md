# gl-keyvault

Secure API key management proxy for GenLayer Intelligent Contracts.

Intelligent Contracts run on-chain where all data is transparent. `gl-keyvault` solves the fundamental problem of using authenticated external APIs (weather, prices, news) without ever exposing API keys to validators, on-chain storage, or transaction logs.

## How It Works

```
Intelligent Contract          gl-keyvault Proxy           External API
┌──────────────────┐     ┌──────────────────────┐     ┌──────────────┐
│                  │     │ 1. Verify HMAC sig   │     │              │
│  SecureAPI.get() │────>│ 2. Decrypt key alias │────>│ api.weather  │
│  (alias + HMAC)  │     │ 3. Inject real key   │     │    .com      │
│                  │<────│ 4. Strip key from    │<────│              │
│                  │     │    response          │     │              │
└──────────────────┘     └──────────────────────┘     └──────────────┘
                          Keys: AES-256-GCM encrypted
                          Contract sees: proxy URL only
```

## Architecture

- **Proxy Service** (`/api`) — Vercel serverless functions that relay authenticated API requests
- **Core Library** (`/lib`) — Encryption, rate limiting, audit logging, authentication
- **CLI Tool** (`/cli`) — `glvault` command for key registration, rotation, and monitoring
- **Python SDK** (`/sdk`) — `SecureAPI` class for use inside GenLayer contracts
- **Example Contracts** (`/contracts`) — Ready-to-deploy GenLayer contract templates

## Quick Start

### 1. Deploy the Proxy

```bash
npm install
cp .env.example .env
# Edit .env with your MASTER_ENCRYPTION_KEY and HMAC_SECRET

# Local development
npm run dev

# Deploy to Vercel
npx vercel --prod
```

### 2. Register API Keys

```bash
# Install CLI globally
npm link

# Add an API key
glvault add openweather YOUR_API_KEY --quota 1000

# Add with custom base URL
glvault add newsapi YOUR_KEY --quota 500 --base-url https://newsapi.org/v2

# List registered keys
glvault list

# Rotate a key (zero downtime)
glvault rotate openweather NEW_API_KEY
```

### 3. Use in Intelligent Contracts

```python
from genlayer import *
from gl_keyvault import SecureAPI

class WeatherContract(gl.Contract):
    forecast: str

    @gl.public.write
    def get_forecast(self, city: str):
        api = SecureAPI("openweather")

        def nondet():
            data = api.get(f"/data/2.5/weather?q={city}&units=metric")
            return f"{data['main']['temp']}C, {data['weather'][0]['description']}"

        self.forecast = gl.eq_principle_strict_eq(nondet)
```

## Security Model

| Threat | Mitigation |
|--------|-----------|
| Key exposure on-chain | Keys never appear in contract code or chain state |
| Validator snooping | Keys resolved at proxy layer, not inside GenVM |
| Replay attacks | HMAC signatures with timestamp and nonce |
| Key compromise | Zero-downtime rotation via alias indirection |
| Usage abuse | Per-alias rate limiting with configurable quotas |
| Audit trail | Append-only usage log per key alias |

## API Reference

### Proxy Endpoint

```
POST /api/proxy
Authorization: Bearer <hmac_signature>
Content-Type: application/json

{
  "alias": "openweather",
  "path": "/data/2.5/weather?q=Tokyo",
  "method": "GET",
  "timestamp": 1707400000,
  "nonce": "abc123"
}
```

### Key Management Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/keys/register` | POST | Register a new API key |
| `/api/keys/list` | GET | List registered key aliases |
| `/api/keys/rotate` | POST | Rotate an existing key |
| `/api/keys/audit` | GET | Retrieve usage audit log |
| `/api/health` | GET | Service health check |

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `MASTER_ENCRYPTION_KEY` | 32-byte hex key for AES-256-GCM | Yes |
| `HMAC_SECRET` | Secret for request signature verification | Yes |
| `ADMIN_TOKEN` | Bearer token for key management endpoints | Yes |
| `KV_REST_API_URL` | Vercel KV (Redis) URL | Yes (production) |
| `KV_REST_API_TOKEN` | Vercel KV auth token | Yes (production) |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in ms (default: 60000) | No |
| `MAX_REQUEST_AGE_MS` | Max timestamp age for replay protection (default: 30000) | No |

## Development

```bash
npm install
npm run dev        # Start local dev server
npm run test       # Run test suite
npm run lint       # Lint codebase
npm run build      # Build for production
```

## License

MIT
