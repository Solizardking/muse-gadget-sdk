# Security model

Private wallet keys stay in the user's installed wallet. The API and companion
hold session tokens and prepare unsigned transactions. Device tokens cannot
submit. Local key custody and automatic trading are not implemented.

Challenges bind domain, origin, mainnet, wallet, nonce and expiry and are consumed
once after Ed25519 verification. Browser sessions remain in memory and last one
hour. Companion configs must have mode 0600 and also expire after one hour.
Restarting the single-process API invalidates all sessions and reviews.

A quote is bound to the authenticated wallet, input amount, mints, slippage and
venue. Preparing an intent consumes the quote. Submission requires the exact
same serialized transaction message and a valid signature from that wallet.
The server locks an intent before sending and retains the lock if a provider
fails ambiguously. Never interpret a timeout as proof that nothing was sent.
Use the wallet history/receipt before considering a new trade.

Physical confirmation advances only to phone review, within ten seconds. A
remote request, voice command or Muse command cannot act as a physical press
and cannot grant spend authority. Do not add a private-key import screen.

`.env.local` is ignored and mode 0600. All provider credentials and RPC endpoint
URLs stay on the server. Error messages omit upstream bodies and credential
URLs. The client receives configured flags only. Do not configure secret keys
with VITE_ prefixes. `VITE_SEEKER_RELAY_DOMAIN` is public configuration.

The API binds to `0.0.0.0` for Railway and checks exact browser Origin on browser
requests. Use `HOST=127.0.0.1` for a loopback-only local server.
Production needs HTTPS, a matching APP_ORIGIN, trusted proxy/rate-limit settings,
and a shared atomic state store before multiple replicas. Device/API tokens
must be sent in headers, never chart URLs. The companion fetches chart bytes;
passing an authenticated chart URL to the upstream unauthenticated image
fetcher will not work.

The dependency audit currently reports upstream transitive findings in the
Solana/Mobile SDK toolchain. Review the recorded audit before release; do not
apply breaking SDK changes blindly. The dashboard has not yet been tested with
a real Android wallet, and the handheld has not been built or flashed.
