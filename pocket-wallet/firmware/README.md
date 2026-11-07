# Pocket Wallet firmware

Muse Spark request builders and an ESP-IDF HTTPS backend transport live in
`components/pocket_wallet/pocket_meta.{h,c}`. They support Responses, Chat
Completions and Messages using a scoped device token. Provider credentials
remain on the backend. See [Muse integration](../docs/META.md) for setup,
model selection, firmware usage, tests and the current credits limitation.

Target hardware: Waveshare **ESP32-S3-Touch-LCD-1.28**, ESP32-S3R2, 16 MB
flash and **2 MB quad PSRAM**, 240×240 GC9A01A display and CST816S touch.
The board is not compatible with the upstream 1.75-inch AMOLED overlay.

The repository currently provides a portable confirmation component and a
vendor-verified board pin map. A full LCD/touch Muse SDK port and a board
build/flash have not been completed. Do not treat host tests as proof of a
working handheld.

## Confirmation component

Add `firmware/components/pocket_wallet` to an ESP-IDF v6.0.1 project's component
path. `pocket_review` validates fixed-size strings and opens a review for at
most ten seconds, bounded by the quote expiry. A local physical edge advances
to `POCKET_PHONE`; it never signs or sends a transaction. Expiry clears the
intent ID. A cancellation clears all pending state. Call `pocket_tick` from
the device event loop, using a monotonic clock.

```sh
python3 firmware/tests/test_state.py
```

The host test compiles C11 with warnings-as-errors, AddressSanitizer and
UndefinedBehaviorSanitizer; tests physical-edge requirements, expiry,
cancellation, repeated presses and string bounds.

## Board integration checklist

Use `/Users/8bit/Untitled/esp32/AGENTS.md` and `devices/AGENTS.md` as the build
and porting authority. Retain its BLE pairing, Noise, partition layout and
license notices. Configure your `SDK_TOKEN` as `CONFIG_GADGET_SDK_TOKEN`
in a private per-build sdkconfig. The [Muse SDK helper](../docs/MUSE_SDK.md)
loads it from the environment without printing it; `GADGET_API_KEY` remains a
backward-compatible fallback.

1. Start from the vendor GC9A01A/CST816S source and the checked-in
   [pin map](devices/board-waveshare-s3-128.json).
2. Add a dedicated Muse board implementation, Kconfig selection and component
   dependencies. Quad PSRAM is essential; do not use an R8 octal overlay.
3. Add the Pocket Wallet component to board UI event handling; supply display
   and touch callbacks, portfolio fetches and JPEG chart transport.
4. Build under ESP-IDF v6.0.1; check app slot size and run upstream host tests.
5. Flash only your exact board, capture a stable boot log, pair in the Muse app,
   then validate touch, Wi-Fi, audio and quote timeout on the hardware.

## Audio and power

The original GPIO 4/5/6/7 wiring was incorrect: those pins are used by touch,
I2C, IMU and MOSFET control. Proposed expansion wiring is BCLK 15, WS 16,
INMP441 data 17 and MAX98357A data 18, with appropriate supply and common ground.
Confirm the exact board revision, available pins and power budget before wiring.
Audio support has not been implemented or tested.

Use a compatible 3.7V battery and confirm the MX1.25 connector polarity from
the vendor schematic. The upstream Muse image path supports baseline JPEG or
big-endian RGB565, so `/api/gadget/chart` defaults to JPEG.
