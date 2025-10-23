import { clsx, type ClassValue } from "clsx";
import { type FilezFile } from "filez-client-typescript";
import type { SigninRedirectArgs } from "oidc-client-ts";
import { twMerge } from "tailwind-merge";
import { FILEZ_POST_LOGIN_REDIRECT_PATH_LOCAL_STORAGE_KEY } from "./constants";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

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

export const signinRedirectSavePath = async (
    signinRedirectFunction: (args?: SigninRedirectArgs) => Promise<void>
) => {
    const redirect_uri = window.location.pathname + window.location.search;
    localStorage.setItem(FILEZ_POST_LOGIN_REDIRECT_PATH_LOCAL_STORAGE_KEY, redirect_uri);
    await signinRedirectFunction();
};

export const formatFileSizeToHumanReadable = (maybe_bigint_bytes: bigint | number): string => {
    const bytes = Number(maybe_bigint_bytes);
    const sizes = ["Bytes", "KiB", "MiB", "GiB", "TiB"];
    if (bytes === 0) {
        return "0 Bytes";
    }
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(2) + " " + sizes[i];
};

export const isText = (file: FilezFile): boolean => {
    if (file.mime_type.startsWith("text/")) return true;
    if (file.mime_type.startsWith("application/json")) return true;
    if (file.mime_type.startsWith("application/xml")) return true;
    if (file.mime_type.startsWith("application/octet-stream")) return true;

    return false;
};

export const generateRandomId = (length: number = 16): string => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
    let result = "";
    const charactersLength = chars.length;
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
};
