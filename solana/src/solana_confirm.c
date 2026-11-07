/* SPDX-License-Identifier: Apache-2.0 */
#include "solana_confirm.h"

#include <string.h>

void solana_confirmation_clear(solana_confirmation_t *item) {
    if (!item) {
        return;
    }
    memset(item, 0, sizeof(*item));
}

static int field_ok(const char *text, size_t max_len) {
    size_t length;
    if (!text || !text[0]) {
        return 0;
    }
    length = strlen(text);
    if (length > max_len || memchr(text, 0x1f, length)) {
        return 0;
    }
    return 1;
}

int solana_command_payload(const char *command_id, const char *motion,
                           uint8_t *out, size_t cap, size_t *out_len) {
    size_t id_len;
    size_t motion_len;
    size_t total;
    if (!field_ok(command_id, SOLANA_CONFIRM_ID_MAX) ||
        !field_ok(motion, SOLANA_CONFIRM_MOTION_MAX) || !out || !out_len) {
        return -1;
    }
    id_len = strlen(command_id);
    motion_len = strlen(motion);
    total = id_len + 1 + motion_len;
    if (cap < total || total > SOLANA_CONFIRM_PAYLOAD_MAX) {
        return -1;
    }
    memcpy(out, command_id, id_len);
    out[id_len] = 0x1f;
    memcpy(out + id_len + 1, motion, motion_len);
    *out_len = total;
    return 0;
}
