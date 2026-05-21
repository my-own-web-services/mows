import { type FilezContextType, withFilez } from "@/lib/filezContext/FilezContext";
import { FilezFile } from "filez-client-typescript";
import FileViewer from "mows-components-react/components/files/fileViewer/FileViewer";
import { PureComponent, type CSSProperties } from "react";

const DEFAULT_IMAGE_APP_ID = `019a4a36-abf3-7f62-9df9-cdf5f60331cf`;
const IMAGE_SIZES = [100, 250, 500, 1000] as const;
const IMAGE_FORMAT = `avif`;

const pickImageSize = (width: number | undefined): number => {
    const target = width ?? 0;
    return IMAGE_SIZES.find((size) => size >= target) ?? IMAGE_SIZES[IMAGE_SIZES.length - 1];
};

const isPanorama = (file: FilezFile): boolean => {
    const extracted = file.metadata.extracted_data as { is_360?: unknown } | null | undefined;
    return extracted?.is_360 === true;
};

interface FilezFileViewerProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly file: FilezFile;
    readonly fileVersion?: number;
    readonly appId?: string;
    readonly width?: number;
    readonly height?: number;
    readonly filez: FilezContextType;
}

type FilezFileViewerState = Record<string, never>;

class FilezFileViewerBase extends PureComponent<FilezFileViewerProps, FilezFileViewerState> {
    private buildSrc = (is360: boolean): string => {
        const { file, fileVersion, appId, width, filez } = this.props;
        const isImage = file.mime_type.startsWith(`image/`);
        const resolvedAppId = appId ?? (isImage ? DEFAULT_IMAGE_APP_ID : ``);
        // 360 panoramas always pull the largest pre-rendered tier; downscaling
        // by container width would make the sphere look unusably low-res.
        const sizePx = is360 ? IMAGE_SIZES[IMAGE_SIZES.length - 1] : pickImageSize(width);
        const appPath = isImage ? `${sizePx}.${IMAGE_FORMAT}` : ``;
        return `${filez.filezClient.baseUrl}/api/file_versions/content/get/${file.id}/${fileVersion ?? 0}/${resolvedAppId}/${appPath}?cache=3600`;
    };

    render = () => {
        const { file, width, height, className, style } = this.props;
        const is360 = isPanorama(file);
        return (
            <FileViewer
                className={className}
                style={style}
                name={file.name}
                mimeType={file.mime_type}
                src={this.buildSrc(is360)}
                width={width}
                height={height}
                is360={is360}
            />
        );
    };
}

export default withFilez(FilezFileViewerBase);
