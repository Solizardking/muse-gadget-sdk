/* SPDX-License-Identifier: Apache-2.0 */
#include "sha256.h"

#include <stdio.h>
#include <string.h>

static int hex_equals(const uint8_t digest[32], const char *hex) {
    static const char digits[] = "0123456789abcdef";
    unsigned i;
    if (strlen(hex) != 64) {
        return 0;
    }
    for (i = 0; i < 32; i++) {
        if (digits[digest[i] >> 4] != hex[i * 2] || digits[digest[i] & 0x0f] != hex[i * 2 + 1]) {
            return 0;
        }
    }
    return 1;
}

static int check_bundle(const char *directory) {
    char sums_path[512];
    FILE *sums;
    char line[640];
    int files = 0;
    int wrote = snprintf(sums_path, sizeof sums_path, "%s/SHA256SUMS", directory);
    if (wrote < 0 || (size_t)wrote >= sizeof sums_path) {
        return -1;
    }
    sums = fopen(sums_path, "r");
    if (!sums) {
        return 0;
    }
    while (fgets(line, sizeof line, sums)) {
        char hex[65];
        char name[128];
        char file_path[640];
        uint8_t digest[32];
        size_t length = strlen(line);
        while (length && (line[length - 1] == '\n' || line[length - 1] == '\r')) {
            line[--length] = 0;
        }
        if (!length) {
            continue;
        }
        if (sscanf(line, "%64s %127s", hex, name) != 2) {
            fclose(sums);
            fprintf(stderr, "checksum list unreadable: %s\n", sums_path);
            return -1;
        }
        wrote = snprintf(file_path, sizeof file_path, "%s/%s", directory, name);
        if (wrote < 0 || (size_t)wrote >= sizeof file_path || sha256_file(file_path, digest) != 0 ||
            !hex_equals(digest, hex)) {
            fclose(sums);
            fprintf(stderr, "checksum mismatch: %s\n", name);
            return -1;
        }
        files++;
    }
    if (ferror(sums)) {
        fclose(sums);
        return -1;
    }
    fclose(sums);
    if (files == 0) {
        return -1;
    }
    printf("SOLANA_OS 0.4.4 checksums=ok files=%d\n", files);
    return 1;
}

int main(int argc, char **argv) {
    const char *fallback[] = {"firmware/solana-os/0.4.4", "../firmware/solana-os/0.4.4", NULL};
    unsigned i;
    if (argc > 1) {
        return check_bundle(argv[1]) == 1 ? 0 : 1;
    }
    for (i = 0; fallback[i]; i++) {
        int status = check_bundle(fallback[i]);
        if (status == 1) {
            return 0;
        }
        if (status < 0) {
            return 1;
        }
    }
    fprintf(stderr, "Solana OS 0.4.4 bundle not found\n");
    return 1;
}
