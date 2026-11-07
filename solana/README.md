# Solana examples

The public home is [hardware.musebook.trade](https://hardware.musebook.trade).
Source is [github.com/themusebook/solana-gadget-kit](https://github.com/themusebook/solana-gadget-kit).
The offline 240×240 review page is [dashboard/index.html](dashboard/index.html).
These host programs do not flash a board, open a network connection, or read a provider key.

The ESP32 starting point is the Muse round-LCD gadget SDK. These programs are
the part you can run on a computer:

| Program | What it does |
|---|---|
| `hardware_wallet` | On-device wallet. Refuses to export the secret, shows the 240×240 review line, and signs only after a physical confirm. |
| `lcd_status` | Drives the 240×240 surface through home, review summary, expired, and cancelled. |
| `robotics_gate` | Applies `servo:15` only for a matching Solana confirmation. Mismatch, expiry, cancel, and a missing confirmation are refused. |
| `solana_os_check` | Checks the Solana OS 0.4.4 bundle in `firmware/solana-os/0.4.4` against `SHA256SUMS`. |
| `portfolio_preview` | Renders a fixed SOL/USDC quote preview. 10000000 lamports, 2500000 USDC base units, minimum out 980000. |

Pocket Wallet in [`../pocket-wallet`](../pocket-wallet/README.md) is included
as the phone-approval gadget. Its physical press moves the screen to phone
review and cannot sign or submit. The home lists every included surface: web,
API, firmware, Linux companion, Cloudflare proxy, scripts, docs, CI, and the
container files.

[`../scripts/flash-solana-os.sh`](../scripts/flash-solana-os.sh) flashes Solana
OS 0.4.4 onto a BP26 badge after checking `SHA256SUMS`.
[`../skills`](../skills/CATALOG.md) is the community device catalog: 44
Markdown skills. Those skills are not official Muse product integrations.

The device trees sit beside this directory.
[`../esp32`](../esp32/README.md) is the ESP32 Device SDK.
[`../linux`](../linux/README.md) is the Linux Device SDK.
[`../android/musegadgetstest`](../android/musegadgetstest/README.md) and
[`../ios/musegadgetstest`](../ios/musegadgetstest/README.md) are the phone
test apps that stream video to a gadget display.
[`../firmware/solana-os/0.4.4`](../firmware/solana-os/0.4.4/README.txt) holds
the prebuilt BP26 images, and [`../docs/solana-os.md`](../docs/solana-os.md)
is the flash note.

[`../web-flasher`](../web-flasher/README.md) is the browser installer:
`index.html`, `boards.json`, `flasher-hooks.js`, `paced-serial.js`,
`sdk-token.js`, and `make_manifest.py`. The root documents are
[`../README.md`](../README.md), [`../LICENSE`](../LICENSE),
[`../CONTRIBUTING.md`](../CONTRIBUTING.md),
[`../CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md), and
[`../.gitignore`](../.gitignore).

## Build and run

From the repository root:

```sh
make -C solana test examples
./solana/build/hardware_wallet
./solana/build/robotics_gate
./solana/build/solana_os_check
./solana/build/lcd_status
./solana/build/portfolio_preview
```

`make -C solana pocket-firmware` also runs the vendored Pocket Wallet
confirmation tests. The public demonstration seed is the 32-byte string
`solana-gadget-kit-hw-wallet-seed`. It is not a funded key. Ed25519 signatures
for that seed and the same payload match across runs.

Primary lines:

```text
WALLET signature=<128 hex chars> confirmed_verify=ok unconfirmed=refused
ROBOTICS match=applied mismatch=refused expired=refused cancelled=refused missing=refused
SOLANA_OS 0.4.4 checksums=ok files=4
PORTFOLIO sol=0.010000000 usdc=2.500000 quote_min_out=0.980000 venue=fixture
LCD frames=home,review,expired,cancelled size=240x240
```

The hardware-wallet signature is deterministic. A different payload does not
verify. The robotics actuator records `servo:15` only for command `arm.nudge`
while the confirmation is still inside its window.
