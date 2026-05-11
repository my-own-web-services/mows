import baseEn from "mows-components-react/lib/languages/en-US/default";
import type { Translation } from "../languages";

const translation: Translation = {
    ...baseEn,
    manager: {
        nav: {
            home: `Home`,
            devtools: `Devtools`
        },
        terminal: {
            closeTab: `Close tab`,
            closeTabAria: `Close terminal tab`,
            newTab: `New terminal tab (Ctrl+T)`,
            newTabAria: `New terminal tab`,
            renameTab: `Double-click to rename`,
            terminal: `Terminal`
        },
        dev: {
            sections: {
                manager: `Manager`,
                clusters: `Clusters`,
                machines: `Machines`
            },
            config: {
                setFromLs: `Set config from LS`,
                setFromLsTitle: `Load the last saved cluster config from the browser's local storage and set it on the manager`,
                saveToLs: `Save config to LS`,
                saveToLsTitle: `Save the current cluster config to the browser's local storage`,
                setConfig: `Set config`,
                placeholder: `Config to set`,
                saved: `Config saved to local storage`
            },
            actions: {
                deleteAllMowsVms: `Delete all MOWS local VMs`,
                deleteAllMowsVmsTitle: `Delete all VMs with the 'mows-' prefix as well as their storage`,
                create3LocalVms: `Create 3 local VMs`,
                createClusterFromInventory: `Create cluster from all local machines in inventory`,
                installClusterBasics: `Install cluster basics`,
                createHcloudMachine: `Create hcloud machine`,
                createHcloudMachineTitle: `Create a machine on hcloud — HCLOUD_API_TOKEN must be set in secrets.env`,
                createStaticIp: `Create static IP from hcloud machine`,
                createStaticIpTitle: `Creates a static machine from an existing hcloud machine in inventory`
            }
        },
        machine: {
            start: `Start`,
            shutdown: `Shutdown`,
            reboot: `Reboot`,
            reset: `Reset`,
            forceOff: `Force off`,
            suspend: `Suspend`,
            resume: `Resume`,
            delete: `Delete`,
            toggleSsh: `Toggle SSH`,
            providers: {
                qemu: `Qemu`,
                bareMetal: `Bare Metal`
            }
        },
        cluster: {
            start: `Start`,
            stop: `Stop`,
            restart: `Restart`,
            suspend: `Suspend`,
            resume: `Resume`
        },
        common: {
            copyToClipboard: `Copy to clipboard`
        }
    }
};

export default translation;
