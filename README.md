# pkoch's public bucket & link shortener

That sweet sweet free egress. ❤️

Now with JWT-authenticated link shortening!

## Features

- **Public file access**: Serve files from R2 bucket with free egress
- **Link shortener**: Create short URLs that redirect to any destination
- **JWT authentication**: Secure link management with JWKS-based authentication

## Getting files into the bucket with awscli

```bash
echo 'It worked!' > test.txt

AWS_PROFILE=r2 \
CF_ACCOUNT_ID=9fbfc5a598619165478af4be82890d28 \
aws s3 cp --endpoint-url "https://$CF_ACCOUNT_ID.r2.cloudflarestorage.com" test.txt s3://pkoch-public/test.txt
```

## Getting files into the bucket with wrangler

```bash
echo 'It worked!' > test.txt

npx wrangler r2 object put pkoch-public/test.txt --file=test.txt
```

## Get them back over HTTP

```bash
curl https://public-bucket.pkoch.workers.dev/test.txt
```

## Link Shortener API

### Configuration

Before using the link shortener, configure your JWKS endpoint in `wrangler.toml`:

```toml
[vars]
JWKS_URL = "https://your-auth-provider.com/.well-known/jwks.json"
JWT_ISSUER = "https://your-auth-provider.com/"
JWT_AUDIENCE = "public-bucket"
```

### Create a short link (authenticated)

```bash
curl -X POST https://public-bucket.pkoch.workers.dev/ \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "mylink",
    "url": "https://example.com/very/long/url"
  }'
```

Response:
```json
{
  "success": true,
  "key": "mylink",
  "url": "https://example.com/very/long/url"
}
```

### Update a short link (authenticated)

```bash
curl -X PUT https://public-bucket.pkoch.workers.dev/ \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "mylink",
    "url": "https://example.com/new/url"
  }'
```

### Delete a short link (authenticated)

```bash
curl -X DELETE https://public-bucket.pkoch.workers.dev/mylink \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Use a short link (public)

```bash
curl -L https://public-bucket.pkoch.workers.dev/mylink
```

This will redirect to the configured URL.

## Authentication

The service uses JWT (JSON Web Tokens) with JWKS (JSON Web Key Sets) for authentication:

1. **JWKS endpoint**: Configure the URL where your public keys are published
2. **JWT tokens**: Include a valid JWT in the `Authorization: Bearer <token>` header
3. **Token validation**: Tokens are verified for:
   - Valid signature (using JWKS)
   - Correct issuer (`iss` claim)
   - Correct audience (`aud` claim)
   - Not expired (`exp` claim)
   - Valid timing (`nbf` claim if present)

### JWT Token Requirements

Your JWT must include:
- `iss`: Matches the configured `JWT_ISSUER`
- `aud`: Matches the configured `JWT_AUDIENCE`
- `exp`: Expiration timestamp
- `sub`: Subject (user identifier)

## Dev

```bash
# Start local development server
npm run dev

# Test with local R2
echo 'It worked on local!' | npx wrangler r2 object put pkoch-public/test.txt -p --local

# Create local KV namespace for testing
npx wrangler kv:namespace create SHORT_LINKS --preview
```

## Deploy

Just push to master. Alternatively, run:

```bash
npm run deploy
```

### First-time setup

1. Create the KV namespace:
```bash
npx wrangler kv:namespace create SHORT_LINKS
npx wrangler kv:namespace create SHORT_LINKS --preview
```

2. Update `wrangler.toml` with the namespace IDs returned by the command above

3. Configure your JWKS URL and JWT settings in `wrangler.toml`
