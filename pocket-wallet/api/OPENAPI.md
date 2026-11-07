# Pocket Wallet API contract

Authenticated Meta inference, model discovery, streaming and input-token
counts are documented in [Muse integration](../docs/META.md). Voice accepts
optional `model` and `protocol` selections and returns a validated command
with `requires_review:true`.

Local base: `http://127.0.0.1:8787`. Browser development origin:
`http://localhost:5173`. Remote access requires a same-origin HTTPS reverse
proxy and matching `APP_ORIGIN`. These routes are local implementations;
they have not been deployed to Musebook's Worker.

All responses use `Cache-Control: no-store`. Errors have `{ "error": "…" }`.
All protected endpoints use `Authorization: Bearer <session-or-device-token>`.
Provider keys are never accepted from client input. Requests have a 128 KB
JSON limit and 120/minute/IP rate limit.

| Method / route (`/api/gadget` prefix) | Request | Response |
|---|---|---|
| GET `/status` (public) | — | Network, provider configured flags, supported capabilities |
| POST `/challenge` (public) | `{wallet}` | `{nonce,message,expires_at}`; five-minute challenge |
| POST `/device-auth` (public) | `{nonce,signature}`; base58 Ed25519 signature over exact UTF-8 challenge | `{device_token,wallet,expires_at,scopes}`; one-hour browser session |
| DELETE `/session` | — | `{ok:true}`; revoke current token |
| POST `/device-token` | `{}` | Separate one-hour companion token; cannot submit |
| GET `/portfolio` | — | `{wallet,sol,tokens,updated_at}`; token mint, amount, decimals, uiAmountString |
| GET `/chart` | `mint`, `tf=1h\|4h\|1d`, optional `format=jpeg\|png\|rgb565` | 240×240 baseline JPEG default; 115200 bytes big-endian RGB565 |
| POST `/quote` | `{input_mint,output_mint,amount,venue,slippage_bps}` | Quote ID, mints, in/out amounts, minimum_receive, fee fields and expiry |
| POST `/intent` | `{quote_id}` | `{intent_id,unsigned_tx,exact_terms,expires_at}`; consumes quote |
| POST `/submit` (browser sessions only) | `{intent_id,signed_tx}`; base64 | `{signature,status}`; confirmed for Jupiter, submitted for DFlow |
| POST `/rpc` | `{method,params,id?}` | JSON-RPC envelope; latest blockhash, block height, max five signature statuses only |
| POST `/voice` | `{transcript}` | `{transcript,intent,reply_text,requires_review:true}` |

`amount` is a positive uint64 **string in input-token base units**. For example
0.01 SOL is `"10000000"`. Slippage is an integer 1–300 bps. Quotes and intents
expire after 30 seconds. Use a new quote after expiry, cancellation or ambiguous
submission; check the receipt first to avoid an accidental second trade.

Both venues use assembled transactions returned at quote time. Jupiter V2
requires a funded taker account to return an executable transaction. DFlow
synchronous orders submit through RPC with preflight. Asynchronous DFlow
orders are not accepted. Device tokens cannot sign or submit.

The voice endpoint currently accepts text, including a browser speech transcript;
it does not accept Opus/WAV, perform server STT or return TTS audio.
