import { FileGroup, FilezFile } from "@firstdorsal/filez-client";

export const isFile = (item: FilezFile | FileGroup): item is FilezFile => {
    return (<FilezFile>item).mimeType !== undefined;
};
