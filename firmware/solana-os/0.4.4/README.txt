Solana OS 0.4.4 for the Solana BP26 badge (ESP32-C5)

Built Oct 28 2026 12:59:08 with ESP-IDF v5.5.4, commit a5f7c13-dirty.
The /stock page of the badge site flashes these images from the browser.
This folder flashes them from a terminal with esptool, offline.


FILES

  0x2000    bootloader.bin           23,296 bytes
  0x8000    partition-table.bin       3,072 bytes
  0xf000    ota_data_initial.bin      8,192 bytes
  0x20000   solana_os.bin         1,933,568 bytes

  flash_args   The same list in ESP-IDF's format: esptool ... write-flash "@flash_args"
  SHA256SUMS   Their checksums: shasum -a 256 -c SHA256SUMS (macOS),
               sha256sum -c SHA256SUMS (Linux)


FLASH

1. Install esptool 5 while you're online, one of:
     pipx install esptool
     brew install esptool
     python3 -m pip install esptool      (in a virtual environment)
   or a standalone build from https://github.com/espressif/esptool/releases
   ESP-IDF 5.5's esptool 4 flashes too: type esptool.py and write_flash
   (the erase commands below need esptool 5).

2. Plug the badge in over USB-C and turn it on. Close any serial monitor:
   only one program can hold the port. The badge's port (a CH340):
     macOS     /dev/cu.usbserial-... (ls /dev/cu.usbserial-*)
     Linux     /dev/ttyUSB0 (you may need to be in the dialout group)
     Windows   COM3 or similar (Device Manager, Ports)

3. In this folder, with PORT replaced by the badge's port:

esptool --chip esp32c5 -p PORT -b 460800 --no-stub write-flash 0x2000 bootloader.bin 0x8000 partition-table.bin 0xf000 ota_data_initial.bin 0x20000 solana_os.bin

   It takes a minute or two. esptool checks each image after writing it,
   then restarts the badge into Solana OS. Wi-Fi, settings and the badge
   link stay. Keep 460800 baud: 921600 is unreliable on the CH340C.


ERASE (OPTIONAL, BEFORE STEP 3)

Erase settings: forget Wi-Fi, button calibration, theme and server address.
The badge says hello again with a new secret.

esptool --chip esp32c5 -p PORT --no-stub erase-region 0x9000 0x6000

Erase all data: also wipe the internal storage, like a new badge.

esptool --chip esp32c5 -p PORT --no-stub erase-region 0x9000 0x6000
esptool --chip esp32c5 -p PORT --no-stub erase-region 0x11000 0x1000
esptool --chip esp32c5 -p PORT --no-stub erase-region 0x820000 0x7e0000

The badge keeps its ID and stays linked to its owner either way: release it
on your badge page (/profile) to unlink it. The microSD card isn't touched.


IF IT WON'T CONNECT

Hold BOOT on the back of the badge, press RST, then release BOOT, and run
the command again.
