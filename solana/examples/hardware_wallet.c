/* SPDX-License-Identifier: Apache-2.0 */
#include "gadget_wallet.h"
#include "lcd_review.h"

#include <stdio.h>
#include <string.h>

static const char SEED_TEXT[] = "solana-gadget-kit-hw-wallet-seed";
_Static_assert(sizeof SEED_TEXT == 33, "seed is 32 bytes");

static void hex_encode(const uint8_t *bytes, size_t length, char *out) {
    static const char digits[] = "0123456789abcdef";
    size_t i;
    for (i = 0; i < length; i++) {
        out[i * 2] = digits[bytes[i] >> 4];
        out[i * 2 + 1] = digits[bytes[i] & 0x0f];
    }
    out[length * 2] = 0;
}

int main(void) {
    gadget_wallet wallet;
    solana_confirmation_t preview;
    solana_confirmation_t confirmed;
    lcd_frame_t frame;
    char screen[160];
    char signature_hex[129];
    uint8_t other[SOLANA_CONFIRM_PAYLOAD_MAX];
    uint8_t exported[64];
    const uint64_t now_ms = 1000;
    memset(exported, 0xa5, sizeof exported);
    if (gadget_wallet_keygen(&wallet, (const uint8_t *)SEED_TEXT) != 0) {
        return 1;
    }
    if (gadget_wallet_export_secret(&wallet, exported, sizeof exported) == 0) {
        return 1;
    }
    if (exported[0] != 0 || exported[sizeof exported - 1] != 0) {
        return 1;
    }
    if (gadget_wallet_review(&wallet, now_ms, 10000, "transfer.sol", "0.01", "transfer 0.01 SOL") != 0) {
        return 1;
    }
    if (gadget_wallet_confirm(&wallet, now_ms, 0, &preview) == 0 || preview.has_signature) {
        return 1;
    }
    lcd_render(&preview, now_ms, &frame);
    if (lcd_frame_text(&frame, screen, sizeof screen) != 0) {
        return 1;
    }
    if (gadget_wallet_confirm(&wallet, now_ms, 1, &confirmed) != 0 || !confirmed.has_signature) {
        return 1;
    }
    if (gadget_wallet_verify(confirmed.public_key, confirmed.payload, confirmed.payload_len,
                             confirmed.signature) != 0) {
        return 1;
    }
    memcpy(other, confirmed.payload, confirmed.payload_len);
    other[confirmed.payload_len - 1] ^= 0xff;
    if (gadget_wallet_verify(confirmed.public_key, other, confirmed.payload_len, confirmed.signature) == 0) {
        return 1;
    }
    hex_encode(confirmed.signature, 64, signature_hex);
    printf("secret_export=refused\n");
    printf("%s\n", screen);
    printf("WALLET signature=%s confirmed_verify=ok unconfirmed=refused\n", signature_hex);
    gadget_wallet_wipe(&wallet);
    return 0;
}
