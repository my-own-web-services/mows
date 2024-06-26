#!/bin/bash

mkdir results > /dev/null 2>&1
set -e

mozart render-dir templates/config/ -o results/config/


mozart yaml-to-json results/config/filez-web-ui-config.yml -o results/config/filez-web-ui-config.json
rm -rf results/config/filez-web-ui-config.yml

mozart yaml-to-json results/config/interossea-web-ui-config.yml -o results/config/interossea-web-ui-config.json
rm -rf results/config/interossea-web-ui-config.yml


mozart render templates/admin.yml -o results/admin.yml

mozart render templates/chmodReadonlyMounts.sh -o results/chmodReadonlyMounts.sh

bash results/chmodReadonlyMounts.sh


mozart render templates/docker-compose.yml -o results/docker-compose.yml
mozart labels-to-compose results/docker-compose.yml -o results/docker-compose.yml

cp -R templates/data results/

docker compose -p filez --project-directory results/ up --build -d --remove-orphans 