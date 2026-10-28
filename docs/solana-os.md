# Solana OS 0.4.4 for the Solana BP26 badge

Prebuilt firmware for the Solana BP26 badge (ESP32-C5, CH340 USB serial),
built Oct 28 2026 with ESP-IDF v5.5.4 at commit `a5f7c13-dirty`. The images
live in [`firmware/solana-os/0.4.4/`](../firmware/solana-os/0.4.4/) with
`flash_args`, `SHA256SUMS`, the bundle's `README.txt` and an ESP Web Tools
`manifest.json`.

| Offset    | File                   | Size            |
|-----------|------------------------|-----------------|
| `0x2000`  | `bootloader.bin`       | 23,296 bytes    |
| `0x8000`  | `partition-table.bin`  | 3,072 bytes     |
| `0xf000`  | `ota_data_initial.bin` | 8,192 bytes     |
| `0x20000` | `solana_os.bin`        | 1,933,568 bytes |

Flash settings: DIO, 80 MHz, 16 MB.

## Flash from a terminal (recommended)

1. Install esptool 5: `pipx install esptool`, `brew install esptool`, or
   `python3 -m pip install esptool` in a virtual environment.
2. Plug the badge in over USB-C, turn it on and close any serial monitor.
   Its port: macOS `/dev/cu.usbserial-*`, Linux `/dev/ttyUSB0` (you may need
   the `dialout` group), Windows `COM3` or similar.
3. Run:

   ```sh
   scripts/flash-solana-os.sh PORT                   # update, keeps everything
   scripts/flash-solana-os.sh PORT --erase-settings  # also forget Wi-Fi and settings
   scripts/flash-solana-os.sh PORT --erase-all       # clean badge
   ```

The script checks `SHA256SUMS` first, then runs
`esptool --chip esp32c5 -p PORT -b 460800 --no-stub write-flash ...` with the
offsets above. Keep 460800 baud: 921600 is unreliable on the CH340C.

- `--erase-settings` erases `0x9000 0x6000`: Wi-Fi, button calibration, theme
  and server address. The badge says hello again with a new secret.
- `--erase-all` also erases `0x11000 0x1000` and `0x820000 0x7e0000`, the
  internal storage, like a new badge.

Either way the badge keeps its ID and stays linked to its owner; release it
on your badge page (`/profile`) to unlink it. The microSD card isn't touched.

If it won't connect: hold BOOT on the back, press RST, release BOOT, and run
it again.

## Flash from the browser

The [web flasher](../web-flasher/) lists **Solana BP26 badge: Solana OS 0.4.4
(prebuilt)**. ESP Web Tools 10.4.0 (which the page already uses for the
ESP32-C5 DevKitC-1) supports the `ESP32-C5` chip family. It writes the four
images at their own offsets, so updates keep Wi-Fi, settings and the badge
link, but it doesn't erase settings or storage selectively, it chooses its own
serial speed and it uses the flasher stub, not `--no-stub`. If the browser
flash fails on the CH340, use the terminal script above or the badge site's
`/stock` page.

## Hand the badge off to a new owner

1. **Release it.** On your badge page (`/profile`), Release the badge. Or,
   with Wi-Fi on, use Factory reset in the badge's Settings (SELECT twice): it
   releases the badge and wipes it.
2. **Flash it (optional).** Choose Erase all data (`--erase-all`) for a clean
   badge. Without a release, the badge stays linked to its owner.
3. **Join Wi-Fi.** Turn the badge on, open Wi-Fi and SELECT a network. It
   rejoins that network at every boot when it is in range.
4. **Scan the new QR.** Open My Badge and scan its QR code with the new
   account's phone. The new owner gets their own welcome if they never had
   one.
