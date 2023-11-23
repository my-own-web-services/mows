import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";
import { FilezPermission } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezPermission";
import { useToaster } from "rsuite";

export const utcTimeStampToTimeAndDate = (
    utcTimeStamp: bigint | number,
    seconds: boolean = false
): string => {
    const utcTimeStampNum = Number(utcTimeStamp);
    const date = new Date(seconds ? utcTimeStampNum * 1000 : utcTimeStampNum);
    return `${date.toLocaleDateString("de")} ${date.toLocaleTimeString("de")}`;
};

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

export const withToasterHook = (Component: any) => {
    return (props: any) => {
        const toaster = useToaster();

        return <Component toaster={toaster} {...props} />;
    };
};

export const defaultFilePermission: FilezPermission = {
    _id: "",
    content: {
        type: "File",
        acl: {
            what: [],
            who: {
                link: false,
                passwords: [],
                users: {
                    user_group_ids: [],
                    user_ids: []
                }
            }
        },
        ribston: null
    },
    name: "",
    owner_id: "",
    use_type: "Once"
};
