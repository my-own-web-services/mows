import { FileGroupType } from "@firstdorsal/filez-client/dist/js/apiTypes/FileGroupType";
import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";

export const isFile = (item: FilezFile | FileGroupType): item is FilezFile => {
    return (<FilezFile>item).mime_type !== undefined;
};
