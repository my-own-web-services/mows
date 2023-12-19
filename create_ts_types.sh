#!/bin/bash

export basePath=clients/ts/src/apiTypes/

rm -rf ${basePath}

cd ./common/ && cargo test && cd ..
cd ./server/ && cargo test && cd ..
cd ./addons/image/ && cargo test && cd ../..


printf '\nimport { FilezFileGroup } from "./FilezFileGroup";' >> ${basePath}GetFileGroupsResponseBody.ts
printf '\nimport { FilezFile } from "./FilezFile";' >> ${basePath}GetFileInfosResponseBody.ts
printf '\nimport { FilezUser } from "./FilezUser";' >> ${basePath}GetUserResponseBody.ts

cd ./clients/ts/ && yarn build && cd ../..