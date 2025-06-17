#!/bin/bash

set -euo pipefail

export BUILDX_BAKE_ENTITLEMENTS_FS=0
export BAKE_ARGS="--set *.args.PROFILE=dev --set *.args.APP_STAGE_IMAGE=scratch"
export REGISTRY="localhost:5000"

export MOWS_ROOT=$(pwd)

# Bold and green text for info messages
export SCRIPT_INFO_COLOR="\033[1;32m"
# Bold and yellow text for warning messages
export SCRIPT_WARNING_COLOR="\033[1;33m"
# Bold and red text for error messages
export SCRIPT_ERROR_COLOR="\033[1;31m"
# Reset color to default
export SCRIPT_RESET_COLOR="\033[0m"


printf "${SCRIPT_INFO_COLOR}Building all MOWS components...${SCRIPT_RESET_COLOR}\n"

# Build and run cargo-workspace-docker
printf "${SCRIPT_INFO_COLOR}Running cargo-workspace-docker...${SCRIPT_RESET_COLOR}\n"
cd ./utils/cargo-workspace-docker && cargo run ${MOWS_ROOT}  ; cd ../../

printf "${SCRIPT_INFO_COLOR}Building zitadel-resource-controller...${SCRIPT_RESET_COLOR}\n"
cd ./operators/zitadel-resource-controller && bash build.sh ; cd ../../


printf "${SCRIPT_INFO_COLOR}Building pektin-resource-controller...${SCRIPT_RESET_COLOR}\n"
cd ./operators/pektin-resource-controller && bash build.sh ; cd ../../


printf "${SCRIPT_INFO_COLOR}Building vault-resource-controller...${SCRIPT_RESET_COLOR}\n"
cd ./operators/vault-resource-controller && bash build.sh ; cd ../../


printf "${SCRIPT_INFO_COLOR}Building mows-package-manager...${SCRIPT_RESET_COLOR}\n"
cd ./operators/mows-package-manager && bash build.sh ; cd ../../


printf "${SCRIPT_INFO_COLOR}Building mows-manager-codegen...${SCRIPT_RESET_COLOR}\n"
cd ./manager/ && bash scripts/codegen.sh ; cd ../

printf "${SCRIPT_INFO_COLOR}Building mows-manager...${SCRIPT_RESET_COLOR}\n"
cd ./manager/ && bash build.sh ; cd ../


printf "${SCRIPT_INFO_COLOR}Building pektin-api...${SCRIPT_RESET_COLOR}\n"
cd ./apis/core/pektin/api && bash build.sh ; cd ../../../../


printf "${SCRIPT_INFO_COLOR}Building pektin-feoco...${SCRIPT_RESET_COLOR}\n"
cd ./apis/core/pektin/feoco && bash build.sh ; cd ../../../../


printf "${SCRIPT_INFO_COLOR}Building pektin-server...${SCRIPT_RESET_COLOR}\n"
cd ./apis/core/pektin/server && bash build.sh ; cd ../../../../


printf "${SCRIPT_INFO_COLOR}Building pektin-zertificat...${SCRIPT_RESET_COLOR}\n"
cd ./apis/core/pektin/zertificat && bash build.sh ; cd ../../../../


printf "${SCRIPT_INFO_COLOR}Building filez-server...${SCRIPT_RESET_COLOR}\n"
cd ./apis/cloud/filez/server && bash build.sh ; cd ../../../../

printf "${SCRIPT_INFO_COLOR}Building filez-server-codegen...${SCRIPT_RESET_COLOR}\n"
cd ./apis/cloud/filez/server && bash scripts/codegen.sh ; cd ../../../../
