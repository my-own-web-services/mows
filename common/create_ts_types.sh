#!/bin/bash

export basePath=../clients/ts/src/apiTypes/

rm -rf ${basePath}

cargo test
cd ../server/ && cargo test

printf '\nimport { FilezFileGroup } from "./FilezFileGroup";' >> ${basePath}GetFileGroupsResponseBody.ts
printf '\nimport { FilezFile } from "./FilezFile";' >> ${basePath}GetFileInfosResponseBody.ts