# Solana Mobile integration

Sources were discovered through the [complete official index](https://docs.solanamobile.com/llms.txt).
The browser registers `@solana-mobile/wallet-standard-mobile` once during
startup with app identity, authorization cache, mainnet chain and default
wallet-not-found handler. No server-side registration occurs.

The connect list uses **Use Installed Wallet** for MWA and directly calls its
Wallet Standard connect feature from the button. Message signing happens on
a separate explicit **Sign in** click, never from a useEffect or background
callback. Transaction signing likewise requires a user click. This avoids
background Android intent launches.

Seeker Connect is optionally registered with
`@solana-mobile/seeker-connect-wallet-standard`. Set a relay domain you are
authorized to use in `VITE_SEEKER_RELAY_DOMAIN`; no relay or agreement is chosen
for you. Wallet keys and Seed Vault custody remain in the wallet app.

SKR balances can appear as ordinary token balances. This release does not
implement SKR staking, .skr name resolution or Seeker Genesis Token eligibility.
Alchemy supports the standard RPC used for balances; the supplied Helius-only
getTokenAccountsByOwnerV2 sample is not assumed to work on Alchemy. If adding
SGT eligibility later, decode Token-2022 metadata/group extensions, exclude
zero balances, verify wallet ownership and return the mint address for claim
tracking. A user-agent string is not ownership proof.

[MWA installation](https://docs.solanamobile.com/get-started/web/installation)
· [UX guidelines](https://docs.solanamobile.com/get-started/web/ux-guidelines)
· [Seeker Connect](https://docs.solanamobile.com/solana-mobile-stack/seeker-connect-quickstart)

Real Android Chrome/MWA, Seeker Connect, iOS wallet-browser and Seed Vault
interaction remain required device checks. Browser testing used an ephemeral,
unfunded Wallet Standard test wallet; it does not prove real Android intents.
