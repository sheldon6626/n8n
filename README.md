# n8n on Cloudflare Containers

This repository deploys the official n8n container behind a Cloudflare Worker at `n8n.now9888.com`.

## Required secrets

Set these as Wrangler secrets before the first production request:

```text
N8N_ENCRYPTION_KEY
DB_POSTGRESDB_HOST
DB_POSTGRESDB_PORT
DB_POSTGRESDB_DATABASE
DB_POSTGRESDB_USER
DB_POSTGRESDB_PASSWORD
```

The container filesystem is ephemeral, so PostgreSQL is required for durable n8n state.

Use a dedicated PostgreSQL database with a valid TLS certificate. Keep a backup of
`N8N_ENCRYPTION_KEY`: changing or losing it prevents decrypting existing credentials.
Secrets must be configured on the `n8n-now9888` Worker, not committed to this repository.

## Automatic deployment

Pushes to `main` run `.github/workflows/deploy.yml` on a Linux runner with Docker.
The repository requires GitHub Actions secrets `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID`. Cloudflare requires Workers Paid with Containers enabled.
The token needs Worker deployment, Durable Objects, Containers, registry and custom
domain permissions for the account and `now9888.com` zone.

Run `npm ci` and `npm run check` to validate the Worker locally. `npm run deploy`
also requires a running Docker daemon. The official n8n application runs in the
container; the npm project here is its Cloudflare entry point.

The singleton is checked every minute to keep scheduled workflows running without
browser traffic. The `standard-1` container incurs continuous running costs.
Container restarts may interrupt active executions. Files written to its local disk
and community packages installed through the UI do not survive replacement; bake
required packages into the image. Configure external task runners separately for
production workflows requiring Code nodes.

After database secrets are configured and deployment succeeds, create the owner
account immediately at `https://n8n.now9888.com/setup`.
