import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => {
    return twMerge(clsx(inputs));
};

export const formatFileSizeToHumanReadable = (maybe_bigint_bytes: bigint | number): string => {
    const bytes = Number(maybe_bigint_bytes);
    const sizes = [`Bytes`, `KiB`, `MiB`, `GiB`, `TiB`];
    if (bytes === 0) {
        return `0 Bytes`;
    }
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(2) + ` ` + sizes[i];
};

export const generateRandomId = (length: number = 16): string => {
    const chars = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-`;
    let result = ``;
    const charactersLength = chars.length;
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
};
