/* SPDX-License-Identifier: Apache-2.0 */
#ifndef SOLANA_SHA256_H
#define SOLANA_SHA256_H

#include <stddef.h>
#include <stdint.h>

typedef struct sha256_ctx {
    uint32_t state[8];
    uint64_t bitlen;
    uint8_t data[64];
    uint32_t datalen;
} sha256_ctx;

void sha256_init(sha256_ctx *ctx);
void sha256_update(sha256_ctx *ctx, const void *data, size_t len);
void sha256_final(sha256_ctx *ctx, uint8_t out[32]);
int sha256_buffer(const void *data, size_t len, uint8_t out[32]);
int sha256_file(const char *path, uint8_t out[32]);

#endif
