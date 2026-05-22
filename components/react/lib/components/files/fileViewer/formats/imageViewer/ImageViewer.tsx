import { PureComponent, type CSSProperties } from "react";
import { cn } from "../../../../../lib/utils";

export interface ImageViewerProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly src: string;
    readonly alt?: string;
    readonly width?: number;
    readonly height?: number;
    /**
     * Hint that this viewer is one of many on screen (lists, strips,
     * galleries). Switches the underlying <img> to native lazy loading
     * + async decoding so off-screen images don't block paint, and uses
     * `low` fetch priority so the browser de-prioritises them against
     * primary content. `width` / `height`, when provided, are forwarded
     * as intrinsic attributes so the layout reserves space before the
     * pixels arrive.
     */
    readonly embedded?: boolean;
}

type ImageViewerState = Record<string, never>;

export default class ImageViewer extends PureComponent<ImageViewerProps, ImageViewerState> {
    render = () => {
        const { src, alt, width, height, embedded } = this.props;
        return (
            <div
                style={{ ...this.props.style }}
                className={cn(
                    `ImageViewer flex h-full w-full items-center justify-center`,
                    this.props.className
                )}
            >
                <img
                    src={src}
                    loading={embedded ? `lazy` : `eager`}
                    decoding={embedded ? `async` : undefined}
                    // Native attribute; React types lag the spec, so cast.
                    fetchpriority={embedded ? `low` : undefined as never}
                    width={width}
                    height={height}
                    draggable={false}
                    alt={alt ?? ``}
                    className={`max-h-full max-w-full object-contain`}
                />
            </div>
        );
    };
}
