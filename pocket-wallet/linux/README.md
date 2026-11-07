# Pocket Wallet Linux companion

Muse model selection and all three API formats are available through
`clawd.muse`, `clawd.muse.models` and `clawd.muse.tokens`; `clawd.voice` uses
the selected model/format. See [Muse integration](../docs/META.md).

Python 3.11+ companion commands, integrated into the supplied Muse Linux SDK.
It uses server-issued device tokens and never stores or signs with wallet keys.

## Install and configure

```sh
python3 -m venv .venv
. .venv/bin/activate
pip install ./linux
mkdir -p ~/.config/pocket-wallet
```

In the dashboard, connect your wallet, sign in, then press **Download companion config**. Move the downloaded `config.toml` to
`~/.config/pocket-wallet/config.toml` on the Pi and run:

```sh
chmod 600 ~/.config/pocket-wallet/config.toml
pocket-wallet clawd.status
pocket-wallet clawd.portfolio
```

The token expires in one hour. Download a fresh config when it expires. For a
remote Pi use your same-origin HTTPS deployment URL, not localhost on your
computer. The default localhost URL refers to the Pi itself.

## Register with Muse

Prepare a separate SDK copy; your reference checkout is not modified:

```sh
python3 scripts/prepare-linux-sdk.py --source /Users/8bit/Untitled/linux --output build/muse-linux
```

Install the prepared Muse SDK according to its own README, including Linux
BlueZ, distro `dbus`/`gi`, a system Python venv with system site packages and a
Muse gadget SDK token. Install this companion into the **same Python environment**.
The SDK's configured `run_as` account needs its own 0600 config at the path
above. Restart the Muse SDK service to register commands. Pair through the
Muse app: Settings → Devices → Developer mode.

| Command | Result |
|---|---|
| `clawd.status` | Provider availability and supported features |
| `clawd.portfolio` | Linked wallet SOL and SPL Token/Token-2022 balances |
| `clawd.quote` / `clawd.buy` / `clawd.sell` | Read-only quote, with exact input base units and minimum output |
| `clawd.chart` | Base64 240×240 baseline JPEG |
| `clawd.voice` | Parsed transcript; requires browser review |

Example:

```sh
pocket-wallet clawd.quote '{"input_mint":"So11111111111111111111111111111111111111112","output_mint":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v","amount":"10000000","venue":"dflow"}'
```

A quote is not execution permission. Complete a fresh review in the phone
browser. There is no automatic ESP32 transport or audio capture in this
companion yet. Muse pairing on a real Pi has not been tested.

```sh
python3 -m unittest discover -s linux/tests
uv run --project build/muse-linux --with pytest --with ./linux pytest build/muse-linux/tests -q
```
