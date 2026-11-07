# Pocket Wallet — Hardware Bill of Materials

Research date: 2026-10-03 (revised for the 1.28" round-LCD board).
Shopping research only — nothing purchased. Prices are approximate USD and
change frequently.

| Item | Product | Price | URL | Notes (stock/compat) |
|---|---|---|---|---|
| 1. Main board | Waveshare ESP32-S3-Touch-LCD-1.28 — 1.28" round 240×240 capacitive touch LCD, ESP32-S3, 16MB flash, 2MB quad PSRAM, USB-C, MX1.25 battery header | ~$25 (verify on page) | https://a.co/d/06B0sv4H | ⚠️ Amazon blocks automated page checks — price/stock not confirmed, re-check at purchase time. This is the exact board for the build. |
| 2. Mic module | INMP441 I2S MEMS microphone module | ~$8 | https://www.amazon.com/dp/B0C1C64R8S | Required for voice input — the 1.28" board has no onboard mic. I2S wiring: proposed BCLK 15 / WS 16 / SD 17 + supply/GND; verify revision. |
| 3. Audio amp + speaker | Adafruit MAX98357A I2S 3W amp ($5.95) + small 4Ω speaker | ~$8 | https://www.adafruit.com/product/3006 | Required for voice output — the 1.28" board has no onboard speaker. proposed BCLK 15 / WS 16 / data 18; verify revision. |
| 4. Battery | 3.7V LiPo with MX1.25 2-pin plug (board's native header) | ~$8–10 | — | The board has a 3.7V MX1.25 charge header and USB-C charging. Get the MX1.25 plug variant — JST-PH will not fit without an adapter. |
| 5. USB-C cable | Short USB-C data cable (data-capable, not charge-only) | ~$8 | https://www.amazon.com/dp/B092M6XNQW | For flashing + charging. |
| 6. Pi companion (optional) | CanaKit Raspberry Pi 5 Starter Kit PRO (8GB) | ~$170 | https://www.amazon.com/dp/B0CRSNCJ6Y | Unlocks the full voice-trading brain, chart rendering, and transcript/quote orchestration. The standalone handheld software is not yet hardware-validated. |

## Build notes

- **Minimal handheld BOM:** board (~$25) + mic (~$8) + amp/speaker (~$8) + battery (~$9) + cable (~$8) ≈ **~$55–60**.
- **Full build with Pi hub:** ≈ **~$225–230**.
- **Firmware note:** the muse-gadget-sdk does not ship a stock overlay for the 1.28" round LCD — the firmware needs a custom board overlay (GC9A01 240×240 + touch). See `firmware/README.md`.
- Amazon pages could not be directly verified (Amazon 403s automated fetches). Prices for Amazon links are approximate and should be re-checked at purchase time.

Hardware facts: [Waveshare vendor reference](https://www.waveshare.com/wiki/ESP32-S3-Touch-LCD-1.28). The main board is ESP32-S3R2 with 2 MB quad PSRAM. GPIO 4–7 must not be used for the originally suggested audio wiring because onboard touch/I2C/IMU uses them. Full board port and electrical validation are pending.
