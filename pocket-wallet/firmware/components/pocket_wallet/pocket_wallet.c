/* SPDX-License-Identifier: Apache-2.0 */
#include "pocket_wallet.h"
#include <string.h>
static bool fits(const char *text, size_t capacity) { return text && text[0] && strlen(text) < capacity; }
void pocket_init(pocket_wallet_t *state) { memset(state, 0, sizeof(*state)); state->screen = POCKET_HOME; }
bool pocket_review(pocket_wallet_t *s, uint64_t now, uint64_t expires, const char *id,
                   const char *pay, const char *receive, const char *minimum, const char *venue) {
    pocket_init(s);
    if (expires <= now || !fits(id,sizeof(s->intent_id)) || !fits(pay,sizeof(s->pay)) ||
        !fits(receive,sizeof(s->receive)) || !fits(minimum,sizeof(s->minimum)) || !fits(venue,sizeof(s->venue))) return false;
    strcpy(s->intent_id,id); strcpy(s->pay,pay); strcpy(s->receive,receive);
    strcpy(s->minimum,minimum); strcpy(s->venue,venue);
    s->expires_ms = expires - now > 10000 ? now + 10000 : expires;
    s->screen = POCKET_REVIEW;
    return true;
}
void pocket_tick(pocket_wallet_t *s, uint64_t now) {
    if ((s->screen==POCKET_REVIEW || s->screen==POCKET_PHONE) && now >= s->expires_ms) {
        s->screen=POCKET_EXPIRED; memset(s->intent_id,0,sizeof(s->intent_id));
    }
}
bool pocket_press(pocket_wallet_t *s, uint64_t now, bool physical) {
    pocket_tick(s,now);
    if (!physical || s->screen!=POCKET_REVIEW) return false;
    s->screen=POCKET_PHONE;
    return true;
}
void pocket_cancel(pocket_wallet_t *s) { pocket_init(s); }
