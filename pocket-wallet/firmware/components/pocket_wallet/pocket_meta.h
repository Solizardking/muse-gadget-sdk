/* SPDX-License-Identifier: Apache-2.0 */
#pragma once
#include <stdbool.h>
#include <stddef.h>

typedef enum { POCKET_META_RESPONSES, POCKET_META_CHAT, POCKET_META_MESSAGES } pocket_meta_protocol_t;
typedef struct {
    pocket_meta_protocol_t protocol;
    const char *model;
} pocket_meta_config_t;

/* Provider secrets never enter this structure. Authenticate with the scoped device token. */
typedef struct {
    bool get;
    char path[64];
    char body[8192];
} pocket_meta_request_t;

const char *pocket_meta_protocol_name(pocket_meta_protocol_t protocol);
void pocket_meta_models_request(pocket_meta_request_t *request);
bool pocket_meta_config_valid(const pocket_meta_config_t *config);
bool pocket_meta_voice_request(const pocket_meta_config_t *config, const char *transcript,
                               pocket_meta_request_t *request);
bool pocket_meta_prompt_request(const pocket_meta_config_t *config, const char *prompt,
                                const char *effort, bool count_tokens,
                                pocket_meta_request_t *request);
#ifdef ESP_PLATFORM
#include "esp_err.h"
/* HTTPS backend origin (no path/query), verified using the ESP-IDF certificate bundle.
 * Run on a worker task. response must have space for the raw JSON reply, including reasoning.
 * Only HTTP 2xx returns ESP_OK; http_status retains errors such as 401/402/429. */
esp_err_t pocket_meta_send(const char *backend_origin, const char *device_token,
                          const pocket_meta_request_t *request, char *response,
                          size_t response_capacity, int *http_status);
#endif
