#include "pocket_wallet.h"
#include <assert.h>
#include <string.h>
int main(void) {
    pocket_wallet_t s; pocket_init(&s);
    assert(s.screen==POCKET_HOME);
    assert(!pocket_press(&s,0,true));
    assert(pocket_review(&s,1000,50000,"id","0.01 SOL","1 USDC","0.99 USDC","DFlow"));
    assert(s.expires_ms==11000);
    assert(!pocket_press(&s,2000,false));
    assert(pocket_press(&s,2000,true));
    assert(!pocket_press(&s,2001,true));
    pocket_tick(&s,11000); assert(s.screen==POCKET_EXPIRED); assert(!s.intent_id[0]);
    assert(!pocket_press(&s,11000,true));
    assert(!pocket_review(&s,1000,999,"id","a","b","c","d"));
    char oversized[100]; memset(oversized,'x',99); oversized[99]=0;
    assert(!pocket_review(&s,1000,9999,oversized,"a","b","c","d"));
    pocket_cancel(&s); assert(s.screen==POCKET_HOME);
    assert(pocket_review(&s,1000,1500,"id","a","b","c","d"));
    assert(!pocket_press(&s,1500,true));
    return 0;
}
