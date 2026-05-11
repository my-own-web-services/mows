import baseDe from "mows-components-react/lib/languages/de/default";
import type { Translation } from "../languages";

const translation: Translation = {
    ...baseDe,
    manager: {
        nav: {
            home: `Startseite`,
            devtools: `Entwicklerwerkzeuge`
        },
        terminal: {
            closeTab: `Tab schließen`,
            closeTabAria: `Terminal-Tab schließen`,
            newTab: `Neuer Terminal-Tab (Strg+T)`,
            newTabAria: `Neuer Terminal-Tab`,
            renameTab: `Doppelklicken zum Umbenennen`,
            terminal: `Terminal`
        },
        dev: {
            sections: {
                manager: `Manager`,
                clusters: `Cluster`,
                machines: `Maschinen`
            },
            config: {
                setFromLs: `Konfig. aus LS laden`,
                setFromLsTitle: `Lädt die zuletzt gespeicherte Cluster-Konfiguration aus dem lokalen Speicher des Browsers und setzt sie im Manager`,
                saveToLs: `Konfig. in LS speichern`,
                saveToLsTitle: `Speichert die aktuelle Cluster-Konfiguration im lokalen Speicher des Browsers`,
                setConfig: `Konfiguration setzen`,
                placeholder: `Zu setzende Konfiguration`,
                saved: `Konfiguration im lokalen Speicher gesichert`
            },
            actions: {
                deleteAllMowsVms: `Alle lokalen MOWS-VMs löschen`,
                deleteAllMowsVmsTitle: `Löscht alle VMs mit Präfix 'mows-' samt ihrem Speicher`,
                create3LocalVms: `3 lokale VMs erstellen`,
                createClusterFromInventory: `Cluster aus allen lokalen Maschinen im Inventar erstellen`,
                installClusterBasics: `Cluster-Basis installieren`,
                createHcloudMachine: `Hcloud-Maschine erstellen`,
                createHcloudMachineTitle: `Erstellt eine Maschine bei hcloud — HCLOUD_API_TOKEN muss in secrets.env gesetzt sein`,
                createStaticIp: `Statische IP aus hcloud-Maschine erstellen`,
                createStaticIpTitle: `Erstellt eine statische Maschine aus einer existierenden hcloud-Maschine im Inventar`
            }
        },
        machine: {
            start: `Starten`,
            shutdown: `Herunterfahren`,
            reboot: `Neustarten`,
            reset: `Zurücksetzen`,
            forceOff: `Hart abschalten`,
            suspend: `Pausieren`,
            resume: `Fortsetzen`,
            delete: `Löschen`,
            toggleSsh: `SSH umschalten`,
            providers: {
                qemu: `Qemu`,
                bareMetal: `Bare Metal`
            }
        },
        cluster: {
            start: `Starten`,
            stop: `Stoppen`,
            restart: `Neustarten`,
            suspend: `Pausieren`,
            resume: `Fortsetzen`
        },
        common: {
            copyToClipboard: `In Zwischenablage kopieren`
        }
    }
};

export default translation;
