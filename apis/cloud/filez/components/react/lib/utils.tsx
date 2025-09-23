import { type FilezFile } from "filez-client-typescript";

export const loadThemeCSS = (href: string): Promise<HTMLLinkElement> => {
    return new Promise((resolve, reject) => {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.type = "text/css";
        link.href = href;

        link.onload = () => resolve(link);
        link.onerror = () => reject(new Error(`Failed to load CSS: ${href}`));

        document.head.appendChild(link);
    });
};

export const rawFileEndings = [
    "3fr",
    "ari",
    "arw",
    "bay",
    "braw",
    "crw",
    "cr2",
    "cr3",
    "cap",
    "data",
    "dcs",
    "dcr",
    "dng",
    "drf",
    "eip",
    "erf",
    "fff",
    "gpr",
    "iiq",
    "k25",
    "kdc",
    "mdc",
    "mef",
    "mos",
    "mrw",
    "nef",
    "nrw",
    "obm",
    "orf",
    "pef",
    "ptx",
    "pxn",
    "r3d",
    "raf",
    "raw",
    "rwl",
    "rw2",
    "rwz",
    "sr2",
    "srf",
    "srw",
    "tif",
    "x3f"
];

export const bytesToHumanReadableSize = (maybe_bigint_bytes: bigint | number): string => {
    const bytes = Number(maybe_bigint_bytes);
    const sizes = ["Bytes", "KiB", "MiB", "GiB", "TiB"];
    if (bytes === 0) {
        return "0 Bytes";
    }
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i)) + " " + sizes[i];
};

export const isText = (file: FilezFile): boolean => {
    if (file.mime_type.startsWith("text/")) return true;
    if (file.mime_type.startsWith("application/json")) return true;
    if (file.mime_type.startsWith("application/xml")) return true;
    if (file.mime_type.startsWith("application/octet-stream")) return true;

    return false;
};
