# Pocket Wallet board port

Target: Waveshare ESP32-S3-Touch-LCD-1.28, **not** the 1.75-inch AMOLED.
Use the vendor-verified [board pin map](board-waveshare-s3-128.json), the supplied
upstream esp32/AGENTS.md and devices/AGENTS.md, and ESP-IDF v6.0.1.

The portable pocket_wallet component handles review state, physical edges,
expiry and cancellation. Full LVGL rendering, GC9A01A/CST816S board drivers,
network transport and device audio remain pending. This is not a flashable
board overlay. Do not copy the AMOLED BSP or octal PSRAM configuration.

Charts must use baseline JPEG or RGB565 to match upstream image_fetch.h.
Authentication is through a restricted companion token; provider secrets must
never enter ESP32 NVS. Voice is transcript-only until audio transport is built.
A physical press advances to phone review; signing stays in the phone wallet.
