/* SPDX-License-Identifier: Apache-2.0 */
#include "pocket_meta.h"
#include <stdio.h>
#include <string.h>

void pocket_meta_models_request(pocket_meta_request_t *request) {
    if (!request) return;
    memset(request,0,sizeof(*request));
    request->get=true;strcpy(request->path,"/api/gadget/meta/models");
}

const char *pocket_meta_protocol_name(pocket_meta_protocol_t protocol) {
    switch (protocol) {
    case POCKET_META_RESPONSES: return "responses";
    case POCKET_META_CHAT: return "chat/completions";
    case POCKET_META_MESSAGES: return "messages";
    default: return NULL;
    }
}
bool pocket_meta_config_valid(const pocket_meta_config_t *config) {
    static const char *models[] = {"muse-spark-1.3", "muse-spark-1.2", "muse-spark-1.1",
        "muse-spark-1.3-contributor", "muse-spark-1.2-contributor"};
    if (!config || !config->model || !pocket_meta_protocol_name(config->protocol)) return false;
    for (size_t i=0; i<sizeof(models)/sizeof(models[0]); i++)
        if (!strcmp(config->model,models[i])) return true;
    return false;
}
static bool escape_json(const char *input, char *out, size_t capacity) {
    if (!input || !*input) return false;
    size_t used=0;
    for (const unsigned char *p=(const unsigned char *)input; *p; p++) {
        char escaped[7]; const char *part=escaped;
        if (*p < 32) snprintf(escaped,sizeof(escaped),"\\u%04x",*p);
        else if (*p=='"' || *p=='\\') {escaped[0]='\\';escaped[1]=(char)*p;escaped[2]=0;}
        else {escaped[0]=(char)*p;escaped[1]=0;}
        size_t length=strlen(part);
        if (used+length>=capacity) return false;
        memcpy(out+used,part,length);used+=length;
    }
    out[used]=0;return true;
}
bool pocket_meta_voice_request(const pocket_meta_config_t *config, const char *transcript,
                               pocket_meta_request_t *request) {
    if (!request) return false;
    memset(request,0,sizeof(*request));
    if (!pocket_meta_config_valid(config) || !transcript || strlen(transcript)>1000) return false;
    char escaped[6001];
    if (!escape_json(transcript,escaped,sizeof(escaped))) return false;
    strcpy(request->path,"/api/gadget/voice");
    int n=snprintf(request->body,sizeof(request->body),
        "{\"transcript\":\"%s\",\"model\":\"%s\",\"protocol\":\"%s\"}",
        escaped,config->model,pocket_meta_protocol_name(config->protocol));
    return n>0 && (size_t)n<sizeof(request->body);
}
bool pocket_meta_prompt_request(const pocket_meta_config_t *config, const char *prompt,
                                const char *effort, bool count_tokens,
                                pocket_meta_request_t *request) {
    if (!request) return false;
    memset(request,0,sizeof(*request));
    if (!pocket_meta_config_valid(config) || !effort || !prompt || strlen(prompt)>1000) return false;
    if (strcmp(effort,"low") && strcmp(effort,"medium") && strcmp(effort,"high") && strcmp(effort,"xhigh")) return false;
    if (count_tokens && config->protocol==POCKET_META_CHAT) return false;
    char escaped[6001];
    if (!escape_json(prompt,escaped,sizeof(escaped))) return false;
    const char *endpoint=count_tokens ? config->protocol==POCKET_META_RESPONSES ? "responses/input_tokens" : "messages/count_tokens" : pocket_meta_protocol_name(config->protocol);
    snprintf(request->path,sizeof(request->path),"/api/gadget/meta/%s",endpoint);
    int n;
    const char *rules="Explain concepts only. Never invent live balances, quotes or receipts. You cannot trade; every trade needs a fresh quote and wallet approval.";
    if (config->protocol==POCKET_META_RESPONSES)
        n=snprintf(request->body,sizeof(request->body),"{\"model\":\"%s\",\"input\":\"%s\",\"instructions\":\"%s\",\"store\":false,\"include\":[\"reasoning.encrypted_content\"],\"reasoning\":{\"effort\":\"%s\"},\"max_output_tokens\":4096}",config->model,escaped,rules,effort);
    else if (config->protocol==POCKET_META_MESSAGES)
        n=snprintf(request->body,sizeof(request->body),"{\"model\":\"%s\",\"system\":\"%s\",\"messages\":[{\"role\":\"user\",\"content\":\"%s\"}],\"thinking\":{\"type\":\"adaptive\"},\"output_config\":{\"effort\":\"%s\"},\"max_tokens\":4096}",config->model,rules,escaped,effort);
    else
        n=snprintf(request->body,sizeof(request->body),"{\"model\":\"%s\",\"messages\":[{\"role\":\"developer\",\"content\":\"%s\"},{\"role\":\"user\",\"content\":\"%s\"}],\"reasoning_effort\":\"%s\",\"max_completion_tokens\":4096}",config->model,rules,escaped,effort);
    if (n<=0 || (size_t)n>=sizeof(request->body)) {memset(request,0,sizeof(*request));return false;}
    return true;
}

#ifdef ESP_PLATFORM
#include "esp_http_client.h"
#include "esp_crt_bundle.h"
#include <stdlib.h>
typedef struct {char *data;size_t capacity,used;bool overflow;} reply_t;
static esp_err_t collect(esp_http_client_event_t *event) {
    reply_t *reply=event->user_data;
    if (event->event_id==HTTP_EVENT_ON_DATA && event->data_len>0) {
        if ((size_t)event->data_len>=reply->capacity-reply->used) {reply->overflow=true;return ESP_FAIL;}
        memcpy(reply->data+reply->used,event->data,(size_t)event->data_len);
        reply->used+=(size_t)event->data_len;reply->data[reply->used]=0;
    }
    return ESP_OK;
}
esp_err_t pocket_meta_send(const char *origin,const char *token,const pocket_meta_request_t *request,
                          char *response,size_t capacity,int *http_status) {
    if (!origin || strncmp(origin,"https://",8) || !origin[8] || strpbrk(origin+8,"/?#@\r\n") ||
        !token || !*token || strlen(token)>512 || strpbrk(token,"\r\n") || !request ||
        (strcmp(request->path,"/api/gadget/voice") && strncmp(request->path,"/api/gadget/meta/",17)) ||
        !response || capacity<2 || !http_status) return ESP_ERR_INVALID_ARG;
    char url[512],auth[520];
    int length=snprintf(url,sizeof(url),"%s%s",origin,request->path);
    if (length<0 || (size_t)length>=sizeof(url)) return ESP_ERR_INVALID_SIZE;
    snprintf(auth,sizeof(auth),"Bearer %s",token);
    reply_t reply={.data=response,.capacity=capacity};response[0]=0;*http_status=0;
    esp_http_client_config_t cfg={.url=url,.crt_bundle_attach=esp_crt_bundle_attach,
        .timeout_ms=190000,.disable_auto_redirect=true,.event_handler=collect,.user_data=&reply};
    esp_http_client_handle_t client=esp_http_client_init(&cfg);
    if (!client) return ESP_ERR_NO_MEM;
    esp_err_t error=esp_http_client_set_method(client,request->get ? HTTP_METHOD_GET : HTTP_METHOD_POST);
    if (error==ESP_OK) error=esp_http_client_set_header(client,"Authorization",auth);
    if (error==ESP_OK) error=esp_http_client_set_header(client,"Content-Type","application/json");
    if (error==ESP_OK && !request->get) error=esp_http_client_set_post_field(client,request->body,(int)strlen(request->body));
    if (error==ESP_OK) error=esp_http_client_perform(client);
    *http_status=esp_http_client_get_status_code(client);
    esp_http_client_cleanup(client);memset(auth,0,sizeof(auth));
    if (reply.overflow) return ESP_ERR_INVALID_SIZE;
    if (error!=ESP_OK) return error;
    return *http_status>=200 && *http_status<300 ? ESP_OK : ESP_FAIL;
}
#endif
