# Pocket Wallet brand theme

The app uses all six original images from the supplied Musebook `public/brand`
directory. The copies in `web/public/brand` are unchanged and match the source
SHA256 hashes recorded in [the asset manifest](../web/public/brand/manifest.json).

| Asset | Use |
|---|---|
| `clawd-builder-160.webp` | Header, wallet app identity, favicon, Clawd cards and footer |
| `clawd-builder-320.webp` | Retina assistant avatar, responsive header icon and touch icon |
| `clawd-mascot-dark.png` | Dark theme hero artwork |
| `clawd-mascot-source.png` | Light theme hero artwork |
| `solana/solanaGradient.jpg` | Solana wallet accent surface |
| `solana/solanaGradientDark.png` | Footer gradient strip |

Dark mode uses a near-black background, coral controls and purple/green
accents. Light mode uses warm white surfaces and the original white-background
mascot. The header toggle stores the selected mode locally and updates the
browser theme color. Images retain their proportions; the source directory
is untouched. The Solana assets are decorative gradients, not wordmarks.

Full Sharp decoding and source hash checks passed for all six images. Browser
checks verified HTTP 200/image content types, decoding, theme switching and
persistence, and no overflow at 320, 390, 768 and 1440 pixels. Evidence and
screenshots are in `.grok/verify-artifacts/pocket-brand-*`.

[Firmware theme references](../firmware/devices/brand-theme.json) describe the
240×240 palette and asset placement. This is a design reference; no board
image payload or hardware flash was produced by the theme work.
