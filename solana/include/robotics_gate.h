/* SPDX-License-Identifier: Apache-2.0 */
#ifndef ROBOTICS_GATE_H
#define ROBOTICS_GATE_H

#include "solana_confirm.h"

#include <stdint.h>

typedef struct robotics_result {
    int applied;
    char motion[SOLANA_CONFIRM_MOTION_MAX + 1];
    char reason[16];
} robotics_result_t;

/*
 * Apply motion only when conf is a live signature over this exact command.
 * Otherwise applied stays 0 and reason is missing, unconfirmed, expired,
 * cancelled, mismatch, or bad_signature. Returns 0 when applied, -1 when refused.
 */
int robotics_apply(robotics_result_t *result, const solana_confirmation_t *conf,
                   const char *command_id, const char *motion, uint64_t now_ms);

#endif
