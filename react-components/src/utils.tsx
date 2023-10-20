import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";
import { useToaster } from "rsuite";

export const utcTimeStampToTimeAndDate = (
    utcTimeStamp: bigint,
    seconds: boolean = false
): string => {
    const utcTimeStamp_num = Number(utcTimeStamp);
    const date = new Date(seconds ? utcTimeStamp_num * 1000 : utcTimeStamp_num);
    return `${date.toLocaleDateString("de")} ${date.toLocaleTimeString("de")}`;
};

export const bytesToHumanReadableSize = (bigint_bytes: bigint | number): string => {
    const bytes = Number(bigint_bytes);
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    if (bytes === 0) {
        return "0 Byte";
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

export const withToasterHook = (Component: any) => {
    return (props: any) => {
        const toaster = useToaster();

        return <Component toaster={toaster} {...props} />;
    };
};
