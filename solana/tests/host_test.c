/* SPDX-License-Identifier: Apache-2.0 */
#include "gadget_wallet.h"
#include "lcd_review.h"
#include "pocket_phone.h"
#include "portfolio_preview.h"
#include "robotics_gate.h"
#include "sha256.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static const char SEED_TEXT[] = "solana-gadget-kit-hw-wallet-seed";
_Static_assert(sizeof SEED_TEXT == 33, "seed is 32 bytes");

static void expect(int condition, const char *name) {
    if (!condition) {
        fprintf(stderr, "FAIL %s\n", name);
        exit(1);
    }
    printf("PASS %s\n", name);
}

static int all_zero(const uint8_t *bytes, size_t length) {
    size_t i;
    for (i = 0; i < length; i++) {
        if (bytes[i] != 0) {
            return 0;
        }
    }
    return 1;
}

static int round_trip_units(const char *rendered, uint64_t base_units, int decimals) {
    unsigned long long whole = 0;
    unsigned long long fraction = 0;
    uint64_t scale = 1;
    int i;
    if (sscanf(rendered, "%llu.%llu", &whole, &fraction) != 2) {
        return 0;
    }
    for (i = 0; i < decimals; i++) {
        scale *= 10ull;
    }
    return (uint64_t)whole * scale + (uint64_t)fraction == base_units;
}

static void test_wallet(void) {
    gadget_wallet wallet;
    gadget_wallet again;
    solana_confirmation_t conf;
    solana_confirmation_t second;
    uint8_t exported[64];
    uint8_t public_key[32];
    uint8_t other_key[32];
    uint8_t other_payload[SOLANA_CONFIRM_PAYLOAD_MAX];
    const uint64_t now_ms = 1000;

    memset(exported, 0x5a, sizeof exported);
    expect(gadget_wallet_keygen(&wallet, (const uint8_t *)SEED_TEXT) == 0, "wallet_keygen");
    expect(gadget_wallet_export_secret(&wallet, exported, sizeof exported) != 0, "secret_export_refused");
    expect(all_zero(exported, sizeof exported), "secret_export_clears_buffer");
    expect(gadget_wallet_export_secret(&wallet, NULL, 0) != 0, "secret_export_null_refused");
    expect(gadget_wallet_public_key(&wallet, public_key) == 0, "public_key_available");
    expect(!all_zero(public_key, sizeof public_key), "public_key_not_blank");

    expect(gadget_wallet_review(&wallet, now_ms, 10000, "transfer.sol", "0.01", "transfer 0.01 SOL") == 0,
           "review_binds_command");
    expect(gadget_wallet_confirm(&wallet, now_ms, 0, &conf) != 0, "no_signature_before_confirm");
    expect(conf.state == SOLANA_CONFIRM_PENDING && conf.has_signature == 0, "pending_has_no_signature");
    expect(all_zero(conf.signature, sizeof conf.signature), "pending_signature_blank");

    gadget_wallet_tick(&wallet, now_ms + 10000);
    gadget_wallet_view(&wallet, &conf);
    expect(conf.state == SOLANA_CONFIRM_EXPIRED && conf.has_signature == 0, "no_signature_after_expiry");
    expect(gadget_wallet_confirm(&wallet, now_ms + 10000, 1, &conf) != 0, "confirm_after_expiry_refused");

    expect(gadget_wallet_review(&wallet, now_ms, 10000, "transfer.sol", "0.01", "transfer 0.01 SOL") == 0,
           "review_again");
    gadget_wallet_cancel(&wallet, &conf);
    expect(conf.state == SOLANA_CONFIRM_CANCELLED && conf.has_signature == 0, "no_signature_after_cancel");
    expect(gadget_wallet_confirm(&wallet, now_ms, 1, &conf) != 0, "confirm_after_cancel_refused");

    expect(gadget_wallet_review(&wallet, now_ms, 10000, "transfer.sol", "0.01", "transfer 0.01 SOL") == 0,
           "review_for_sign");
    expect(gadget_wallet_confirm(&wallet, now_ms + 10, 1, &conf) == 0, "physical_confirm_signs");
    expect(conf.has_signature == 1 && conf.state == SOLANA_CONFIRM_CONFIRMED, "confirmed_state");
    expect(gadget_wallet_verify(conf.public_key, conf.payload, conf.payload_len, conf.signature) == 0,
           "signature_verifies_confirmed_payload");
    memcpy(other_payload, conf.payload, conf.payload_len);
    other_payload[0] ^= 0xff;
    expect(gadget_wallet_verify(conf.public_key, other_payload, conf.payload_len, conf.signature) != 0,
           "signature_rejects_other_payload");

    expect(gadget_wallet_keygen(&again, (const uint8_t *)SEED_TEXT) == 0, "second_keygen");
    expect(gadget_wallet_public_key(&again, other_key) == 0 && memcmp(public_key, other_key, 32) == 0,
           "seed_is_deterministic");
    expect(gadget_wallet_review(&again, now_ms, 10000, "transfer.sol", "0.01", "transfer 0.01 SOL") == 0 &&
               gadget_wallet_confirm(&again, now_ms + 10, 1, &second) == 0,
           "second_confirm");
    expect(memcmp(conf.signature, second.signature, 64) == 0, "signature_is_deterministic");
    gadget_wallet_wipe(&wallet);
    gadget_wallet_wipe(&again);
}

static void test_lcd_and_robotics(void) {
    gadget_wallet wallet;
    solana_confirmation_t conf;
    solana_confirmation_t tampered;
    lcd_frame_t frame;
    char text[160];
    robotics_result_t result;
    const uint64_t now_ms = 2000;

    lcd_render(NULL, now_ms, &frame);
    expect(frame.width == 240 && frame.height == 240 && frame.screen == LCD_HOME, "lcd_home_size");
    expect(lcd_frame_text(&frame, text, sizeof text) == 0 && strcmp(text, "240x240 HOME") == 0, "lcd_home");

    expect(gadget_wallet_keygen(&wallet, (const uint8_t *)SEED_TEXT) == 0, "robotics_keygen");
    expect(gadget_wallet_review(&wallet, now_ms, 10000, "arm.nudge", "servo:15", "nudge servo 15") == 0,
           "robotics_review");
    gadget_wallet_view(&wallet, &conf);
    lcd_render(&conf, now_ms, &frame);
    expect(lcd_frame_text(&frame, text, sizeof text) == 0 &&
               strcmp(text, "240x240 REVIEW nudge servo 15") == 0,
           "lcd_review");
    expect(robotics_apply(&result, &conf, "arm.nudge", "servo:15", now_ms) != 0 &&
               result.applied == 0 && strcmp(result.reason, "unconfirmed") == 0,
           "robotics_refused_unconfirmed");

    expect(gadget_wallet_confirm(&wallet, now_ms + 1, 1, &conf) == 0, "robotics_confirm");
    expect(robotics_apply(&result, &conf, "arm.nudge", "servo:15", now_ms + 1) == 0 && result.applied == 1 &&
               strcmp(result.motion, "servo:15") == 0 && strcmp(result.reason, "applied") == 0,
           "robotics_applied_matching");
    expect(robotics_apply(&result, &conf, "arm.swing", "servo:90", now_ms + 1) != 0 && result.applied == 0 &&
               result.motion[0] == 0 && strcmp(result.reason, "mismatch") == 0,
           "robotics_refused_mismatch");
    expect(robotics_apply(&result, &conf, "arm.nudge", "servo:15", conf.expires_ms) != 0 &&
               strcmp(result.reason, "expired") == 0 && result.applied == 0,
           "robotics_refused_expired");
    tampered = conf;
    tampered.signature[0] ^= 0x01;
    expect(robotics_apply(&result, &tampered, "arm.nudge", "servo:15", now_ms + 1) != 0 &&
               strcmp(result.reason, "bad_signature") == 0 && result.applied == 0,
           "robotics_refused_bad_signature");

    gadget_wallet_tick(&wallet, conf.expires_ms);
    gadget_wallet_view(&wallet, &conf);
    lcd_render(&conf, conf.expires_ms, &frame);
    expect(lcd_frame_text(&frame, text, sizeof text) == 0 && strcmp(text, "240x240 EXPIRED") == 0, "lcd_expired");

    expect(gadget_wallet_review(&wallet, now_ms, 10000, "arm.nudge", "servo:15", "nudge servo 15") == 0,
           "review_before_cancel");
    gadget_wallet_cancel(&wallet, &conf);
    lcd_render(&conf, now_ms, &frame);
    expect(lcd_frame_text(&frame, text, sizeof text) == 0 && strcmp(text, "240x240 CANCELLED") == 0,
           "lcd_cancelled");
    expect(robotics_apply(&result, &conf, "arm.nudge", "servo:15", now_ms) != 0 &&
               strcmp(result.reason, "cancelled") == 0,
           "robotics_refused_cancelled");
    expect(robotics_apply(&result, NULL, "arm.nudge", "servo:15", now_ms) != 0 &&
               strcmp(result.reason, "missing") == 0 && result.applied == 0,
           "robotics_refused_missing");
    gadget_wallet_wipe(&wallet);
}

static void test_pocket_phone(void) {
    pocket_wallet_t state;
    unsigned char signature[64];
    pocket_init(&state);
    expect(state.screen == POCKET_HOME, "pocket_starts_home");
    expect(!pocket_press(&state, 0, true), "pocket_press_without_review");
    expect(pocket_review(&state, 1000, 50000, "id", "0.01 SOL", "1 USDC", "0.99 USDC", "DFlow"),
           "pocket_review");
    expect(!pocket_press(&state, 2000, false), "pocket_ignores_non_physical");
    expect(pocket_press(&state, 2000, true) && state.screen == POCKET_PHONE, "pocket_press_reaches_phone");
    memset(signature, 0xab, sizeof signature);
    expect(!pocket_try_sign(&state, signature, sizeof signature), "pocket_press_cannot_sign");
    expect(all_zero(signature, sizeof signature), "pocket_sign_writes_nothing");
    expect(!pocket_try_submit(&state), "pocket_press_cannot_submit");
    expect(!pocket_press(&state, 2001, true), "pocket_second_press_does_not_sign");
    pocket_tick(&state, 11000);
    expect(state.screen == POCKET_EXPIRED && !pocket_try_sign(&state, signature, sizeof signature),
           "pocket_expired_cannot_sign");
    pocket_cancel(&state);
    expect(state.screen == POCKET_HOME, "pocket_cancel_home");
}

static void test_portfolio_and_hash(void) {
    uint8_t digest[32];
    static const uint8_t empty_digest[32] = {
        0xe3, 0xb0, 0xc4, 0x42, 0x98, 0xfc, 0x1c, 0x14, 0x9a, 0xfb, 0xf4, 0xc8, 0x99, 0x6f, 0xb9, 0x24,
        0x27, 0xae, 0x41, 0xe4, 0x64, 0x9b, 0x93, 0x4c, 0xa4, 0x95, 0x99, 0x1b, 0x78, 0x52, 0xb8, 0x55};
    static const uint8_t abc_digest[32] = {
        0xba, 0x78, 0x16, 0xbf, 0x8f, 0x01, 0xcf, 0xea, 0x41, 0x41, 0x40, 0xde, 0x5d, 0xae, 0x22, 0x23,
        0xb0, 0x03, 0x61, 0xa3, 0x96, 0x17, 0x7a, 0x9c, 0xb4, 0x10, 0xff, 0x61, 0xf2, 0x00, 0x15, 0xad};
    char line[160];
    char sol[32];
    char usdc[32];
    char minimum[32];
    const portfolio_fixture_t *fixture = portfolio_preview_fixture();
    expect(sha256_buffer("", 0, digest) == 0 && memcmp(digest, empty_digest, 32) == 0, "sha256_empty");
    expect(sha256_buffer("abc", 3, digest) == 0 && memcmp(digest, abc_digest, 32) == 0, "sha256_abc");
    expect(portfolio_preview_line(line, sizeof line) == 0, "portfolio_line");
    expect(sscanf(line, "PORTFOLIO sol=%31s usdc=%31s quote_min_out=%31s", sol, usdc, minimum) == 3,
           "portfolio_fields");
    expect(round_trip_units(sol, fixture->sol.base_units, fixture->sol.decimals), "portfolio_sol_units");
    expect(round_trip_units(usdc, fixture->usdc.base_units, fixture->usdc.decimals), "portfolio_usdc_units");
    expect(round_trip_units(minimum, fixture->quote_min_out, fixture->quote_decimals), "portfolio_quote_units");
    expect(strstr(line, "venue=fixture") != NULL, "portfolio_venue_fixture");
}

int main(void) {
    test_wallet();
    test_lcd_and_robotics();
    test_pocket_phone();
    test_portfolio_and_hash();
    printf("host tests passed\n");
    return 0;
}
