#!/bin/bash

set -euo pipefail

export ADDR="192.168.122.106"

ssh kairos@${ADDR} sudo cat /etc/rancher/k3s/k3s.yaml > ~/.kube/config && sed -i "s/127.0.0.1/${ADDR}/g" ~/.kube/config