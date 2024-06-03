import { FilezFile } from "@firstdorsal/filez-client";

export const isImageDisplayable = (filezFile: FilezFile) => {
    const diplayableMimeTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (diplayableMimeTypes.includes(filezFile.mimeType)) return true;
    return false;
};
