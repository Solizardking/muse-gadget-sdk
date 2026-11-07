/* SPDX-License-Identifier: Apache-2.0 */
#ifndef POCKET_PHONE_H
#define POCKET_PHONE_H

#include "pocket_wallet.h"

#include <stddef.h>

/*
 * Phone approval never holds a device signing key.
 * Both calls return false and pocket_try_sign clears any output buffer.
 */
bool pocket_try_sign(const pocket_wallet_t *state, unsigned char *out, size_t out_len);
bool pocket_try_submit(const pocket_wallet_t *state);

#endif
