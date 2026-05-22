import { PureComponent, Suspense, lazy, type CSSProperties, type ReactNode } from "react";
import { cn } from "../../../lib/utils";
import ImageViewer from "./formats/imageViewer/ImageViewer";
import { isVideoOrStream } from "./formats/videoViewer/mimeType";

// Lazy: three.js + photo-sphere-viewer (~200 kB gzip) is only fetched when a
// caller actually renders a 360 image.
const Image360Viewer = lazy(() => import(`./formats/image360Viewer/Image360Viewer`));

// Lazy: shaka-player (~256 kB gzip) is only fetched when a caller actually
// renders a video or streaming manifest.
const VideoViewer = lazy(() => import(`./formats/videoViewer/VideoViewer`));

export interface FileViewerProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly name: string;
    readonly mimeType: string;
    readonly src: string;
    readonly width?: number;
    readonly height?: number;
    /**
     * If true, render the image as a 360° equirectangular panorama instead
     * of a flat image. The consumer is responsible for detection
     * (e.g. by inspecting file tags or GPano XMP metadata).
     */
    readonly is360?: boolean;
    /**
     * Optional fallback rendered when no built-in viewer matches the mime type.
     * Defaults to the file name.
     */
    readonly fallback?: ReactNode;
    /**
     * Hint that this viewer is one of many on screen — e.g. inside a
     * `ResourceList` grid, a horizontal strip, or any gallery surface.
     * Currently affects `image/*` rendering only: switches the underlying
     * <img> to native lazy loading + async decoding + low fetch priority,
     * so off-screen images don't block paint and the primary viewer (if
     * any) wins the network. No-op for video / 360 viewers, which manage
     * their own streaming.
     */
    readonly embedded?: boolean;
}

type FileViewerState = Record<string, never>;

export default class FileViewer extends PureComponent<FileViewerProps, FileViewerState> {
    render = () => {
        const { name, mimeType, src, width, height, is360, fallback, embedded } = this.props;
        return (
            <div
                style={{ ...this.props.style }}
                className={cn(`FileViewer h-full w-full`, this.props.className)}
            >
                {(() => {
                    if (mimeType.startsWith(`image/`)) {
                        if (is360) {
                            return (
                                <Suspense fallback={<div className={`h-full w-full`} />}>
                                    <Image360Viewer src={src} alt={name} />
                                </Suspense>
                            );
                        }
                        return (
                            <ImageViewer
                                src={src}
                                alt={name}
                                width={width}
                                height={height}
                                embedded={embedded}
                            />
                        );
                    }
                    if (isVideoOrStream(mimeType)) {
                        return (
                            <Suspense fallback={<div className={`h-full w-full bg-black`} />}>
                                <VideoViewer src={src} mimeType={mimeType} name={name} />
                            </Suspense>
                        );
                    }
                    return fallback ?? <span>{name}</span>;
                })()}
            </div>
        );
    };
}
