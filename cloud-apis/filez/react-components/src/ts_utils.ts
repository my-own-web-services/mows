import { FileGroupType } from "@firstdorsal/filez-client/dist/js/apiTypes/FileGroupType";
import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";
import { FilezFileGroupPermissionAclWhatOptions } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFileGroupPermissionAclWhatOptions";
import { FilezFilePermissionAclWhatOptions } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFilePermissionAclWhatOptions";
import { FilezPermissionResource } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezPermissionResource";
import { FilezUserGroupPermissionAclWhatOptions } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezUserGroupPermissionAclWhatOptions";
import { FilezUserPermissionAclWhatOptions } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezUserPermissionAclWhatOptions";
import { PermissionResourceType } from "@firstdorsal/filez-client/dist/js/apiTypes/PermissionResourceType";

export const isFile = (item: FilezFile | FileGroupType): item is FilezFile => {
    return (<FilezFile>item).mime_type !== undefined;
};

export const getPermissionContent = (item?: PermissionResourceType) => {
    if (item !== undefined) {
        if ("File" in item) {
            return item.File as FilezPermissionResource<FilezFilePermissionAclWhatOptions>;
        } else if ("FileGroup" in item) {
            return item.FileGroup as FilezPermissionResource<FilezFileGroupPermissionAclWhatOptions>;
        } else if ("UserGroup" in item) {
            return item.UserGroup as FilezPermissionResource<FilezUserGroupPermissionAclWhatOptions>;
        } else if ("User" in item) {
            return item.User as FilezPermissionResource<FilezUserPermissionAclWhatOptions>;
        }
    }
    throw new Error("Unknown permission resource type:" + JSON.stringify(item));
};
