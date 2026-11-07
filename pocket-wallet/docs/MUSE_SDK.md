# Muse Gadget SDK token and pairing

`SDK_TOKEN` is the canonical Muse Gadget SDK credential. The prepared Linux
SDK and helper also accept the old `GADGET_API_KEY` name, then the upstream
`MUSEGADGET_SDK_TOKEN` name. The first non-empty value wins. Each token must
match the upstream Muse gadget SDK token format. Provider API keys and wallet keys are
different credentials and stay on the backend.

Load the private environment file without putting tokens into shell history
or command arguments:

```sh
node --env-file=.env.local scripts/muse-sdk.mjs check
```

This validates configuration locally. It does not contact Muse or establish
a paired device session. The SDK token identifies the SDK owner; Muse app
pairing issues the separate device access/refresh credentials needed for a
Noise connection to the user's Muse VM.

## Linux companion

Prepare a fresh, isolated copy of the supplied SDK:

```sh
python3 scripts/prepare-linux-sdk.py --source ../muse-gadget-sdk/linux --output build/muse-linux-token
```

Place the supplied Muse Gadget SDK checkout beside Pocket Wallet, or adjust
`--source` to its Linux SDK directory. Preparation preserves upstream licenses and changes token environment
handling and command registration only. It excludes environment files,
device identity/pairing records and SDK token files from the copy. It never
changes `/Users/8bit/Untitled/linux`. Existing build copies must be prepared
again into a fresh output directory to pick up `SDK_TOKEN` support.

On a Linux Pi or computer, install BlueZ and distro `python3-dbus` and
`python3-gi`. Create a venv from system Python with system site packages and
install the prepared SDK and this companion into that same environment:

```sh
python3 -m venv --system-site-packages build/muse-linux-token/.venv
build/muse-linux-token/.venv/bin/pip install ./build/muse-linux-token ./linux
node --env-file=.env.local scripts/muse-sdk.mjs pair \
  --sdk build/muse-linux-token --python build/muse-linux-token/.venv/bin/python
```

The Linux SDK uses `/var/lib/musegadget` for private device state and needs
permission to access BlueZ over system D-Bus. Follow the prepared SDK's
installer and service instructions for production use. For a manual run,
use a Linux account with those permissions; do not copy unrelated provider
secrets to the Pi. `SDK_TOKEN` can be supplied through a private env file
containing only that value.

In the Muse app, open **Settings → Devices → Developer mode**, find the
`MuseGadgetXXXXXX` device and confirm pairing in the app. Linux uses app
confirmation; ESP32 devices require their local physical confirmation.
After pairing, start the connection loop:

```sh
node --env-file=.env.local scripts/muse-sdk.mjs run \
  --sdk build/muse-linux-token --python build/muse-linux-token/.venv/bin/python \
  --run-as your-linux-account
```

The helper passes the token in the SDK process environment, removes backend
provider keys from that child environment, and never prints the token.
The upstream executor restricts the environment of commands run by Muse.
The `run_as` account still needs its Pocket Wallet `config.toml` from the
dashboard, mode 0600, with a current scoped companion session. See
[Linux setup](../linux/README.md). A successful real connection reaches
`Noise session established` and `registered with the Muse` in the SDK log.

## ESP32 build configuration

Once a board port exists in an isolated firmware checkout, write the token
into that board's ignored, private build config:

```sh
node --env-file=.env.local scripts/muse-sdk.mjs firmware-config \
  --sdkconfig build/muse-esp32/build-waveshare-s3-128/sdkconfig
```

The helper replaces duplicate `CONFIG_GADGET_SDK_TOKEN` entries while
preserving other settings, makes the config mode 0600 and its directory mode
0700, and refuses paths outside this workspace's ignored `build*` directories.
Build using that same sdkconfig under ESP-IDF v6.0.1 with `umask 077`. Do not
copy the generated config or firmware artifacts into a public release: the
SDK token is compiled into the ESP32 firmware. Flash only the identified
board, capture a stable boot and finish phone-app BLE/Wi-Fi provisioning.

Pocket Wallet's Waveshare ESP32-S3-Touch-LCD-1.28 currently has a pin map and
portable review component, but still needs GC9A01A/CST816S board drivers,
network integration and a verified hardware build. The 1.75-inch AMOLED
profile is a different board. Configuring `SDK_TOKEN` does not complete
that port. See [firmware requirements](../firmware/README.md).
