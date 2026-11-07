/* SPDX-License-Identifier: Apache-2.0 */
#ifndef PORTFOLIO_PREVIEW_H
#define PORTFOLIO_PREVIEW_H

#include <stddef.h>
#include <stdint.h>

typedef struct portfolio_holding {
    const char *symbol;
    uint64_t base_units;
    int decimals;
} portfolio_holding_t;

typedef struct portfolio_fixture {
    portfolio_holding_t sol;
    portfolio_holding_t usdc;
    uint64_t quote_min_out;
    int quote_decimals;
    const char *venue;
} portfolio_fixture_t;

const portfolio_fixture_t *portfolio_preview_fixture(void);
int portfolio_format_units(char *out, size_t cap, uint64_t base_units, int decimals);
int portfolio_preview_line(char *out, size_t cap);

#endif
