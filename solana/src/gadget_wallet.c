/* SPDX-License-Identifier: Apache-2.0 */
#include "gadget_wallet.h"

#include "tweetnacl.h"

#include <string.h>

extern int gadget_ed25519_seed_keypair(unsigned char *public_key, unsigned char *secret,
                                       const unsigned char *seed);

typedef struct wallet_inner {
    uint8_t secret[64];
    uint8_t public_key[32];
    int has_key;
    solana_confirmation_t live;
} wallet_inner;

_Static_assert(sizeof(wallet_inner) <= GADGET_WALLET_STORAGE, "wallet storage too small");
_Static_assert(alignof(wallet_inner) <= 16, "wallet storage alignment");

static void wipe(void *ptr, size_t length) {
    volatile uint8_t *bytes = ptr;
    while (length--) {
        *bytes++ = 0;
    }
}

static wallet_inner *inner_of(gadget_wallet *wallet) {
    return (wallet_inner *)wallet->storage;
}

static const wallet_inner *inner_of_const(const gadget_wallet *wallet) {
    return (const wallet_inner *)wallet->storage;
}

static int summary_ok(const char *summary) {
    size_t length;
    if (!summary || !summary[0]) {
        return 0;
    }
    length = strlen(summary);
    return length <= SOLANA_CONFIRM_SUMMARY_MAX;
}

int gadget_wallet_keygen(gadget_wallet *wallet, const uint8_t seed[32]) {
    wallet_inner *inner;
    if (!wallet || !seed) {
        return -1;
    }
    memset(wallet, 0, sizeof(*wallet));
    inner = inner_of(wallet);
    if (gadget_ed25519_seed_keypair(inner->public_key, inner->secret, seed) != 0) {
        wipe(inner->secret, sizeof inner->secret);
        return -1;
    }
    inner->has_key = 1;
    return 0;
}

void gadget_wallet_wipe(gadget_wallet *wallet) {
    if (!wallet) {
        return;
    }
    wipe(wallet->storage, sizeof wallet->storage);
}

int gadget_wallet_export_secret(const gadget_wallet *wallet, uint8_t *out, size_t out_len) {
    (void)wallet;
    if (out && out_len) {
        memset(out, 0, out_len);
    }
    return -1;
}

int gadget_wallet_public_key(const gadget_wallet *wallet, uint8_t out[32]) {
    const wallet_inner *inner;
    if (!wallet || !out) {
        return -1;
    }
    inner = inner_of_const(wallet);
    if (!inner->has_key) {
        return -1;
    }
    memcpy(out, inner->public_key, 32);
    return 0;
}

int gadget_wallet_review(gadget_wallet *wallet, uint64_t now_ms, uint64_t window_ms,
                         const char *command_id, const char *motion, const char *summary) {
    wallet_inner *inner;
    uint64_t window;
    size_t payload_len = 0;
    if (!wallet) {
        return -1;
    }
    inner = inner_of(wallet);
    if (!inner->has_key || window_ms == 0 || !summary_ok(summary)) {
        return -1;
    }
    window = window_ms > SOLANA_CONFIRM_WINDOW_MAX_MS ? SOLANA_CONFIRM_WINDOW_MAX_MS : window_ms;
    if (now_ms > UINT64_MAX - window) {
        return -1;
    }
    solana_confirmation_clear(&inner->live);
    if (solana_command_payload(command_id, motion, inner->live.payload,
                               sizeof inner->live.payload, &payload_len) != 0) {
        solana_confirmation_clear(&inner->live);
        return -1;
    }
    memcpy(inner->live.command_id, command_id, strlen(command_id) + 1);
    memcpy(inner->live.motion, motion, strlen(motion) + 1);
    memcpy(inner->live.summary, summary, strlen(summary) + 1);
    inner->live.payload_len = payload_len;
    inner->live.expires_ms = now_ms + window;
    memcpy(inner->live.public_key, inner->public_key, 32);
    inner->live.has_signature = 0;
    inner->live.state = SOLANA_CONFIRM_PENDING;
    return 0;
}

void gadget_wallet_tick(gadget_wallet *wallet, uint64_t now_ms) {
    wallet_inner *inner;
    if (!wallet) {
        return;
    }
    inner = inner_of(wallet);
    if ((inner->live.state == SOLANA_CONFIRM_PENDING ||
         inner->live.state == SOLANA_CONFIRM_CONFIRMED) &&
        now_ms >= inner->live.expires_ms) {
        inner->live.state = SOLANA_CONFIRM_EXPIRED;
        wipe(inner->live.signature, sizeof inner->live.signature);
        inner->live.has_signature = 0;
    }
}

static void publish(const wallet_inner *inner, solana_confirmation_t *out) {
    if (out) {
        *out = inner->live;
    }
}

int gadget_wallet_confirm(gadget_wallet *wallet, uint64_t now_ms, int physical_edge,
                          solana_confirmation_t *out) {
    wallet_inner *inner;
    unsigned char signed_message[64 + SOLANA_CONFIRM_PAYLOAD_MAX];
    unsigned long long signed_len = 0;
    if (!wallet) {
        return -1;
    }
    inner = inner_of(wallet);
    gadget_wallet_tick(wallet, now_ms);
    if (!physical_edge || inner->live.state != SOLANA_CONFIRM_PENDING || !inner->has_key) {
        publish(inner, out);
        return -1;
    }
    if (crypto_sign(signed_message, &signed_len, inner->live.payload, inner->live.payload_len,
                    inner->secret) != 0 ||
        signed_len != inner->live.payload_len + 64) {
        wipe(signed_message, sizeof signed_message);
        publish(inner, out);
        return -1;
    }
    memcpy(inner->live.signature, signed_message, 64);
    wipe(signed_message, sizeof signed_message);
    inner->live.has_signature = 1;
    inner->live.state = SOLANA_CONFIRM_CONFIRMED;
    publish(inner, out);
    return 0;
}

void gadget_wallet_cancel(gadget_wallet *wallet, solana_confirmation_t *out) {
    wallet_inner *inner;
    if (!wallet) {
        return;
    }
    inner = inner_of(wallet);
    inner->live.state = SOLANA_CONFIRM_CANCELLED;
    wipe(inner->live.signature, sizeof inner->live.signature);
    inner->live.has_signature = 0;
    publish(inner, out);
}

void gadget_wallet_view(const gadget_wallet *wallet, solana_confirmation_t *out) {
    if (!wallet || !out) {
        return;
    }
    *out = inner_of_const(wallet)->live;
}

int gadget_wallet_verify(const uint8_t public_key[32], const uint8_t *payload,
                         size_t payload_len, const uint8_t signature[64]) {
    unsigned char signed_message[64 + SOLANA_CONFIRM_PAYLOAD_MAX];
    unsigned char opened[64 + SOLANA_CONFIRM_PAYLOAD_MAX];
    unsigned long long opened_len = 0;
    int ok;
    if (!public_key || !payload || !signature || payload_len == 0 ||
        payload_len > SOLANA_CONFIRM_PAYLOAD_MAX) {
        return -1;
    }
    memcpy(signed_message, signature, 64);
    memcpy(signed_message + 64, payload, payload_len);
    ok = crypto_sign_open(opened, &opened_len, signed_message, payload_len + 64, public_key);
    wipe(signed_message, sizeof signed_message);
    if (ok != 0 || opened_len != payload_len || memcmp(opened, payload, payload_len) != 0) {
        wipe(opened, sizeof opened);
        return -1;
    }
    wipe(opened, sizeof opened);
    return 0;
}
