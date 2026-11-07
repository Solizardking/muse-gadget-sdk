/* SPDX-License-Identifier: Apache-2.0 */
#pragma once
#include <stdbool.h>
#include <stdint.h>
#include <stddef.h>
typedef enum { POCKET_HOME, POCKET_REVIEW, POCKET_PHONE, POCKET_EXPIRED } pocket_screen_t;
typedef struct {
    pocket_screen_t screen;
    uint64_t expires_ms;
    char intent_id[65];
    char pay[49], receive[49], minimum[49], venue[25];
} pocket_wallet_t;
void pocket_init(pocket_wallet_t *state);
bool pocket_review(pocket_wallet_t *state, uint64_t now_ms, uint64_t quote_expires_ms,
                   const char *intent_id, const char *pay, const char *receive,
                   const char *minimum, const char *venue);
void pocket_tick(pocket_wallet_t *state, uint64_t now_ms);
/* A local physical edge advances to phone review only. It cannot sign or submit. */
bool pocket_press(pocket_wallet_t *state, uint64_t now_ms, bool physical_edge);
void pocket_cancel(pocket_wallet_t *state);
