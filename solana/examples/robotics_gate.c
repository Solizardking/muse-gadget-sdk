/* SPDX-License-Identifier: Apache-2.0 */
#include "gadget_wallet.h"
#include "robotics_gate.h"

#include <stdio.h>
#include <string.h>

static const char SEED_TEXT[] = "solana-gadget-kit-hw-wallet-seed";

static int expect_reason(const robotics_result_t *result, int applied, const char *reason) {
    return result->applied == applied && strcmp(result->reason, reason) == 0;
}

int main(void) {
    gadget_wallet wallet;
    solana_confirmation_t pending;
    solana_confirmation_t confirmed;
    solana_confirmation_t cancelled;
    robotics_result_t result;
    const uint64_t now_ms = 1000;
    if (gadget_wallet_keygen(&wallet, (const uint8_t *)SEED_TEXT) != 0) {
        return 1;
    }
    if (gadget_wallet_review(&wallet, now_ms, 10000, "arm.nudge", "servo:15", "nudge servo 15") != 0) {
        return 1;
    }
    gadget_wallet_view(&wallet, &pending);
    if (robotics_apply(&result, &pending, "arm.nudge", "servo:15", now_ms + 1) == 0 ||
        !expect_reason(&result, 0, "unconfirmed")) {
        return 1;
    }
    if (gadget_wallet_confirm(&wallet, now_ms + 500, 1, &confirmed) != 0) {
        return 1;
    }
    if (robotics_apply(&result, &confirmed, "arm.nudge", "servo:15", now_ms + 500) != 0 ||
        !expect_reason(&result, 1, "applied") || strcmp(result.motion, "servo:15") != 0) {
        return 1;
    }
    if (robotics_apply(&result, &confirmed, "arm.swing", "servo:15", now_ms + 500) == 0 ||
        !expect_reason(&result, 0, "mismatch") || result.motion[0] != 0) {
        return 1;
    }
    if (robotics_apply(&result, &confirmed, "arm.nudge", "servo:15", confirmed.expires_ms) == 0 ||
        !expect_reason(&result, 0, "expired")) {
        return 1;
    }
    if (gadget_wallet_review(&wallet, now_ms, 10000, "arm.nudge", "servo:15", "nudge servo 15") != 0) {
        return 1;
    }
    gadget_wallet_cancel(&wallet, &cancelled);
    if (robotics_apply(&result, &cancelled, "arm.nudge", "servo:15", now_ms) == 0 ||
        !expect_reason(&result, 0, "cancelled")) {
        return 1;
    }
    if (robotics_apply(&result, NULL, "arm.nudge", "servo:15", now_ms) == 0 ||
        !expect_reason(&result, 0, "missing")) {
        return 1;
    }
    printf("ROBOTICS match=applied mismatch=refused expired=refused cancelled=refused missing=refused\n");
    gadget_wallet_wipe(&wallet);
    return 0;
}
