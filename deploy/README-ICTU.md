# CampuSphere ICTU Docker Deployment

CampuSphere is delivered to ICTU as one Docker application container. The
container runs the complete Node.js/Express backend and the server-rendered EJS,
CSS, JavaScript, map, PWA, and VR frontend. Supabase remains the external
PostgreSQL application-data and persistent-session service; no MySQL container
is part of this production profile.

## ICTU-provided infrastructure

- Public hostname: `campusphere.cspc.edu.ph`.
- TLS termination and an HTTPS reverse proxy on the same host as Docker.
- Proxy target: `http://127.0.0.1:3000`.
- Forward the original `Host`, client address, and
  `X-Forwarded-Proto: https`; the app runs with `TRUST_PROXY=1` so its Secure
  `__Host-` session cookie is accepted only through HTTPS.
- Permit outbound HTTPS from the application container to the privately
  supplied Supabase project API, Google OAuth endpoints, and the configured
  public Google Drive offline-map manifest/release URLs. User browsers also
  require HTTPS access to approved Cloudinary media and map sources.
- Keep the initial deployment to exactly one application replica. CampuSphere's
  non-Vercel Docker rate-limit counters are process-local; multi-replica hosting
  requires a separately reviewed shared rate-limit store.

## Secrets and configuration

Do not send or commit an operational environment file. Copy
`deploy/ictu.env.example` to a protected path outside the repository, replace
the placeholders there, restrict it to the deployment account, and exchange
the real values with ICTU through an approved private channel.

The Google Cloud OAuth web client must list this exact authorized redirect URI:

```text
https://campusphere.cspc.edu.ph/auth/callback
```

The Supabase migrations are already owner-applied. Deployment must not apply,
reapply, bootstrap, seed, or roll back any migration or application data.

## Validate, build, and start

Set `ENV_FILE` below to the protected environment file's absolute path. Never
print the rendered Compose configuration while it contains real values.

```bash
ENV_FILE=/secure/path/campusphere-ictu.env
docker compose --env-file "$ENV_FILE" -f docker-compose.production.yml config --quiet
docker compose --env-file "$ENV_FILE" -f docker-compose.production.yml build --pull app
docker compose --env-file "$ENV_FILE" -f docker-compose.production.yml up -d app
docker inspect --format '{{.State.Health.Status}}' campusphere-app
```

The expected final health value is `healthy`. The anonymous monitoring endpoint
is `GET /healthz`; it returns only `{"status":"ok"}` with `Cache-Control:
no-store`, creates no session cookie, and returns the application's existing
sanitized `503` response if the persistent session store is unavailable.

## Operations

```bash
# Current state
docker compose --env-file "$ENV_FILE" -f docker-compose.production.yml ps

# Sanitized application logs (keep access restricted)
docker compose --env-file "$ENV_FILE" -f docker-compose.production.yml logs --tail 200 app

# Stop without deleting images or any external data
docker compose --env-file "$ENV_FILE" -f docker-compose.production.yml down
```

Container logs go to standard output/error; ICTU should apply its normal log
collection, retention, alerting, and host-disk rotation policy. Monitor both the
container health status and HTTPS `GET /healthz` through the public proxy.

## Update and rollback

For each accepted source commit, set `IMAGE_TAG` to that commit's short Git SHA,
build the new image, and start it only after its local verification is green.
Retain the previous accepted image tag until the new release is accepted.

To roll back application code, set `IMAGE_TAG` back to the retained previous
image, then run:

```bash
docker compose --env-file "$ENV_FILE" -f docker-compose.production.yml up -d --no-build app
```

Application rollback does not authorize a database migration or data rollback.
Database recovery uses the owner-approved Supabase backup/restore process and
must be separately authorized. The database and approved external media need
their own backup and retention policies; they are not stored in the application
image.
