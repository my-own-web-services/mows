import { cn } from "@/lib/utils";
import { FilezContext } from "@/main";
import { FilezFile } from "filez-client-typescript";
import { PureComponent, type CSSProperties } from "react";

interface ImageViewerProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly file: FilezFile;
    readonly fileVersion?: number;
    readonly width?: number;
    readonly height?: number;
}

interface ImageViewerState {
    readonly imageUrl: string | null;
    readonly newImageUrl: string | null; // Temporarily store the new image URL
    readonly isLoading: boolean;
    readonly error: string | null;
}

export default class ImageViewer extends PureComponent<ImageViewerProps, ImageViewerState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;
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
        const sizes = [100, 250, 500, 1000, 2000];
        const containerWidth = this.props.width || 0;

        let selectedSize = sizes.find((size) => size >= containerWidth);
        if (!selectedSize) {
            selectedSize = sizes[sizes.length - 1];
        }

        const format = formats[0];
        return `${selectedSize}.${format}`;
    };

    render = () => {
        const appId = `019a1146-f11c-78d4-8d70-b289b97b8514`;
        const appPath = this.getImageVersion();

        const url = `${this.context?.filezClient.baseUrl}/api/file_versions/content/get/${this.props.file.id}/${this.props.fileVersion || 0}/${appId}/${appPath}`;

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
