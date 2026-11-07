/* SPDX-License-Identifier: Apache-2.0 */
#include "portfolio_preview.h"

#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static int round_trip(const char *rendered, uint64_t base_units, int decimals) {
    unsigned long long whole = 0;
    unsigned long long fraction = 0;
    uint64_t scale = 1;
    int i;
    if (sscanf(rendered, "%llu.%llu", &whole, &fraction) != 2) {
        return -1;
    }
    for (i = 0; i < decimals; i++) {
        scale *= 10ull;
    }
    return (uint64_t)whole * scale + (uint64_t)fraction == base_units ? 0 : -1;
}

int main(void) {
    char line[160];
    char sol[32];
    char usdc[32];
    char minimum[32];
    const portfolio_fixture_t *fixture = portfolio_preview_fixture();
    if (portfolio_preview_line(line, sizeof line) != 0) {
        return 1;
    }
    if (sscanf(line, "PORTFOLIO sol=%31s usdc=%31s quote_min_out=%31s", sol, usdc, minimum) != 3) {
        return 1;
    }
    if (round_trip(sol, fixture->sol.base_units, fixture->sol.decimals) != 0 ||
        round_trip(usdc, fixture->usdc.base_units, fixture->usdc.decimals) != 0 ||
        round_trip(minimum, fixture->quote_min_out, fixture->quote_decimals) != 0 ||
        !strstr(line, "venue=fixture")) {
        return 1;
    }
    printf("%s\n", line);
    return 0;
}
