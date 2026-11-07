# Muse inside Pocket Wallet

The firmware, Linux companion and web app call the Pocket Wallet backend with
a scoped device session. The backend calls Meta Model API with the existing
server credential. `META_API_KEY` is separate from the Muse Gadget SDK pairing
token; never copy it to a browser bundle, firmware overlay or companion config.

## Server configuration

`npm run api` reads `.env`, then `.env.local`. Existing process environment
variables take precedence. Use:

```dotenv
META_API_KEY=<configure privately on the backend>
META_MODEL=muse-spark-1.3
META_PROTOCOL=responses
VOICE_PROVIDER=meta
```

`MODEL_API_KEY` is an accepted alias when `META_API_KEY` is absent. Responses
and Muse Spark 1.3 are the defaults. Without an explicit `VOICE_PROVIDER`, a
configured Meta key selects Meta; otherwise the existing OpenRouter parser
is used. Meta failures are surfaced, never silently routed to another model.

## Three formats

All these routes require `Authorization: Bearer <device-session-token>`.
Send the native request JSON for the selected format. JSON replies and SSE
events keep the provider's wire shape, including usage, tool calls,
annotations and encrypted reasoning. The proxy does not execute custom tools.

| Pocket Wallet route | Meta endpoint | Structured output | Reasoning |
|---|---|---|---|
| `POST /api/gadget/meta/responses` | `/v1/responses` | `text.format` | `reasoning.effort` |
| `POST /api/gadget/meta/chat/completions` | `/v1/chat/completions` | `response_format` | `reasoning_effort` |
| `POST /api/gadget/meta/messages` | `/v1/messages` | `output_config.format` | `thinking` and `output_config.effort` |

`GET /api/gadget/meta/models` discovers the team's enabled models. Muse Spark
1.3, 1.2, 1.1 and the 1.3/1.2 Contributor variants are supported across all
three formats. Contributor selection explicitly permits training on prompts
and completions; Standard is the default.

Responses also accepts Muse Image and SAM requests. Muse Voice Transcribe is
listed in model discovery but needs a dedicated ASR integration; the current
microphone UI uses browser speech recognition. Muse Glimmer is self-hosted
and is not an API model installed by this integration.

`POST /api/gadget/meta/responses/input_tokens` and
`POST /api/gadget/meta/messages/count_tokens` accept their native request
formats and return exact input counts without generation. There is no local
Chat Completions count endpoint.

Output defaults to 4096 tokens, with a local limit of 16–16384 tokens. The
128 KiB JSON request limit also applies to inline media/history. Use public
media URLs for larger inputs. Generation/count routes allow 12 requests per
minute and two concurrent requests per device session. Streams abort when
the caller disconnects. Requests have a three-minute backend timeout.
Background jobs and the Files API are not exposed by this proxy.

## Conversation continuity

Responses defaults to `store:false` and requests encrypted reasoning for
Spark. Replay its complete `output` items in the next `input`, followed by
the next user turn. Preserve opaque reasoning and message `phase` values.
Alternatively, explicitly send `store:true`, then chain `previous_response_id`.
Stored IDs are restricted to their originating device session and are forgotten
on backend restart/session expiry. Do not combine a previous ID with encrypted
reasoning inclusion.

Messages is stateless. Replay the full assistant `content`, including
`thinking`/`redacted_thinking` blocks, in the next messages array. Chat
Completions replays messages but does not preserve private reasoning.
Tools, caching hints and valid structured-output settings pass through in
their native shape. Leave sampling unset unless needed.

## Web

The Ask Muse panel selects a Spark model, format and thinking depth. It keeps
conversation history only in page memory, resets it on model/format change or
disconnect, and displays token/cache usage. New conversation clears history.
The same model/format selection is sent to Ask Clawd's schema-constrained
voice command parser. Both features require wallet sign-in; neither signs or
executes trades. Exported companion config includes the selection.

## Linux companion

Add `muse_model` and `muse_protocol` to the private 0600 config. No provider key
belongs in that config. Commands:

```sh
pocket-wallet clawd.muse.models
pocket-wallet clawd.voice '{"transcript":"sell 0.01 SOL","protocol":"messages"}'
pocket-wallet clawd.muse '{"protocol":"responses","request":{"input":"Explain slippage","reasoning":{"effort":"low"}}}'
pocket-wallet clawd.muse.tokens '{"protocol":"messages","request":{"messages":[{"role":"user","content":"Explain slippage"}]}}'
```

`clawd.muse` returns complete JSON for caller-managed replay/tool loops.
For SSE, use the backend route directly. `scripts/prepare-linux-sdk.py`
registers these commands and model/format options in a fresh upstream SDK copy,
with a longer inference timeout. It never changes the reference checkout.

## Firmware component

`pocket_meta.h` provides model/format validation, catalog requests, voice
requests and single-turn inference/count request builders. JSON escaping and
fixed buffer limits protect command payloads. Use a worker task with enough
stack for the request and response buffers, preferably allocating those
buffers on the heap.

```c
pocket_meta_config_t config = {
    .protocol = POCKET_META_MESSAGES,
    .model = "muse-spark-1.3",
};
// Allocate request/response buffers on a worker task, not in an LVGL callback.
// pocket_meta_voice_request(&config, transcript, request);
// pocket_meta_send(backend_https_origin, scoped_device_token,
//                  request, response, response_capacity, &http_status);
```

Enable `CONFIG_MBEDTLS_CERTIFICATE_BUNDLE=y`. The ESP-IDF transport verifies
HTTPS and disallows redirects. It returns raw JSON for display parsing; check
the HTTP status before rendering a success. Firmware prompt builders are
single-turn; companion/backend requests support full replay. The board
display/touch port, event-loop wiring and real-device flashing remain pending.

## Verification and current provider limitation

Run `npm run check` for API tests, web build, companion tests and sanitized
firmware host tests. The existing credential successfully listed eight live
models on October 3, 2026. All three live inference formats and both token
count endpoints returned HTTP 402. The client reports that credits are
unavailable; successful generation and on-device operation are not verified.

The prepared Linux SDK passed 137 upstream tests. Live discovery also passed
through an authenticated device token and the Linux companion (eight models).
A 390×844 browser check passed with an ephemeral test wallet and mocked
inference: all formats, encrypted replay, input counts, Contributor disclosure,
and no horizontal overflow or browser errors. These mocks verify UI behavior,
not successful Meta inference. Evidence is in `.grok/verify-artifacts/muse-ui.json`
and `muse-mobile.png`. The browser output was checked against 25 configured
secrets; none appeared in the bundle.

Official references: [Responses](https://dev.meta.ai/docs/protocols/responses),
[Chat Completions](https://dev.meta.ai/docs/protocols/chat-completions),
[Messages](https://dev.meta.ai/docs/protocols/messages),
[models](https://dev.meta.ai/docs/models).
