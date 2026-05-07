import { MowsContext } from "mows-components-react/lib/mowsContext/MowsContext";
import { type FilezContextType, withFilez } from "@/lib/filezContext/FilezContext";
import { cn } from "@/lib/utils";
import { FilezFile } from "filez-client-typescript";
import { PureComponent, type CSSProperties } from "react";

interface ImageViewerProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly file: FilezFile;
    readonly fileVersion?: number;
    readonly width?: number;
    readonly height?: number;
    readonly filez: FilezContextType;
}

interface ImageViewerState {
    readonly imageUrl: string | null;
    readonly newImageUrl: string | null; // Temporarily store the new image URL
    readonly isLoading: boolean;
    readonly error: string | null;
}

class ImageViewerBase extends PureComponent<ImageViewerProps, ImageViewerState> {
    static contextType = MowsContext;
    declare context: React.ContextType<typeof MowsContext>;
    private imageLoader: HTMLImageElement | null = null; // Used for preloading

    constructor(props: ImageViewerProps) {
        super(props);
        this.state = {
            imageUrl: null,
            newImageUrl: null,
            isLoading: true,
            error: null
        };
    }

    componentDidMount = () => {};

    getImageVersion = () => {
        const formats = [`avif`];
        const sizes = [100, 250, 500, 1000];
        const containerWidth = this.props.width || 0;

        let selectedSize = sizes.find((size) => size >= containerWidth);
        if (!selectedSize) {
            selectedSize = sizes[sizes.length - 1];
        }

        const format = formats[0];
        return `${selectedSize}.${format}`;
    };

    render = () => {
        const appId = `019a4a36-abf3-7f62-9df9-cdf5f60331cf`;
        const appPath = this.getImageVersion();

        const url = `${this.props.filez.filezClient.baseUrl}/api/file_versions/content/get/${this.props.file.id}/${this.props.fileVersion || 0}/${appId}/${appPath}?cache=3600`;

        return (
            <div
                style={{ ...this.props.style }}
                className={cn(
                    `ImageViewer flex h-full w-full items-center justify-center`,
                    this.props.className
                )}
            >
                <img
                    src={url}
                    loading={`eager`}
                    draggable={false}
                    alt={this.props.file.name}
                    className={`max-h-full max-w-full object-contain`}
                />
            </div>
        );
    };
}

export default withFilez(ImageViewerBase);
