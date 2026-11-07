/* SPDX-License-Identifier: Apache-2.0 */
#include "pocket_phone.h"

#include <string.h>

bool pocket_try_sign(const pocket_wallet_t *state, unsigned char *out, size_t out_len) {
    if (out && out_len) {
        memset(out, 0, out_len);
    }
    /* HOME, REVIEW, PHONE, and EXPIRED are all phone-approval screens. None can sign. */
    if (!state) {
        return false;
    }
    switch (state->screen) {
    case POCKET_HOME:
    case POCKET_REVIEW:
    case POCKET_PHONE:
    case POCKET_EXPIRED:
        return false;
    }
    return false;
}

bool pocket_try_submit(const pocket_wallet_t *state) {
    if (!state) {
        return false;
    }
    switch (state->screen) {
    case POCKET_HOME:
    case POCKET_REVIEW:
    case POCKET_PHONE:
    case POCKET_EXPIRED:
        return false;
    }
    return false;
}
