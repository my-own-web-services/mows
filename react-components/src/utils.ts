import { FileGroup, FilezFile } from "@firstdorsal/filez-client";

export const isFile = (item: FilezFile | FileGroup): item is FilezFile => {
    return (<FilezFile>item).mimeType !== undefined;
};

export const utcTimeStampToTimeAndDate = (
    utcTimeStamp: number,
    seconds: boolean = false
): string => {
    const date = new Date(seconds ? utcTimeStamp * 1000 : utcTimeStamp);
    return `${date.toLocaleDateString("de")} ${date.toLocaleTimeString("de")}`;
};

export const bytesToHumanReadableSize = (bytes: number): string => {
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    if (bytes === 0) {
        return "0 Byte";
    }
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i)) + " " + sizes[i];
};

export const isText = (file: FilezFile): boolean => {
    if (file.mimeType.startsWith("text/")) return true;
    if (file.mimeType.startsWith("application/json")) return true;
    if (file.mimeType.startsWith("application/xml")) return true;
    if (file.mimeType.startsWith("application/octet-stream")) return true;

    return false;
};
