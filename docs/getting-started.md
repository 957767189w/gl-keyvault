# Getting Started

This guide walks through deploying gl-keyvault, registering your first API key,
and using it from a GenLayer Intelligent Contract.

## Prerequisites

- Node.js 18+
- A Vercel account (for deployment) or local development environment
- GenLayer Studio installed (`npm install -g genlayer`)
- At least one external API key to manage (e.g., OpenWeatherMap free tier)

## Step 1: Clone and Configure

```bash
git clone https://github.com/genlayer-foundation/gl-keyvault.git
cd gl-keyvault
npm install
```

Generate your encryption keys:

```bash
# Generate a 32-byte master encryption key
npm run generate-key
# Output: a64f1b2c...  (64 hex chars)

# Generate HMAC secret
npm run generate-key
# Output: 7e8d9c0a...  (64 hex chars)

# Generate admin token
npm run generate-key
# Output: 3b4c5d6e...  (64 hex chars)
```

Create your `.env` file:

```bash
cp .env.example .env
```

Edit `.env` with your generated keys:

```
MASTER_ENCRYPTION_KEY=<first generated key>
HMAC_SECRET=<second generated key>
ADMIN_TOKEN=<third generated key>
```

## Step 2: Run Locally

```bash
npm run dev
```

The proxy service starts at `http://localhost:3000`.

Verify it's running:

```bash
curl http://localhost:3000/api/health
# {"status":"ok","version":"0.1.0","storage":"connected",...}
```

## Step 3: Register an API Key

```bash
# Using the CLI
npx ts-node cli/index.ts \
  --endpoint http://localhost:3000 \
  --token <your_admin_token> \
  add openweather <YOUR_OPENWEATHERMAP_KEY> \
  --base-url https://api.openweathermap.org \
  --quota 500
```

Verify it was registered:

```bash
npx ts-node cli/index.ts \
  --endpoint http://localhost:3000 \
  --token <your_admin_token> \
  list
```

## Step 4: Use in a Contract

Copy the example contract:

```bash
cp contracts/examples/weather_contract.py my_weather.py
```

Update the `KEYVAULT_PROXY` URL to point to your deployed service:

```python
KEYVAULT_PROXY = "http://localhost:3000"  # local dev
# KEYVAULT_PROXY = "https://your-app.vercel.app"  # production
```

Deploy to GenLayer Studio:

```bash
genlayer init
# Open http://localhost:8080
# Paste the contract code
# Deploy and test
```

## Step 5: Deploy to Vercel (Production)

```bash
# Login to Vercel
npx vercel login

# Link Vercel KV storage
npx vercel env add MASTER_ENCRYPTION_KEY
npx vercel env add HMAC_SECRET
npx vercel env add ADMIN_TOKEN

# Add Vercel KV (Redis) from Vercel dashboard
# This auto-populates KV_REST_API_URL and KV_REST_API_TOKEN

# Deploy
npx vercel --prod
```

Update your contracts to use the production URL.

## Step 6: Monitor Usage

```bash
# Check service health
glvault --endpoint https://your-app.vercel.app --token <token> health

# View audit log
glvault --endpoint https://your-app.vercel.app --token <token> audit openweather --last 24h

# Rotate a key when needed
glvault --endpoint https://your-app.vercel.app --token <token> rotate openweather NEW_KEY
```

## Next Steps

- Read the [Security Model](./security-model.md) to understand trust boundaries
- Check [Architecture](./architecture.md) for system design details
- Explore example contracts in `/contracts/examples/`
- Set up monitoring and alerting for your production deployment
