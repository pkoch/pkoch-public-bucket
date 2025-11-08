# AGENTS.md - Guide for AI Agents

This document provides comprehensive information about this repository to help AI agents understand and work with the codebase effectively.

## Repository Overview

**Purpose**: This is a Cloudflare Workers application that provides public HTTP access to a Cloudflare R2 bucket (pkoch-public). It serves as a simple CDN-like service with free egress.

**Live URL**: https://public-bucket.pkoch.workers.dev/

**Technology Stack**:
- Cloudflare Workers (serverless JavaScript runtime)
- Cloudflare R2 (S3-compatible object storage)
- Wrangler (Cloudflare's CLI tool)
- Node.js v22.11+ / npm v10.9+

## Repository Structure

```
.
├── .github/
│   ├── dependabot.yml          # Dependency update automation
│   └── workflows/
│       └── publish.yml         # CI/CD: Auto-deploy on push to master
├── .gitignore                  # Excludes node_modules and .wrangler/
├── README.md                   # User-facing documentation
├── AGENTS.md                   # This file - AI agent documentation
├── cspell.config.yaml          # Spell checker configuration
├── index.js                    # Main Cloudflare Worker code
├── package.json                # Node.js project manifest
├── package-lock.json           # Locked dependency versions
├── project-words.txt           # Custom dictionary for spell checker
└── wrangler.toml              # Cloudflare Worker configuration
```

## Key Files Explained

### index.js
The main application logic. Exports a default object with a `fetch` handler that:
- Handles GET requests to retrieve objects from the R2 bucket
- Returns 302 redirect to GitHub if no key is provided
- Returns 404 if object doesn't exist
- Returns 405 for non-GET methods
- Properly sets HTTP headers including ETag

### wrangler.toml
Cloudflare Worker configuration:
- Worker name: "public-bucket"
- Account ID: 9fbfc5a598619165478af4be82890d28
- R2 bucket binding: `PUBLIC_BUCKET` → `pkoch-public`
- Compatibility date: 2022-07-12

### package.json
Project configuration:
- No runtime dependencies (only devDependencies)
- Node.js v22.11+ required
- Scripts available: `dev`, `deploy`, `test` (not implemented)

## Development Workflow

### Local Development
```bash
npm run dev
```
This starts Wrangler in development mode with local emulation.

### Testing Local Changes
```bash
# Upload a test file to local R2
echo 'It worked on local!' | npx wrangler r2 object put pkoch-public/test.txt -p --local

# Access it via the local worker
curl http://localhost:8787/test.txt
```

### Deployment
Two methods:
1. **Automatic**: Push to `master` branch triggers GitHub Actions workflow
2. **Manual**: Run `npm run deploy`

The GitHub Actions workflow (`.github/workflows/publish.yml`) uses `cloudflare/wrangler-action@v3` with a `CF_API_TOKEN` secret.

## Working with the R2 Bucket

### Upload Files (AWS CLI)
```bash
AWS_PROFILE=r2 \
CF_ACCOUNT_ID=9fbfc5a598619165478af4be82890d28 \
aws s3 cp --endpoint-url "https://$CF_ACCOUNT_ID.r2.cloudflarestorage.com" file.txt s3://pkoch-public/file.txt
```

### Upload Files (Wrangler)
```bash
npx wrangler r2 object put pkoch-public/file.txt --file=file.txt
```

### Access Files (HTTP)
```bash
curl https://public-bucket.pkoch.workers.dev/file.txt
```

## Dependencies

**Production**: None - This is a pure Cloudflare Worker with no external runtime dependencies.

**Development**:
- `wrangler` (v4.46.0+) - Cloudflare's development and deployment tool

**Implicit/Platform**:
- Cloudflare Workers Runtime
- Cloudflare R2 API (accessed via `env.PUBLIC_BUCKET`)

## Testing

**Current Status**: No automated tests are implemented (`npm test` returns error).

**Manual Testing**: Test by uploading files to R2 and accessing them via HTTP.

## Code Quality Tools

### Spell Checking
- Tool: cspell
- Config: `cspell.config.yaml`
- Custom dictionary: `project-words.txt` (contains: pkoch, awscli)
- Ignores: package*.json

## Important Considerations for AI Agents

### Making Code Changes
1. **The Worker is Simple**: This is a minimal proxy to R2. Don't over-engineer it.
2. **No Breaking Changes**: The URL structure (`/{key}`) is part of the public API.
3. **Performance**: Workers have CPU time limits. Keep the code fast and simple.
4. **R2 API**: The worker uses `env.PUBLIC_BUCKET.get(key)` - this is the Cloudflare Workers R2 binding API.

### Deployment Notes
- Changes to `master` branch deploy automatically
- No staging environment is configured
- The same R2 bucket is used for both dev and production (see `wrangler.toml`)

### Security Considerations
- This is intentionally a PUBLIC bucket - no authentication
- GET-only access - writes must go through AWS CLI or Wrangler
- Account ID is public (visible in config files)
- API tokens are stored as GitHub secrets (CF_API_TOKEN)

### Common Tasks

**Adding a new HTTP method**: Edit the `switch (request.method)` statement in `index.js`.

**Changing R2 bucket**: Update `bucket_name` in `wrangler.toml`.

**Adding dependencies**: This worker intentionally has no runtime dependencies. If you need to add one, carefully consider the bundle size impact.

**Adding tests**: Create test files and update the `test` script in `package.json`. Consider using Miniflare or Wrangler's testing utilities.

### Gotchas
- The empty key (`/`) redirects to GitHub, not to a listing page
- No caching headers are explicitly set (R2 object metadata is used)
- No CORS configuration (uses default Cloudflare Workers behavior)
- The worker doesn't handle conditional requests (If-None-Match, etc.) - it just passes through the ETag

## Related Resources
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)
- [Wrangler Docs](https://developers.cloudflare.com/workers/wrangler/)

## Version History
- Current: v1.0.0
- Last major update: Wrangler dependency updates via Dependabot

---

**Last Updated**: 2025-11-08
**Maintained By**: Paulo Köch (hi@pko.ch)
