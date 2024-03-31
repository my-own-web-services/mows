import { Component } from "preact";
import { CSSProperties } from "preact/compat";

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
                <figcaption>{this.props.caption}</figcaption>
            </figure>
        );
    };
}
