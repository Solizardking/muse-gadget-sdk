# Verification — 2026-10-03

## Verified software

- `npm run check`: 10 API/provider tests, 7 Python companion tests, firmware
  confirmation state checks and Muse request-format C checks pass. C checks use
  warnings-as-errors and AddressSanitizer/UndefinedBehaviorSanitizer.
- `npm run build`: Vite production dashboard builds successfully.
- Prepared Muse Linux SDK: 137 upstream tests pass with the command extension.
- Alchemy live RPC: getBalance and getTokenAccountsByOwner for both SPL Token
  and Token-2022 pass. RPC credentials stay server-side.
- DFlow live order: 0.01 SOL → USDC returns a synchronous v0 unsigned
  transaction, integer output and minimum receive, and block-height expiry.
- Jupiter V2: live endpoint accepts the key and returns insufficient-funds
  rejection for an ephemeral unfunded taker. A funded executable order has not
  been tested.
- Browser: Wallet Standard test wallet connection, genuine Ed25519 challenge
  signing, live Alchemy balance loading, DFlow exact-terms review, unsigned
  intent preparation and cancellation pass. No signing/submission of a swap.
- Mobile viewport: 390×844, no horizontal overflow.
- Production dashboard at localhost:8790: zero browser console errors/warnings.
- `node --env-file=.env.local scripts/check-secrets.mjs`: no configured provider
  secrets found in the built dashboard.

The browser test wallet was generated solely for testing, was unfunded, and
was registered through Wallet Standard. This is not real MWA/Seed Vault proof.
Generated chart JPEG/RGB565 formats were checked with fixture candles; live
Birdeye charts are not yet proven.

## Outstanding

- `BIRDEYE_API_KEY` is missing from `.env.local`. `SDK_TOKEN` is configured for the Muse Gadget SDK; a configured token is not proof of successful pairing.
- No ESP-IDF v6.0.1 installation was available; no full 1.28-inch board port,
  firmware link/build, flash, boot log or physical touch/audio check.
- No real Muse BLE/Noise pairing, Pi service registration, Android Chrome/MWA,
  Seeker Connect relay or Seed Vault wallet test.
- No funded swap or on-chain receipt. Submission validation is tested against
  fixtures, while quotes and balances use live read-only providers.
- The dashboard and API are deployed on Railway at `https://wallet.musebook.trade`
  through the Cloudflare wallet proxy. Deployment evidence is recorded in
  `.grok/verify-artifacts/railway-deployment.json`.
- No device audio capture, Opus/WAV server STT or TTS playback.
- Local dependency audit: 17 upstream findings (13 high, 4 moderate), mostly
  inherited Solana/Mobile SDK toolchain dependencies. Sharp was upgraded to
  0.35.5. A release requires dependency review and real-device validation.

The checked-in firmware pin map corrects the initial PSRAM and audio wiring
assumptions. The portable review core does not prove the handheld is functional.

## SDK_TOKEN and environment cleanup

- `.env.local` organized into service sections: 108 unique keys; 26 duplicate
  entries removed. Effective values were preserved during deduplication.
- Removed trailing non-token annotation from SDK_TOKEN; its canonical Muse
  token now passes the unchanged upstream format validator.
- `SDK_TOKEN` is the preferred credential in prepared Linux SDK copies and
  helper commands; legacy GADGET_API_KEY remains supported.
- Prepared `build/esp32-pocket/sdkconfig` with the same token in
  CONFIG_GADGET_SDK_TOKEN, mode 0600 and parent mode 0700; both config and env
  file are ignored by Git. This is configuration, not a completed board build.
- Five helper security tests pass, synthetic token propagation passes and
  all 137 upstream Muse Linux tests pass with SDK_TOKEN support.
- The SDK child environment excludes unrelated provider and agent secrets.
- Live pairing cannot run on this macOS host: no USB serial devices were found
  and the Linux SDK needs a Linux BlueZ/D-Bus environment and Muse app pairing.
