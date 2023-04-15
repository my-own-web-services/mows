import { FilezFile } from "../types";

export const getImagePreviewWidth = (filezFile: FilezFile, viewportItemWidth: number) => {
    viewportItemWidth = viewportItemWidth * window.devicePixelRatio;

    const maybeImageAddon = filezFile.appData.image;
    if (maybeImageAddon) {
        const imageAddon: ImageAddon = maybeImageAddon;
        if (imageAddon.result) {
            const resolutions = imageAddon.result.resolutions;
            resolutions.sort((a, b) => a - b);
            let res = 0;

            for (let i = 0; i < resolutions.length; i++) {
                if (resolutions[i] >= viewportItemWidth) {
                    res = resolutions[i];
                    break;
                }
            }

            if (res === 0) {
                res = resolutions[resolutions.length - 1];
            }

            const shouldUseOriginal = res < viewportItemWidth;

            return [res, shouldUseOriginal];
        }
    }
    return [0, true];
};

interface ImageAddon {
    error: null | string;
    finishedAt: string;
    startedAt: string;
    status: "finished" | "processing";
    result: {
        width: number;
        height: number;
        resolutions: number[];
    } | null;
}
