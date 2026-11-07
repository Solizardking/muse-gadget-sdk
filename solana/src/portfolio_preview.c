/* SPDX-License-Identifier: Apache-2.0 */
#include "portfolio_preview.h"

#include <stdio.h>
#include <string.h>

static const portfolio_fixture_t FIXTURE = {
    .sol = {.symbol = "SOL", .base_units = 10000000, .decimals = 9},
    .usdc = {.symbol = "USDC", .base_units = 2500000, .decimals = 6},
    .quote_min_out = 980000,
    .quote_decimals = 6,
    .venue = "fixture",
};

const portfolio_fixture_t *portfolio_preview_fixture(void) {
    return &FIXTURE;
}

int portfolio_format_units(char *out, size_t cap, uint64_t base_units, int decimals) {
    uint64_t scale = 1;
    uint64_t whole;
    uint64_t fraction;
    int wrote;
    int i;
    if (!out || decimals < 0 || decimals > 9) {
        return -1;
    }
    for (i = 0; i < decimals; i++) {
        scale *= 10ull;
    }
    whole = decimals == 0 ? base_units : base_units / scale;
    fraction = decimals == 0 ? 0 : base_units % scale;
    if (decimals == 0) {
        wrote = snprintf(out, cap, "%llu", (unsigned long long)whole);
    } else {
        wrote = snprintf(out, cap, "%llu.%0*llu", (unsigned long long)whole, decimals,
                         (unsigned long long)fraction);
    }
    if (wrote < 0 || (size_t)wrote >= cap) {
        return -1;
    }
    return 0;
}

int portfolio_preview_line(char *out, size_t cap) {
    char sol[32];
    char usdc[32];
    char minimum[32];
    int wrote;
    const portfolio_fixture_t *fixture = portfolio_preview_fixture();
    if (!out) {
        return -1;
    }
    if (portfolio_format_units(sol, sizeof sol, fixture->sol.base_units, fixture->sol.decimals) != 0 ||
        portfolio_format_units(usdc, sizeof usdc, fixture->usdc.base_units, fixture->usdc.decimals) != 0 ||
        portfolio_format_units(minimum, sizeof minimum, fixture->quote_min_out, fixture->quote_decimals) != 0) {
        return -1;
    }
    wrote = snprintf(out, cap, "PORTFOLIO sol=%s usdc=%s quote_min_out=%s venue=%s", sol, usdc, minimum,
                     fixture->venue);
    if (wrote < 0 || (size_t)wrote >= cap) {
        return -1;
    }
    return 0;
}
