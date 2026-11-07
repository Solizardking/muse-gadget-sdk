/* SPDX-License-Identifier: Apache-2.0 */
#ifndef LCD_REVIEW_H
#define LCD_REVIEW_H

#include "solana_confirm.h"

#include <stddef.h>
#include <stdint.h>

#define LCD_WIDTH 240
#define LCD_HEIGHT 240

typedef enum {
    LCD_HOME = 0,
    LCD_REVIEW = 1,
    LCD_EXPIRED = 2,
    LCD_CANCELLED = 3
} lcd_screen_t;

typedef struct lcd_frame {
    int width;
    int height;
    lcd_screen_t screen;
    char headline[32];
    char detail[SOLANA_CONFIRM_SUMMARY_MAX + 1];
} lcd_frame_t;

/* What a 240x240 round LCD would show for this confirmation at now_ms. */
void lcd_render(const solana_confirmation_t *conf, uint64_t now_ms, lcd_frame_t *frame);

/* Writes "240x240 HOME|REVIEW <summary>|EXPIRED|CANCELLED". Returns 0 or -1. */
int lcd_frame_text(const lcd_frame_t *frame, char *out, size_t cap);

#endif
