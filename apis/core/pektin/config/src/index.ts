import Ajv from "ajv";
import yaml from "yaml";
import { promises as fs } from "fs";
import { PektinConfig } from "./config-types.js";
import _ from "lodash";
/*@ts-ignore*/
import cfonts from "cfonts";
import c from "chalk";

export const checkConfig = async (inputPath: string, schemaPath: string, silentOnSuccess = true) => {
    const schema = yaml.parse(await fs.readFile(schemaPath, { encoding: `utf-8` }));
    /*@ts-ignore*/
    const ajv = new Ajv({ strictTuples: false });

    const validate = ajv.compile(schema);
    const input = await fs.readFile(inputPath, { encoding: `utf-8` });
    let config: PektinConfig = {} as PektinConfig;
    try {
        config = yaml.parse(input);
    } catch (error) {
        /*@ts-ignore*/
        err(error.message);
    }
    const valid = validate(config);

    if (!valid) err(`${validate?.errors?.[0].instancePath} ${validate?.errors?.[0].message}`);

    // domain must be valid if service is enabled
    Object.values(config.services).forEach((e, i) => {
        const s = Object.keys(config.services);
        /*@ts-ignore*/
        if (e.enabled !== false && e.domain && e.domain.length < 3) err(`${s[i]} is enabled but it's domain is invalid`);
    });

    // nodes must contain exactly one main node
    if (config.nodes.filter((node) => node.main === true).length !== 1) {
        err(`nodes must contain exactly one main node`);
    }

    // nodes that are main can't contain a setup object
    if (config.nodes.filter((node) => node.main === true && typeof node.setup !== `undefined`).length !== 0) {
        err(`The main node can't contain a setup object`);
    }

    // nodes must have a minium of one ip or one legacyIp
    if (config.nodes.filter((node) => !node.ansible && !node.ips?.length && !node.legacyIps?.length).length !== 0) {
        err(`nodes must have a minimum of one ip or one legacyIp or ansible configured`);
    }

    {
        // check if there are duplicate nodes
        if (Array.from(new Set(config.nodes.map((node) => node.name))).length !== config.nodes.length) {
            err(`nodes must have distinct names`);
        }
    }

    if (config.nameservers) {
        {
            const hasDuplicates = (array: string[]) => new Set(array).size !== array.length;
            const mainNs: string[] = [];
            config.nameservers.forEach((ns) => {
                if (ns.main) {
                    mainNs.push(ns.domain);
                }
            });
            // check if a main ns is present
            if (mainNs.length === 0) {
                err(`A domain must have a primary nameserver`);
            }
            // check if nameserver has only one main ns
            if (hasDuplicates(mainNs)) {
                err(`A domain can only have one main nameserver`);
            }
        }
        {
            // check if all present domains have a main ns
            const distinctDomains = Array.from(new Set(config.nameservers.map((ns) => ns.domain)));
            const allHaveMain = distinctDomains.every((d) => {
                let hasMain = false;
                config.nameservers?.forEach((ns) => {
                    if (d === ns.domain && ns.main) {
                        hasMain = true;
                    }
                });
                return hasMain;
            });
            if (!allHaveMain) {
                err(`Every distinct domain must have a main nameserver`);
            }
        }
        {
            // check if there are duplicate nameservers
            if (Array.from(new Set(config.nameservers.map((ns) => ns.subDomain + `.` + ns.domain))).length !== config.nameservers.length) {
                err(`Nameservers can't have duplicates`);
            }
        }
        {
            // check if nodes names overlap with nameservers nodes

            const nodes = new Set(config.nodes.map((node) => node.name));
            const distinctNsNodes = new Set(config.nameservers.map((ns) => ns.node));
            if (!_.isEqual(nodes, distinctNsNodes)) {
                err(`Nameservers nodes don't overlap with nodes`);
            }
        }
    }

    // if certificates are enabled the letsencrypt email must be set
    if (config.services.zertificat.acmeEmail && config.services.zertificat.acmeEmail.length < 6) {
        err(`letsencrypt is enabled but the letsencryptEmail is invalid`);
    }
    if (!silentOnSuccess) {
        cfonts.say(`Config valid!`, {
            font: `chrome`,
            gradient: [`yellow`, `#5f5`],
            level: 3,
        });
    }
};

const err = (message: string | undefined) => {
    cfonts.say(`Invalid Config!`, {
        font: `chrome`,
        gradient: [`red`, `#ff5500`],
        transitionGradient: true,
    });
    console.log(``);
    console.log(c.red.bold(message));
    console.log(``);
    process.exit(1);
};
