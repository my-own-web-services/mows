#!/bin/bash

rm -rf ../clients/ts/src/apiTypes/

cargo test
cd ../server/ && cargo test

