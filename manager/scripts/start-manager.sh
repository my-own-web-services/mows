#!/bin/bash

set -euo pipefail

docker compose down mows-manager; docker compose up mows-manager --build  