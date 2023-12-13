import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";
import { FilezPermission } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezPermission";
import { useToaster } from "rsuite";

export const getLastSelectedIndex = (
    selectedItems: (boolean | undefined)[]
) => {
    for (let i = selectedItems.length - 1; i >= 0; i--) {
        if (selectedItems[i]) {
            return i;
        }
    }
};

export const utcTimeStampToTimeAndDate = (
    utcTimeStamp: bigint | number,
    seconds = false
): string => {
    const utcTimeStampNum = Number(utcTimeStamp);
    const date = new Date(seconds ? utcTimeStampNum * 1000 : utcTimeStampNum);
    return `${date.toLocaleDateString("de")} ${date.toLocaleTimeString("de")}`;
};

export const bytesToHumanReadableSize = (
    maybe_bigint_bytes: bigint | number
): string => {
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
    // eslint-disable-next-line
    return (props: any) => {
        const toaster = useToaster();

        return <Component displayName="test" toaster={toaster} {...props} />;
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
