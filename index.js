/**
 * JWT verification using JWKS
 */
async function verifyJWT(token, env) {
  try {
    // Fetch JWKS from the configured endpoint
    const jwksResponse = await fetch(env.JWKS_URL);
    if (!jwksResponse.ok) {
      throw new Error('Failed to fetch JWKS');
    }
    const jwks = await jwksResponse.json();

    // Parse JWT header to get kid (key ID)
    const [headerB64] = token.split('.');
    const header = JSON.parse(atob(headerB64.replace(/-/g, '+').replace(/_/g, '/')));

    // Find matching key in JWKS
    const key = jwks.keys.find(k => k.kid === header.kid);
    if (!key) {
      throw new Error('Key not found in JWKS');
    }

    // Import the public key
    const cryptoKey = await crypto.subtle.importKey(
      'jwk',
      key,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // Split JWT into parts
    const [headerPart, payloadPart, signaturePart] = token.split('.');
    const data = new TextEncoder().encode(`${headerPart}.${payloadPart}`);
    const signature = Uint8Array.from(atob(signaturePart.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

    // Verify signature
    const isValid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      signature,
      data
    );

    if (!isValid) {
      throw new Error('Invalid signature');
    }

    // Decode and validate payload
    const payload = JSON.parse(atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')));

    // Verify issuer
    if (payload.iss !== env.JWT_ISSUER) {
      throw new Error('Invalid issuer');
    }

    // Verify audience
    if (payload.aud !== env.JWT_AUDIENCE) {
      throw new Error('Invalid audience');
    }

    // Verify expiration
    if (payload.exp && payload.exp < Date.now() / 1000) {
      throw new Error('Token expired');
    }

    // Verify not before
    if (payload.nbf && payload.nbf > Date.now() / 1000) {
      throw new Error('Token not yet valid');
    }

    return payload;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

/**
 * Extract JWT from Authorization header
 */
function extractToken(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return null;
  }
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  return parts[1];
}

/**
 * Require authentication middleware
 */
async function requireAuth(request, env) {
  const token = extractToken(request);
  if (!token) {
    return new Response('Unauthorized: No token provided', { status: 401 });
  }

  const payload = await verifyJWT(token, env);
  if (!payload) {
    return new Response('Unauthorized: Invalid token', { status: 401 });
  }

  return payload;
}

export default {
	async fetch(request, env) {
      const url = new URL(request.url);
      const key = url.pathname.slice(1);

      switch (request.method) {
        case 'GET':
          if(key === '') {
            const source = "https://github.com/pkoch/pkoch-public-bucket";

            return new Response(
              "I need a key. Check the source at " + source + "\n",
              {
                status: 302,
                headers: {
                  Location: source,
                },
              });
          }

          // First, check if it's a short link
          if (env.SHORT_LINKS) {
            const shortLink = await env.SHORT_LINKS.get(key);
            if (shortLink) {
              try {
                const linkData = JSON.parse(shortLink);
                // Redirect to the target URL
                return new Response(null, {
                  status: 302,
                  headers: {
                    Location: linkData.url,
                  },
                });
              } catch (e) {
                console.error('Failed to parse short link data:', e);
              }
            }
          }

          // Fall back to R2 bucket access
          const object = await env.PUBLIC_BUCKET.get(key);
          if (!object || !object.body) {
            return new Response(`Object Not Found: ${key}`, { status: 404 });
          }

          const headers = new Headers();
          object.writeHttpMetadata(headers);
          headers.set('etag', object.httpEtag);

          return new Response(object.body, {headers});

        case 'POST':
          // Create a new short link
          if (!env.SHORT_LINKS) {
            return new Response('Short links not configured', { status: 503 });
          }

          const authResult = await requireAuth(request, env);
          if (authResult instanceof Response) {
            return authResult;
          }

          try {
            const body = await request.json();
            if (!body.key || !body.url) {
              return new Response('Missing required fields: key and url', { status: 400 });
            }

            // Check if key already exists
            const existing = await env.SHORT_LINKS.get(body.key);
            if (existing) {
              return new Response('Short link already exists', { status: 409 });
            }

            // Store the short link
            const linkData = {
              url: body.url,
              created: new Date().toISOString(),
              createdBy: authResult.sub || 'unknown',
            };
            await env.SHORT_LINKS.put(body.key, JSON.stringify(linkData));

            return new Response(JSON.stringify({ 
              success: true, 
              key: body.key,
              url: body.url,
            }), {
              status: 201,
              headers: {
                'Content-Type': 'application/json',
              },
            });
          } catch (error) {
            console.error('Error creating short link:', error);
            return new Response('Invalid request body', { status: 400 });
          }

        case 'PUT':
          // Update an existing short link
          if (!env.SHORT_LINKS) {
            return new Response('Short links not configured', { status: 503 });
          }

          const authResultPut = await requireAuth(request, env);
          if (authResultPut instanceof Response) {
            return authResultPut;
          }

          try {
            const bodyPut = await request.json();
            if (!bodyPut.key || !bodyPut.url) {
              return new Response('Missing required fields: key and url', { status: 400 });
            }

            // Check if key exists
            const existingPut = await env.SHORT_LINKS.get(bodyPut.key);
            if (!existingPut) {
              return new Response('Short link not found', { status: 404 });
            }

            // Update the short link
            const linkDataPut = {
              url: bodyPut.url,
              updated: new Date().toISOString(),
              updatedBy: authResultPut.sub || 'unknown',
            };
            await env.SHORT_LINKS.put(bodyPut.key, JSON.stringify(linkDataPut));

            return new Response(JSON.stringify({ 
              success: true, 
              key: bodyPut.key,
              url: bodyPut.url,
            }), {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
              },
            });
          } catch (error) {
            console.error('Error updating short link:', error);
            return new Response('Invalid request body', { status: 400 });
          }

        case 'DELETE':
          // Delete a short link
          if (!env.SHORT_LINKS) {
            return new Response('Short links not configured', { status: 503 });
          }

          const authResultDelete = await requireAuth(request, env);
          if (authResultDelete instanceof Response) {
            return authResultDelete;
          }

          if (!key) {
            return new Response('Missing key', { status: 400 });
          }

          // Check if key exists
          const existingDelete = await env.SHORT_LINKS.get(key);
          if (!existingDelete) {
            return new Response('Short link not found', { status: 404 });
          }

          // Delete the short link
          await env.SHORT_LINKS.delete(key);

          return new Response(JSON.stringify({ 
            success: true, 
            key: key,
          }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          });

        default:
          return new Response('Method Not Allowed', {
            status: 405,
            headers: {
              Allow: 'GET, POST, PUT, DELETE',
            },
          });
      }
  }
}
