import FileIcon from "@/components/atoms/fileIcon/FileIcon";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Skeleton } from "@/components/ui/skeleton";
import { FilezContext } from "@/lib/filezContext/FilezContext";
import { log } from "@/lib/logging";
import { cn, formatFileSizeToHumanReadable } from "@/lib/utils";
import { Component, createRef } from "react";

interface ImagePreviewProps {
    readonly file: File;
    readonly fileId: string;
    readonly className?: string;
}

interface ImagePreviewState {
    readonly previewUrl: string | null;
    readonly isLoading: boolean;
    readonly hasError: boolean;
    readonly hoverCardWidth: number;
    readonly hoverCardHeight: number;
}

export default class ImagePreview extends Component<ImagePreviewProps, ImagePreviewState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    private canvasRef = createRef<HTMLCanvasElement>();
    private isResizing = false;
    private resizeStartX = 0;
    private resizeStartY = 0;
    private startWidth = 0;
    private startHeight = 0;

    constructor(props: ImagePreviewProps) {
        super(props);
        this.state = {
            previewUrl: null,
            isLoading: true,
            hasError: false,
            hoverCardWidth: 300,
            hoverCardHeight: 200
        };
    }

    componentDidMount = () => {
        this.loadPreview();
    };

    componentDidUpdate = (prevProps: ImagePreviewProps) => {
        // If the file has changed, reload the preview
        if (prevProps.fileId !== this.props.fileId || prevProps.file !== this.props.file) {
            // Clean up the previous preview URL
            if (this.state.previewUrl) {
                URL.revokeObjectURL(this.state.previewUrl);
            }

            // Reset state and load new preview
            this.setState(
                {
                    previewUrl: null,
                    isLoading: true,
                    hasError: false,
                    hoverCardWidth: 300,
                    hoverCardHeight: 200
                },
                () => {
                    this.loadPreview();
                }
            );
        }
    };

    isImageFile = (file: File): boolean => {
        return file.type.startsWith(`image/`);
    };

    isGifFile = (file: File): boolean => {
        return file.type === `image/gif`;
    };

    isVideoFile = (file: File): boolean => {
        return file.type.startsWith(`video/`);
    };

    loadPreview = async () => {
        const { file } = this.props;

        if (!this.isImageFile(file) && !this.isVideoFile(file)) {
            // For non-image and non-video files, skip to showing FileIcon
            this.setState({ isLoading: false, hasError: true });
            return;
        }

        try {
            // Use requestIdleCallback to defer preview generation when browser is idle
            if (window.requestIdleCallback) {
                window.requestIdleCallback(() => {
                    this.createPreview();
                });
            } else {
                // Fallback for browsers without requestIdleCallback
                setTimeout(() => {
                    this.createPreview();
                }, 0);
            }
        } catch (error) {
            log.error(`Error loading image preview:`, error);
            this.setState({ isLoading: false, hasError: true });
        }
    };

    createPreview = () => {
        try {
            const previewUrl = URL.createObjectURL(this.props.file);
            this.setState({ previewUrl, isLoading: false, hasError: false }, () => {
                // If it's a GIF, render it to canvas to show only the first frame
                if (this.isGifFile(this.props.file) && this.canvasRef.current) {
                    this.renderGifToCanvas(previewUrl);
                }
            });
        } catch (error) {
            log.error(`Error creating preview URL:`, error);
            this.setState({ isLoading: false, hasError: true });
        }
    };

    renderGifToCanvas = (imageUrl: string) => {
        const canvas = this.canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext(`2d`);
        if (!ctx) return;

        const img = new Image();
        img.onload = () => {
            // Set canvas size to match the container (40x40)
            canvas.width = 40;
            canvas.height = 40;

            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Calculate dimensions to maintain aspect ratio
            const aspectRatio = img.width / img.height;
            let drawWidth, drawHeight, drawX, drawY;

            if (aspectRatio > 1) {
                // Landscape
                drawWidth = canvas.width;
                drawHeight = canvas.width / aspectRatio;
                drawX = 0;
                drawY = (canvas.height - drawHeight) / 2;
            } else {
                // Portrait or square
                drawHeight = canvas.height;
                drawWidth = canvas.height * aspectRatio;
                drawY = 0;
                drawX = (canvas.width - drawWidth) / 2;
            }

            // Draw the first frame
            ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
        };
        img.onerror = () => {
            log.error(`Error loading GIF for canvas rendering`);
        };
        img.src = imageUrl;
    };

    handleResizeStart = (e: React.MouseEvent) => {
        e.preventDefault();
        this.isResizing = true;
        this.resizeStartX = e.clientX;
        this.resizeStartY = e.clientY;
        this.startWidth = this.state.hoverCardWidth;
        this.startHeight = this.state.hoverCardHeight;

        document.addEventListener(`mousemove`, this.handleResizeMove);
        document.addEventListener(`mouseup`, this.handleResizeEnd);
    };

    handleResizeMove = (e: MouseEvent) => {
        if (!this.isResizing) return;

        const deltaX = e.clientX - this.resizeStartX;
        const deltaY = e.clientY - this.resizeStartY;

        const newWidth = Math.max(150, this.startWidth + deltaX);
        const newHeight = Math.max(150, this.startHeight + deltaY);

        this.setState({
            hoverCardWidth: newWidth,
            hoverCardHeight: newHeight
        });
    };

    handleResizeEnd = () => {
        this.isResizing = false;
        document.removeEventListener(`mousemove`, this.handleResizeMove);
        document.removeEventListener(`mouseup`, this.handleResizeEnd);
    };

    componentWillUnmount = () => {
        if (this.state.previewUrl) {
            URL.revokeObjectURL(this.state.previewUrl);
        }
        // Clean up resize event listeners
        document.removeEventListener(`mousemove`, this.handleResizeMove);
        document.removeEventListener(`mouseup`, this.handleResizeEnd);
    };

    render = () => {
        const { className } = this.props;
        const { previewUrl, isLoading, hasError, hoverCardWidth, hoverCardHeight } = this.state;
        const isGif = this.isGifFile(this.props.file);
        const isVideo = this.isVideoFile(this.props.file);

        if (isLoading) {
            return <Skeleton className={cn(`h-10 w-10 rounded`, className)} />;
        }

        if (hasError || !previewUrl) {
            // Use FileIcon for non-image/video files or when preview fails
            return (
                <div className={cn(`flex h-10 w-10 items-center justify-center`, className)}>
                    <FileIcon fileName={this.props.file.name} size={40} />
                </div>
            );
        }

        return (
            <HoverCard>
                <HoverCardTrigger asChild>
                    <div
                        className={cn(
                            `flex h-10 w-10 cursor-pointer items-center justify-center`,
                            className
                        )}
                    >
                        {isVideo ? (
                            <FileIcon fileName={this.props.file.name} size={40} />
                        ) : isGif ? (
                            <canvas
                                ref={this.canvasRef}
                                className={`h-10 w-10 rounded object-cover`}
                                width={40}
                                height={40}
                            />
                        ) : (
                            <img
                                src={previewUrl}
                                alt={this.props.file.name}
                                className={`h-10 w-10 rounded object-cover`}
                                onError={() => {
                                    this.setState({ hasError: true });
                                }}
                            />
                        )}
                    </div>
                </HoverCardTrigger>
                <HoverCardContent
                    className={`relative w-auto p-2`}
                    side={`right`}
                    align={`start`}
                    style={{ width: hoverCardWidth + 16, height: hoverCardHeight + 60 }}
                >
                    <div className={`flex h-full flex-col space-y-2`}>
                        <div className={`flex flex-1 items-center justify-center`}>
                            {isVideo ? (
                                <video
                                    src={previewUrl}
                                    className={`rounded object-cover`}
                                    style={{ width: hoverCardWidth, height: hoverCardHeight }}
                                    controls
                                    autoPlay
                                    muted
                                    loop
                                    onError={() => {
                                        this.setState({ hasError: true });
                                    }}
                                />
                            ) : (
                                /* For images and GIFs, show the actual image/GIF (allowing GIFs to play) */
                                <img
                                    src={previewUrl}
                                    alt={this.props.file.name}
                                    className={`rounded object-cover`}
                                    style={{
                                        width: hoverCardWidth,
                                        height: hoverCardHeight,
                                        objectFit: `contain`
                                    }}
                                    onError={() => {
                                        this.setState({ hasError: true });
                                    }}
                                />
                            )}
                        </div>
                        <div className={`text-center`}>
                            <p className={`truncate text-sm font-medium`}>{this.props.file.name}</p>
                            <p
                                className={`text-muted-foreground text-xs`}
                                title={`${this.props.file.size} bytes`}
                            >
                                {formatFileSizeToHumanReadable(this.props.file.size)}
                            </p>
                        </div>
                    </div>
                    {/* Resize handle */}
                    <div
                        className={`absolute right-0 bottom-0 h-4 w-4 cursor-se-resize bg-gray-400 opacity-50 hover:bg-gray-600 hover:opacity-75`}
                        style={{
                            clipPath: `polygon(100% 0%, 0% 100%, 100% 100%)`
                        }}
                        onMouseDown={this.handleResizeStart}
                        title={this.context?.t.upload.dragToResize}
                    />
                </HoverCardContent>
            </HoverCard>
        );
    };
}
