import { log } from "@/lib/logging";
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

    getImageVersion = () => {
        const formats = ["avif"];
        const sizes = [100, 250, 500, 1000, 2000];
        const containerWidth = this.props.width || 0;

        let selectedSize = sizes.find((size) => size >= containerWidth);
        if (!selectedSize) {
            selectedSize = sizes[sizes.length - 1];
        }

        const format = formats[0];
        return `${selectedSize}.${format}`;
    };

    fetchImage = async () => {
        try {
            const appId = "019a1146-f11c-78d4-8d70-b289b97b8514";
            const appPath = this.getImageVersion();
            const res = await this.context?.filezClient.api.getFileVersionContent(
                this.props.file.id,
                this.props.fileVersion || 0,
                appId,
                appPath
            );

            const blob = await res?.blob();

            if (blob) {
                const objectURL = URL.createObjectURL(blob);

                // If an image is already displayed, preload the new one
                if (this.state.imageUrl) {
                    this.setState({ newImageUrl: objectURL });
                    this.preloadImage(objectURL);
                } else {
                    // For the initial load, just display it
                    this.setState({ imageUrl: objectURL, isLoading: false });
                }
            } else {
                this.setState({ error: "Failed to load image", isLoading: false });
            }
        } catch (error) {
            log.error("Error fetching image:", error);
            this.setState({
                error: error instanceof Error ? error.message : "Failed to load image",
                isLoading: false
            });
        }
    };

    preloadImage = (url: string) => {
        // Clean up any previous image loader
        if (this.imageLoader) {
            this.imageLoader.onload = null;
            this.imageLoader.onerror = null;
        }

        this.imageLoader = new Image();
        this.imageLoader.src = url;

        this.imageLoader.onload = () => {
            // Once loaded, swap the URLs and clean up
            this.setState(
                (prevState) => {
                    // Revoke the old object URL to prevent memory leaks
                    if (prevState.imageUrl) {
                        URL.revokeObjectURL(prevState.imageUrl);
                    }
                    return {
                        imageUrl: prevState.newImageUrl,
                        newImageUrl: null
                    };
                },
                () => {
                    this.imageLoader = null;
                }
            );
        };

        this.imageLoader.onerror = () => {
            log.error("Error preloading image:", url);
            this.setState({
                error: "Failed to load new image resolution",
                newImageUrl: null // Clear the new image URL on error
            });
            this.imageLoader = null;
        };
    };

    componentDidMount = async () => {
        await this.fetchImage();
    };

    componentDidUpdate = async (prevProps: ImageViewerProps) => {
        if (
            prevProps.file.id !== this.props.file.id ||
            prevProps.fileVersion !== this.props.fileVersion ||
            prevProps.width !== this.props.width // Also check for width changes
        ) {
            if (this.state.imageUrl && prevProps.file.id === this.props.file.id) {
                // If it's the same file, just fetch the new version without a loading state
                await this.fetchImage();
            } else {
                // If it's a new file, show the loading state and fetch
                this.setState({ isLoading: true, error: null });
                await this.fetchImage();
            }
        }
    };

    componentWillUnmount = () => {
        // Clean up object URLs and image loader to avoid memory leaks
        if (this.state.imageUrl) {
            URL.revokeObjectURL(this.state.imageUrl);
        }
        if (this.state.newImageUrl) {
            URL.revokeObjectURL(this.state.newImageUrl);
        }
        if (this.imageLoader) {
            this.imageLoader.onload = null;
            this.imageLoader.onerror = null;
            this.imageLoader = null;
        }
    };

    render = () => {
        const { imageUrl, isLoading, error } = this.state;

        return (
            <div
                style={{ ...this.props.style }}
                className={cn(
                    "ImageViewer flex h-full w-full items-center justify-center",
                    this.props.className
                )}
            >
                {imageUrl && (
                    <img
                        src={imageUrl}
                        loading="eager"
                        draggable={false}
                        alt={this.props.file.name}
                        width={this.props.width}
                        className="max-w-full object-contain"
                    />
                )}
            </div>
        );
    };
}
