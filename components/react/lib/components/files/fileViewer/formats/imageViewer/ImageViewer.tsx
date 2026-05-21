import { PureComponent, type CSSProperties } from "react";
import { cn } from "../../../../../lib/utils";

export interface ImageViewerProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly src: string;
    readonly alt?: string;
    readonly width?: number;
    readonly height?: number;
}

type ImageViewerState = Record<string, never>;

export default class ImageViewer extends PureComponent<ImageViewerProps, ImageViewerState> {
    render = () => {
        return (
            <div
                style={{ ...this.props.style }}
                className={cn(
                    `ImageViewer flex h-full w-full items-center justify-center`,
                    this.props.className
                )}
            >
                <img
                    src={this.props.src}
                    loading={`eager`}
                    draggable={false}
                    alt={this.props.alt ?? ``}
                    className={`max-h-full max-w-full object-contain`}
                />
            </div>
        );
    };
}
