/* SPDX-License-Identifier: Apache-2.0 */
#include "gadget_wallet.h"
#include "lcd_review.h"

#include <stdio.h>
#include <string.h>

static const char SEED_TEXT[] = "solana-gadget-kit-hw-wallet-seed";

static int show(const solana_confirmation_t *conf, uint64_t now_ms, const char *expected) {
    lcd_frame_t frame;
    char text[160];
    lcd_render(conf, now_ms, &frame);
    if (frame.width != 240 || frame.height != 240 || lcd_frame_text(&frame, text, sizeof text) != 0) {
        return -1;
    }
    if (strcmp(text, expected) != 0) {
        return -1;
    }
    printf("LCD %s\n", text);
    return 0;
}

int main(void) {
    gadget_wallet wallet;
    solana_confirmation_t conf;
    const uint64_t now_ms = 5000;
    if (show(NULL, now_ms, "240x240 HOME") != 0) {
        return 1;
    }
    if (gadget_wallet_keygen(&wallet, (const uint8_t *)SEED_TEXT) != 0 ||
        gadget_wallet_review(&wallet, now_ms, 10000, "transfer.sol", "0.01", "pay 0.01 SOL for 1 USDC") != 0) {
        return 1;
    }
    gadget_wallet_view(&wallet, &conf);
    if (show(&conf, now_ms, "240x240 REVIEW pay 0.01 SOL for 1 USDC") != 0) {
        return 1;
    }
    gadget_wallet_tick(&wallet, conf.expires_ms);
    gadget_wallet_view(&wallet, &conf);
    if (show(&conf, conf.expires_ms, "240x240 EXPIRED") != 0) {
        return 1;
    }
    if (gadget_wallet_review(&wallet, now_ms, 10000, "transfer.sol", "0.01", "pay 0.01 SOL for 1 USDC") != 0) {
        return 1;
    }
    gadget_wallet_cancel(&wallet, &conf);
    if (show(&conf, now_ms, "240x240 CANCELLED") != 0) {
        return 1;
    }
    printf("LCD frames=home,review,expired,cancelled size=240x240\n");
    gadget_wallet_wipe(&wallet);
    return 0;
}
