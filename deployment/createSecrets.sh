#!/bin/bash
mkdir results > /dev/null 2>&1
set -e
mozart render templates/secrets.env > results/.env