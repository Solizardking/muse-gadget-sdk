# Pocket Wallet on Railway

Canonical browser/device API origin: `https://wallet.musebook.trade`.
The companion setup page is `https://wallet.musebook.trade/pair`; both `/pair`
and `/pair/` serve its separate Vite entry. The dashboard links to the guide
and exports companion credentials through **Download companion config**.

The `musebook-pocket-wallet` Railway project runs the frontend and authenticated
API in one production service. The existing Cloudflare `agentwallet-proxy`
routes only `wallet.musebook.trade` to the Railway service. Other Musebook
hostnames and routes are unchanged.

| Resource | Value |
| --- | --- |
| Railway project | `5153f0c3-dde5-4f2b-a991-d7ee2de32038` |
| Production environment | `445baa79-97d8-4efd-92d1-fa7a47a13300` |
| Service | `wallet` / `1af4a1a2-bbea-4b65-99a7-60132090c31c` |
| Railway upstream | `https://wallet-production-b4b7.up.railway.app` |
| Health check | `/healthz`, 120 seconds |
| Container port | `8080`, injected as `PORT` |
| Region/replicas | `us-east4-eqdc4a`, one replica |
| Restart policy | `ON_FAILURE`, three retries |

Dashboard: <https://railway.com/project/5153f0c3-dde5-4f2b-a991-d7ee2de32038>.

## Runtime and credentials

`Dockerfile` builds the Vite frontend using Node 22 and installs the production
dependencies separately. The final image runs as the `node` user and contains
the API, built frontend, four public setup/security documents, production
dependencies, and chart fonts. The strict
Docker/Railway upload allowlists exclude `.env` files, local artifacts, and
firmware sources. The lockfile includes npm 10's optional WebSocket peer entries
so clean Linux installs work.

Runtime settings are `NODE_ENV=production`, `PORT=8080`,
`APP_ORIGIN=https://wallet.musebook.trade`, `TRUST_PROXY=1`,
`META_MODEL=muse-spark-1.3`, and `META_PROTOCOL=responses`.
Configured app credentials were transferred from the local approved environment
through stdin: `RPC_URL`, `ALCHEMY_API_KEY`, `JUPITER_API_KEY`, `DFLOW_API_KEY`,
`OPENROUTER_API_KEY`, `META_API_KEY`, and `SDK_TOKEN`. No credential files were
uploaded. `BIRDEYE_API_KEY` is absent, so chart requests require configuration.

`EDGE_PROXY_SECRET` is independently generated and stored as a secret on both
Railway and Cloudflare. The Worker overwrites incoming trust headers and forwards
Cloudflare's client IP. The API uses it for rate limits only after a constant-time
secret check; direct Railway requests use Railway's validated `X-Real-IP` header.
The proxy preserves browser Origin and authentication, bypasses caching, and
streams response bodies, including inference events.

Wallet sign-in always uses the canonical hostname/URI. Protected API calls need
a signed wallet session; device tokens cannot submit transactions. Sessions,
challenges, quotes, and reasoning ownership are in memory, so deployments or
restarts require fresh sign-in. Keep one replica until session state is shared.

## Redeploy

From this checkout, after the local build and API checks pass:

```sh
railway up --project 5153f0c3-dde5-4f2b-a991-d7ee2de32038 \
  --service 1af4a1a2-bbea-4b65-99a7-60132090c31c \
  --environment 445baa79-97d8-4efd-92d1-fa7a47a13300 --detach
```

Runtime credentials are already on Railway; do not upload `.env.local`.
Proxy source and preserved narrow route configuration live in
`cloudflare/wallet-proxy.mjs` and `cloudflare/wrangler.jsonc`:

```sh
wrangler deploy --config cloudflare/wrangler.jsonc --keep-vars
```

Keep the upstream URL and shared secret synchronized if the service changes.
Use the canonical hostname for browser testing; its exact Origin is authorized,
while the generated Railway hostname is the server's upstream address.

## Domain routing

The domain already had proxied Cloudflare DNS and two wallet-only Worker routes.
The prior Worker pointed to an unavailable E2B host. Updating that Worker routes
the existing HTTPS hostname to Railway without needing DNS-edit permission.
The current Wrangler authorization can manage Workers/routes but cannot edit DNS.

Railway also has `wallet.musebook.trade` attached for a future direct DNS cutover.
That separate Railway certificate remains pending while Cloudflare serves the
canonical hostname. A direct cutover requires a DNS-only CNAME `wallet` pointing
to `n24lnaoe.up.railway.app` and the ownership TXT value shown in the Railway
domain dashboard. Adjust the narrow Worker routes during such a cutover.
Direct DNS cutover is optional; the app already runs on Railway behind the
Cloudflare proxy.

## Verification

Deployment evidence is recorded in `.grok/verify-artifacts/railway-deployment.json`
and `wallet-live-verification.json`. The live verifier checks HTTPS health,
canonical-domain Ed25519 sign-in with an ephemeral unfunded account, protected
routes, session revocation, live portfolio/model catalog, all six supplied asset
hashes, built asset parity, mobile/desktop layouts, and saved theme behavior.
It never requests, signs, or submits a transaction.
Pairing page evidence is recorded separately in `pair-live-verification.json`,
including route/document boundaries, device tabs, responsive themes, command
copying, and backend status recovery.

The configured Meta account previously returned HTTP 402 for inference. The app
surfaces the provider's missing-credit message; model discovery can succeed
without inference credit. See the current live evidence for the latest result.
