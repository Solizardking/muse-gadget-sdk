/* SPDX-License-Identifier: Apache-2.0 */
#ifndef GADGET_WALLET_H
#define GADGET_WALLET_H

#include "solana_confirm.h"

#include <stdalign.h>
#include <stddef.h>
#include <stdint.h>

#define GADGET_WALLET_STORAGE 1024

/* Opaque device wallet. The Ed25519 secret stays inside storage. */
typedef struct gadget_wallet {
    alignas(16) uint8_t storage[GADGET_WALLET_STORAGE];
} gadget_wallet;

/* seed is 32 bytes. The same seed yields the same public key and signatures. */
int gadget_wallet_keygen(gadget_wallet *wallet, const uint8_t seed[32]);
void gadget_wallet_wipe(gadget_wallet *wallet);

/* Always refuses. On failure the output buffer is cleared. */
int gadget_wallet_export_secret(const gadget_wallet *wallet, uint8_t *out, size_t out_len);

int gadget_wallet_public_key(const gadget_wallet *wallet, uint8_t out[32]);

/* Summarize the exact command. Does not sign. window_ms is clamped to 10s. */
int gadget_wallet_review(gadget_wallet *wallet, uint64_t now_ms, uint64_t window_ms,
                         const char *command_id, const char *motion, const char *summary);

void gadget_wallet_tick(gadget_wallet *wallet, uint64_t now_ms);

/* Signs only when physical_edge is set and now is inside the review window. */
int gadget_wallet_confirm(gadget_wallet *wallet, uint64_t now_ms, int physical_edge,
                          solana_confirmation_t *out);

void gadget_wallet_cancel(gadget_wallet *wallet, solana_confirmation_t *out);
void gadget_wallet_view(const gadget_wallet *wallet, solana_confirmation_t *out);

/* Detached verify. 0 when signature matches this payload, -1 otherwise. */
int gadget_wallet_verify(const uint8_t public_key[32], const uint8_t *payload,
                         size_t payload_len, const uint8_t signature[64]);

#endif
