/* SPDX-License-Identifier: Apache-2.0 */
#ifndef SOLANA_CONFIRM_H
#define SOLANA_CONFIRM_H

#include <stddef.h>
#include <stdint.h>

#define SOLANA_CONFIRM_ID_MAX 64
#define SOLANA_CONFIRM_MOTION_MAX 63
#define SOLANA_CONFIRM_SUMMARY_MAX 95
#define SOLANA_CONFIRM_PAYLOAD_MAX 240
#define SOLANA_CONFIRM_WINDOW_MAX_MS 10000ull

typedef enum {
    SOLANA_CONFIRM_NONE = 0,
    SOLANA_CONFIRM_PENDING = 1,
    SOLANA_CONFIRM_CONFIRMED = 2,
    SOLANA_CONFIRM_EXPIRED = 3,
    SOLANA_CONFIRM_CANCELLED = 4
} solana_confirm_state_t;

/* Exact command bound to a Solana confirmation. The secret never lives here. */
typedef struct solana_confirmation {
    solana_confirm_state_t state;
    char command_id[SOLANA_CONFIRM_ID_MAX + 1];
    char motion[SOLANA_CONFIRM_MOTION_MAX + 1];
    char summary[SOLANA_CONFIRM_SUMMARY_MAX + 1];
    uint8_t payload[SOLANA_CONFIRM_PAYLOAD_MAX];
    size_t payload_len;
    uint64_t expires_ms;
    uint8_t signature[64];
    uint8_t public_key[32];
    int has_signature;
} solana_confirmation_t;

void solana_confirmation_clear(solana_confirmation_t *item);

/* Canonical payload is command_id, 0x1f, motion. One builder for sign and admit. */
int solana_command_payload(const char *command_id, const char *motion,
                           uint8_t *out, size_t cap, size_t *out_len);

#endif
