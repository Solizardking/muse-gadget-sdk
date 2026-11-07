# Pairing and first use

1. Open [the pairing page](https://wallet.musebook.trade/pair), then open the
   wallet dashboard. For local development, start the API and dashboard and
   use `http://localhost:5173`.
2. Choose a Wallet Standard wallet. Android Chrome displays **Use Installed
   Wallet** for MWA; iOS requires a compatible wallet browser.
3. Press **Sign in to Pocket Wallet** and approve the displayed message. It
   authorizes reading balances and preparing transactions, not spending funds.
4. To configure a Pi, press **Download companion config**, install the companion
   config at `~/.config/pocket-wallet/config.toml`, and set permissions to 0600.
   Use the HTTPS API origin for a remote Pi. Tokens expire after one hour.
5. Separately install the prepared upstream Muse Linux SDK, supply its Gadget
   SDK token, enable Developer mode in the Muse app's Devices settings, and pair
   via BLE. Muse pairing credentials are separate from Pocket Wallet sessions.

The 1.28-inch ESP32 board requires a custom LCD/touch port before flashing.
There is no working handheld pairing build in this repository yet. No real
Pi/phone BLE pairing has been verified.

If a session expires, reconnect/sign in and download a fresh companion config.
If the wallet account changes, the browser clears its session and pending
review. If a quote expires, request a fresh one. If a submitted transaction
has an uncertain result, inspect wallet history before starting another.
