# Security Model

## Threat Analysis

gl-keyvault is designed to solve a fundamental tension in GenLayer's architecture:
Intelligent Contracts need authenticated API access, but on-chain execution means
all data is visible to validators and potentially logged on-chain.

### Threat 1: API Key Exposure On-Chain

**Risk**: If a developer hardcodes an API key in contract source code or passes it
as a constructor argument, the key becomes permanently visible in on-chain state.

**Mitigation**: Keys never exist in contract code. The contract only references an
alias string (e.g., `"openweather"`). The proxy service resolves the alias to the
real key at request time, completely outside the GenVM execution environment.

### Threat 2: Validator Key Snooping

**Risk**: GenLayer validators execute contract code and can observe network traffic.
If the API key appears in any request URL or header during contract execution, validators
could extract it.

**Mitigation**: The contract sends a request to the gl-keyvault proxy URL with only
the alias. The proxy injects the real API key into the outbound request to the external
API. The validator only sees the proxy URL and alias, never the actual key.

### Threat 3: Replay Attacks

**Risk**: An attacker captures a valid proxy request and replays it to drain the
API quota or access data they shouldn't have.

**Mitigation**: Every request includes a timestamp and cryptographic nonce. The proxy
rejects requests older than `MAX_REQUEST_AGE_MS` (default: 30 seconds). The HMAC
signature binds the request to a specific alias, path, method, and time, preventing
modification of any field.

### Threat 4: Signature Forgery

**Risk**: An attacker constructs fake proxy requests with forged signatures.

**Mitigation**: HMAC-SHA256 with a shared secret. The secret is stored as an environment
variable on the proxy service and in the contract deployment configuration. Timing-safe
comparison prevents timing attacks on signature verification.

### Threat 5: Key Compromise

**Risk**: An external API key is compromised or leaked from the external provider.

**Mitigation**: Zero-downtime key rotation via `glvault rotate`. The alias continues
to work immediately with the new key. Old key is overwritten in encrypted storage.
Audit log records all usage for forensic analysis.

### Threat 6: Usage Abuse

**Risk**: A compromised or malicious contract floods the proxy with requests,
exhausting API quotas and incurring costs.

**Mitigation**: Per-alias rate limiting with configurable quotas. Token-bucket
algorithm with sliding windows. Audit logging records all requests with caller
identification for accountability.

## Encryption Details

- **Algorithm**: AES-256-GCM (authenticated encryption with associated data)
- **Key Size**: 256 bits (32 bytes, 64 hex characters)
- **IV**: 128 bits, randomly generated per encryption operation
- **Auth Tag**: 128 bits, verified before decryption to detect tampering
- **Key Storage**: Master encryption key stored as environment variable, never in code
- **At Rest**: API keys are encrypted in Vercel KV (Redis) storage

## Request Authentication Flow

```
1. Contract constructs request: {alias, path, method, timestamp, nonce}
2. HMAC-SHA256 computed: sign(alias:method:path:timestamp:nonce, secret)
3. Request sent to proxy with signature in Authorization header
4. Proxy verifies: timestamp freshness, signature validity (constant-time)
5. Proxy resolves alias -> decrypted API key
6. Proxy forwards to external API with real key injected
7. Proxy returns response to contract (key stripped from response)
8. Audit entry recorded
```

## Limitations

- **Trust Boundary**: The gl-keyvault proxy operator has access to the master
  encryption key and can decrypt any stored API key. In production, this should
  be operated by a trusted entity or moved to a TEE (Trusted Execution Environment).

- **Network Dependency**: The proxy introduces a network hop. If the proxy is down,
  contracts cannot access authenticated APIs. Health monitoring and redundant
  deployment are recommended.

- **Single Point of Decryption**: The proxy is the only place where keys are
  decrypted. This is both a security advantage (reduced attack surface) and a
  availability risk (single point of failure).
