import { JSX } from "preact";
import { Component } from "preact";
import { CSSProperties } from "react";

interface ImageProps {
    readonly image: {
        src: string;
        width: number;
        height: number;
    };
    readonly alt: string;
    readonly caption?: JSX.Element | string;
    readonly style?: CSSProperties;
    readonly aiGenerated?: boolean;
    readonly imgClassName?: string;
    readonly figClassName?: string;
}
interface ImageState {}
export default class Image extends Component<ImageProps, ImageState> {
    render = () => {
        const i = this.props.image;

        return (
            <figure
                style={{
                    ...this.props.style,
                }}
                className={`Image ${this.props.figClassName ?? ""} relative`}
                title={this.props.aiGenerated ? "This image is AI generated" : ""}
                
            >
                <img
                    loading={"lazy"}
                    src={i.src}
                    alt={this.props.alt}
                    width={i.width}
                    height={i.height}
                    className={`${this.props.imgClassName ?? ""}`}
                />
                {this.props.aiGenerated && (
                    <div className={"absolute bottom-0 right-0"}>
                        <div  className={"bg-[red] w-2 h-2 rounded-full"}>
                        </div>
                    </div>
                )}
                {this.props.caption && (
                <figcaption className={"mt-2 text-sm w-full text-center text-primaryDim"}>
                    {this.props.caption}
                </figcaption>
                )}


            </figure>
        );
    };
}
