/* SPDX-License-Identifier: Apache-2.0 */
#include "lcd_review.h"

#include <stdio.h>
#include <string.h>

static void blank(lcd_frame_t *frame) {
    memset(frame, 0, sizeof(*frame));
    frame->width = LCD_WIDTH;
    frame->height = LCD_HEIGHT;
}

void lcd_render(const solana_confirmation_t *conf, uint64_t now_ms, lcd_frame_t *frame) {
    if (!frame) {
        return;
    }
    blank(frame);
    if (!conf || conf->state == SOLANA_CONFIRM_NONE) {
        frame->screen = LCD_HOME;
        memcpy(frame->headline, "HOME", 5);
        return;
    }
    if (conf->state == SOLANA_CONFIRM_CANCELLED) {
        frame->screen = LCD_CANCELLED;
        memcpy(frame->headline, "CANCELLED", 10);
        return;
    }
    if (conf->state == SOLANA_CONFIRM_EXPIRED || now_ms >= conf->expires_ms) {
        frame->screen = LCD_EXPIRED;
        memcpy(frame->headline, "EXPIRED", 8);
        return;
    }
    frame->screen = LCD_REVIEW;
    memcpy(frame->headline, "REVIEW", 7);
    memcpy(frame->detail, conf->summary, strlen(conf->summary) + 1);
}

int lcd_frame_text(const lcd_frame_t *frame, char *out, size_t cap) {
    int wrote;
    if (!frame || !out || cap == 0) {
        return -1;
    }
    switch (frame->screen) {
    case LCD_HOME:
        wrote = snprintf(out, cap, "240x240 HOME");
        break;
    case LCD_REVIEW:
        wrote = snprintf(out, cap, "240x240 REVIEW %s", frame->detail);
        break;
    case LCD_EXPIRED:
        wrote = snprintf(out, cap, "240x240 EXPIRED");
        break;
    case LCD_CANCELLED:
        wrote = snprintf(out, cap, "240x240 CANCELLED");
        break;
    default:
        return -1;
    }
    if (wrote < 0 || (size_t)wrote >= cap) {
        return -1;
    }
    return 0;
}
