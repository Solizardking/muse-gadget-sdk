/* SPDX-License-Identifier: Apache-2.0 */
#include "robotics_gate.h"

#include "gadget_wallet.h"

#include <string.h>

static void refuse(robotics_result_t *result, const char *reason) {
    memset(result, 0, sizeof(*result));
    memcpy(result->reason, reason, strlen(reason) + 1);
}

int robotics_apply(robotics_result_t *result, const solana_confirmation_t *conf,
                   const char *command_id, const char *motion, uint64_t now_ms) {
    uint8_t payload[SOLANA_CONFIRM_PAYLOAD_MAX];
    size_t payload_len = 0;
    if (!result) {
        return -1;
    }
    if (!conf || conf->state == SOLANA_CONFIRM_NONE) {
        refuse(result, "missing");
        return -1;
    }
    if (conf->state == SOLANA_CONFIRM_CANCELLED) {
        refuse(result, "cancelled");
        return -1;
    }
    if (conf->state == SOLANA_CONFIRM_EXPIRED ||
        ((conf->state == SOLANA_CONFIRM_PENDING || conf->state == SOLANA_CONFIRM_CONFIRMED) &&
         now_ms >= conf->expires_ms)) {
        refuse(result, "expired");
        return -1;
    }
    if (conf->state == SOLANA_CONFIRM_PENDING) {
        refuse(result, "unconfirmed");
        return -1;
    }
    if (conf->state != SOLANA_CONFIRM_CONFIRMED || !command_id || !motion) {
        refuse(result, "mismatch");
        return -1;
    }
    if (strcmp(conf->command_id, command_id) != 0 || strcmp(conf->motion, motion) != 0) {
        refuse(result, "mismatch");
        return -1;
    }
    if (solana_command_payload(command_id, motion, payload, sizeof payload, &payload_len) != 0 ||
        payload_len != conf->payload_len || memcmp(payload, conf->payload, payload_len) != 0) {
        refuse(result, "mismatch");
        return -1;
    }
    if (!conf->has_signature ||
        gadget_wallet_verify(conf->public_key, conf->payload, conf->payload_len, conf->signature) != 0) {
        refuse(result, "bad_signature");
        return -1;
    }
    memset(result, 0, sizeof(*result));
    memcpy(result->motion, motion, strlen(motion) + 1);
    memcpy(result->reason, "applied", 8);
    result->applied = 1;
    return 0;
}
