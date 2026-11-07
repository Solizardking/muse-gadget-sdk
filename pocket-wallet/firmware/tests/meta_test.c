#include "pocket_meta.h"
#include <assert.h>
#include <string.h>
int main(void) {
    pocket_meta_request_t request;
    pocket_meta_models_request(&request);
    assert(request.get && !strcmp(request.path,"/api/gadget/meta/models"));
    for (int i=POCKET_META_RESPONSES;i<=POCKET_META_MESSAGES;i++) {
        pocket_meta_config_t config={.protocol=(pocket_meta_protocol_t)i,.model="muse-spark-1.3"};
        assert(pocket_meta_voice_request(&config,"sell \"SOL\"\n0.01",&request));
        assert(!request.get);
        assert(!strcmp(request.path,"/api/gadget/voice"));
        assert(strstr(request.body,"\\\"SOL\\\"\\u000a"));
        assert(strstr(request.body,pocket_meta_protocol_name(config.protocol)));
        assert(!strstr(request.body,"API_KEY"));
        assert(pocket_meta_prompt_request(&config,"Explain slippage","low",false,&request));
        assert(strstr(request.path,pocket_meta_protocol_name(config.protocol)));
        assert(pocket_meta_prompt_request(&config,"count","low",true,&request)==(i!=POCKET_META_CHAT));
        assert(!pocket_meta_prompt_request(&config,"question","none",false,&request));
        assert(!request.body[0]);
    }
    pocket_meta_config_t bad={.protocol=POCKET_META_RESPONSES,.model="injected\"model"};
    assert(!pocket_meta_voice_request(&bad,"hello",&request));
    bad.model="muse-image-1.0";assert(!pocket_meta_voice_request(&bad,"hello",&request));
    bad.model="muse-spark-1.3";bad.protocol=99;assert(!pocket_meta_voice_request(&bad,"hello",&request));
    bad.protocol=POCKET_META_RESPONSES;
    char large[1002];memset(large,'a',1001);large[1001]=0;
    assert(!pocket_meta_voice_request(&bad,large,&request));
    assert(!pocket_meta_voice_request(&bad,"",&request));
    assert(!pocket_meta_voice_request(NULL,"hello",&request));
    return 0;
}
