#!/bin/bash
mkdir results > /dev/null 2>&1

mozart render templates/filez-web-ui-config.yml -o results/filez-web-ui-config.yml
mozart yaml-to-json results/filez-web-ui-config.yml -o results/filez-web-ui-config.json
rm -rf results/filez-web-ui-config.yml

mozart render templates/docker-compose.yml -o results/docker-compose.yml
mozart labels-to-compose results/docker-compose.yml -o results/docker-compose.yml

docker compose -p filez --project-directory results/ up --build -d --remove-orphans 