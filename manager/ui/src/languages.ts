import {
    type Language as MowsLanguage,
    type Translation as MowsTranslation
} from "@my-own-web-services/react-components/lib/languages";

declare module "@my-own-web-services/react-components/lib/languages" {
    interface Translation {
        manager: {
            nav: {
                home: string;
                devtools: string;
            };
            terminal: {
                closeTab: string;
                closeTabAria: string;
                newTab: string;
                newTabAria: string;
                renameTab: string;
                terminal: string;
            };
            dev: {
                sections: {
                    manager: string;
                    clusters: string;
                    machines: string;
                };
                config: {
                    setFromLs: string;
                    setFromLsTitle: string;
                    saveToLs: string;
                    saveToLsTitle: string;
                    setConfig: string;
                    placeholder: string;
                    saved: string;
                };
                actions: {
                    deleteAllMowsVms: string;
                    deleteAllMowsVmsTitle: string;
                    create3LocalVms: string;
                    createClusterFromInventory: string;
                    installClusterBasics: string;
                    createHcloudMachine: string;
                    createHcloudMachineTitle: string;
                    createStaticIp: string;
                    createStaticIpTitle: string;
                };
            };
            machine: {
                start: string;
                shutdown: string;
                reboot: string;
                reset: string;
                forceOff: string;
                suspend: string;
                resume: string;
                delete: string;
                toggleSsh: string;
                providers: {
                    qemu: string;
                    bareMetal: string;
                };
            };
            cluster: {
                start: string;
                stop: string;
                restart: string;
                suspend: string;
                resume: string;
            };
            common: {
                copyToClipboard: string;
            };
        };
    }
}

export type Translation = MowsTranslation;
export type Language = MowsLanguage;
