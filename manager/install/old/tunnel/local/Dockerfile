FROM docker.io/ubuntu/traefik:2.10.6-22.04_stable

RUN apt-get update && apt-get install -y wireguard iptables iproute2 iputils-ping net-tools iperf3 tcpdump curl dnsutils nano wget unzip iptstate git && apt-get clean

RUN wget https://github.com/traefik/whoami/releases/download/v1.10.3/whoami_v1.10.3_linux_amd64.tar.gz && tar -xvf whoami_v1.10.3_linux_amd64.tar.gz && mv whoami /usr/local/bin/whoami && rm whoami_v1.10.3_linux_amd64.tar.gz


RUN mkdir -p /etc/wireguard

# sleep
ENTRYPOINT ["sleep", "infinity"]