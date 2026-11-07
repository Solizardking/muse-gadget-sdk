# Voice and Clawd

The browser supports typed commands and, when available, its speech-recognition
API. Microphone activation is a user click; unsupported browsers retain the
text field. Browser speech recognition may use the browser vendor's service.

Press **Help me prepare** to send the checked transcript to OpenRouter. Clawd
returns a draft intent and explanatory text. It cannot return a transaction,
sign anything or execute a trade. The UI only fills known SOL/USDC tokens;
unknown symbols need clarification. Buy commands require choosing the amount
of the input token to spend; an output-token quantity is never silently treated
as input spend.

Review token and amount, request a fresh live quote, check minimum receive and
fees, then approve in the installed wallet. Cancel or expiry discards the review.

The Linux `clawd.voice` command parses a supplied transcript. Device audio
capture, Muse audio STT transport, Opus/WAV API input and TTS playback are not
implemented. Audio keys/modules in the BOM do not imply tested voice hardware.
