#!/bin/bash

set -euo pipefail


docker compose down mows-manager || true


docker compose up mows-manager --build

