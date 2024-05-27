import { JSX } from "preact";
import { Component } from "preact";
import { CSSProperties } from "react";

interface ImageProps {
    readonly image: {
        src: string;
        width: number;
        height: number;
    };
    alt: string;
    readonly caption: JSX.Element | string;
    readonly style?: CSSProperties;
}
interface ImageState {}
export default class Image extends Component<ImageProps, ImageState> {
    render = () => {
        const i = this.props.image;

        return (
            <figure
                style={{
                    ...this.props.style,
                    width: "100%"
                }}
            >
                <img
                    loading={"lazy"}
                    src={i.src}
                    alt={this.props.alt}
                    width={i.width}
                    height={i.height}
                />
                <figcaption className={"mt-2 text-sm w-full text-center text-primaryDim"}>
                    {this.props.caption}
                </figcaption>
            </figure>
        );
    };
}
