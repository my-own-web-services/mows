import { Component } from "preact";
import { CSSProperties } from "preact/compat";

interface FigureProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly caption: JSX.Element;
}

interface FigureState {}

export default class Figure extends Component<FigureProps, FigureState> {
    constructor(props: FigureProps) {
        super(props);
        this.state = {};
    }

    componentDidMount = async () => {};

    render = () => {
        return (
            <figure
                style={{ ...this.props.style }}
                className={`Figure ${this.props.className ?? ""}`}
            >
                {this.props.children}
                <figcaption className={"mt-2 text-sm w-full text-center text-primaryDim"}>
                    {this.props.caption}
                </figcaption>
            </figure>
        );
    };
}
