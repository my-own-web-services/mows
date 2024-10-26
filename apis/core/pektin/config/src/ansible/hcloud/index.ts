import { promises as fs } from "fs";
import path from "path";
import { PektinConfig } from "../../config-types.js";
import { FloatingIpResponse, ServerResponse } from "./types.js";

export const mergeConfig = async (configPath: string, tmpPath: string) => {
    const config: PektinConfig = JSON.parse(await fs.readFile(configPath, { encoding: `utf8` }));

    for (let i = 0; i < config.nodes.length; i++) {
        const node = config.nodes[i];

        const [ipFile, legacyIpFile, serverFile] = await Promise.all([
            fs.readFile(path.join(tmpPath, `floating-ips`, `res`, node.name + `-ip.json`), {
                encoding: `utf8`,
            }),
            fs.readFile(path.join(tmpPath, `floating-ips`, `res`, node.name + `-legacyIp.json`), {
                encoding: `utf8`,
            }),
            fs.readFile(path.join(tmpPath, `servers`, `res`, node.name + `-server.json`), {
                encoding: `utf8`,
            }),
        ]);

        const [ip, legacyIp, server] = [
            JSON.parse(ipFile) as FloatingIpResponse,
            JSON.parse(legacyIpFile) as FloatingIpResponse,
            JSON.parse(serverFile) as ServerResponse,
        ];

        // sets the nodes ip in the config
        if (node.ansible?.floatingIp) {
            if (ip?.hcloud_floating_ip?.ip) {
                config.nodes[i].ips = [ip?.hcloud_floating_ip?.ip.replace(`/64`, ``)];
            }
        } else if (server.hcloud_server?.ipv6) {
            config.nodes[i].ips = [server.hcloud_server?.ipv6.replace(`/64`, ``)];
        }
        // sets the nodes legacy ip in the config
        if (node.ansible?.floatingLegacyIp) {
            if (legacyIp?.hcloud_floating_ip?.ip) {
                config.nodes[i].legacyIps = [legacyIp?.hcloud_floating_ip?.ip];
            }
        } else if (server.hcloud_server?.ipv4_address) {
            config.nodes[i].legacyIps = [server.hcloud_server?.ipv4_address];
        }

        if (server.hcloud_server?.labels.group !== `main`) {
            config.nodes[i].setup = {
                system: `ubuntu`,
                cloneRepo: true,
                root: {
                    disableSystemdResolved: true,
                    installDocker: true,
                },
                setup: true,
                start: true,
            };
        }
    }
    await fs.writeFile(configPath, JSON.stringify(config, null, `    `));
};

export const createConfigureFloatingIpsScript = async (configPath: string, outDir: string) => {
    const config: PektinConfig = JSON.parse(await fs.readFile(configPath, { encoding: `utf8` }));

    for (let i = 0; i < config.nodes.length; i++) {
        const node = config.nodes[i];

        if (node.ips?.length || node.legacyIps?.length) {
            let file = `
network:
    version: 2
    renderer: networkd
    ethernets:
        eth0:
            addresses:
${node.ips?.length ? `                - ` + node.ips[0] + `/64` : ``}
${node.legacyIps?.length ? `                - ` + node.legacyIps[0] + `/32` : ``}`;

            file = `echo '${file}' > /etc/netplan/60-floating-ip.yaml\nnetplan apply`;
            await fs.mkdir(outDir, { recursive: true });
            await fs.writeFile(path.join(outDir, node.name + `-configure-floating-ips.sh`), file);
        }
    }
};
