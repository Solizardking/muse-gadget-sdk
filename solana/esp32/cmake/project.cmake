# Copyright (c) Meta Platforms, Inc. and affiliates.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# Shared setup for the standalone application and an enclosing internal project.
# Include before project(); source lists and dependencies stay in the components.
get_filename_component(GADGET_SOURCE_DIR "${CMAKE_CURRENT_LIST_DIR}/.." ABSOLUTE)

# Keep each build's generated configuration beside its build artifacts.
# Explicit -DSDKCONFIG paths, including the flash helper's, still take priority.
if(NOT SDKCONFIG)
    set(SDKCONFIG "${CMAKE_BINARY_DIR}/sdkconfig" CACHE FILEPATH "Project configuration")
endif()

if(NOT CMAKE_SOURCE_DIR STREQUAL GADGET_SOURCE_DIR)
    list(APPEND EXTRA_COMPONENT_DIRS
        "${GADGET_SOURCE_DIR}/main"
        "${GADGET_SOURCE_DIR}/components"
    )
endif()

# ESP-Mosaico: Espressif's ESP-Iris and the app side of its retained Vibe Mode
# firmware, from an esp-mosaico-utils checkout (tools/muse/board.sh passes it).
if(MOSAICO_UTILS)
    list(APPEND EXTRA_COMPONENT_DIRS
        "${MOSAICO_UTILS}/ESP-Iris/components/esp_iris"
        "${MOSAICO_UTILS}/esp-mosaico-recovery/components/esp_mosaico_app_recovery"
        "${GADGET_SOURCE_DIR}/components_mosaico/muse_mosaico_iris"
    )
endif()

# ESP-IDF reads version.txt from the active project root unless PROJECT_VER is set.
# MUSE_GADGET_API_KEY (your mgst_ SDK token) from the environment or from the
# git-ignored sdkconfig.defaults.local (see sdkconfig.defaults.local.example)
# becomes CONFIG_GADGET_SDK_TOKEN, so the token never lands in a tracked file.
if(NOT SDKCONFIG_DEFAULTS)
    set(SDKCONFIG_DEFAULTS "${GADGET_SOURCE_DIR}/sdkconfig.defaults")
endif()
if(EXISTS "${GADGET_SOURCE_DIR}/sdkconfig.defaults.local")
    list(APPEND SDKCONFIG_DEFAULTS "${GADGET_SOURCE_DIR}/sdkconfig.defaults.local")
endif()
if(NOT "$ENV{MUSE_GADGET_API_KEY}" STREQUAL "")
    set(GADGET_API_KEY_DEFAULTS "${CMAKE_BINARY_DIR}/sdkconfig.defaults.api_key")
    file(WRITE "${GADGET_API_KEY_DEFAULTS}" "CONFIG_GADGET_SDK_TOKEN=\"$ENV{MUSE_GADGET_API_KEY}\"\n")
    list(APPEND SDKCONFIG_DEFAULTS "${GADGET_API_KEY_DEFAULTS}")
    # An existing sdkconfig wins over defaults; update its token line too.
    if(EXISTS "${SDKCONFIG}")
        file(READ "${SDKCONFIG}" GADGET_SDKCONFIG_TEXT)
        string(REGEX REPLACE "CONFIG_GADGET_SDK_TOKEN=\"[^\"\n]*\""
            "CONFIG_GADGET_SDK_TOKEN=\"$ENV{MUSE_GADGET_API_KEY}\"" GADGET_SDKCONFIG_NEW "${GADGET_SDKCONFIG_TEXT}")
        if(NOT GADGET_SDKCONFIG_NEW STREQUAL GADGET_SDKCONFIG_TEXT)
            file(WRITE "${SDKCONFIG}" "${GADGET_SDKCONFIG_NEW}")
        endif()
    endif()
endif()

include($ENV{IDF_PATH}/tools/cmake/project.cmake)
