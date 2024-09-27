#!/bin/bash

set -euo pipefail

# the first argument to the script is the output directory
OUTPUT_DIR=$1

# generate local keypair
wg genkey | tee $OUTPUT_DIR/local_wg_private_key | wg pubkey > $OUTPUT_DIR/local_wg_public_key

# generate remote keypair
wg genkey | tee $OUTPUT_DIR/remote_wg_private_key | wg pubkey > $OUTPUT_DIR/remote_wg_public_key