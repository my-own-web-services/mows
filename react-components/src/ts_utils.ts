import { FileGroupType } from "@firstdorsal/filez-client/dist/js/apiTypes/FileGroupType";
import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";
import { FilezFilePermissionAclWhatOptions } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFilePermissionAclWhatOptions";
import { FilezPermissionResource } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezPermissionResource";
import { PermissionResourceType } from "@firstdorsal/filez-client/dist/js/apiTypes/PermissionResourceType";

export const isFile = (item: FilezFile | FileGroupType): item is FilezFile => {
    return (<FilezFile>item).mime_type !== undefined;
};

export const getPermissionContent = (item?: PermissionResourceType) => {
    if (item?.hasOwnProperty("File")) {
        // @ts-ignore
        return item.File as FilezPermissionResource<FilezFilePermissionAclWhatOptions>;
    } else if (item?.hasOwnProperty("FileGroup")) {
        // @ts-ignore
        return item.FileGroup as FilezPermissionResource<FilezFileGroupPermissionAclWhatOptions>;
    } else if (item?.hasOwnProperty("UserGroup")) {
        // @ts-ignore
        return item.UserGroup as FilezPermissionResource<FilezUserGroupPermissionAclWhatOptions>;
    } else if (item?.hasOwnProperty("User")) {
        // @ts-ignore
        return item.User as FilezPermissionResource<FilezUserPermissionAclWhatOptions>;
    } else {
        throw new Error("Unknown permission resource type:" + JSON.stringify(item));
    }
};
