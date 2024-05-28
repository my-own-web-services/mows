import { Component } from "preact";
import { CSSProperties } from "preact/compat";
import { animationsEnabled } from "../Nav";
import Toggle from "../Toggle";

interface AnimationToggleProps {
    readonly className?: string;
    readonly style?: CSSProperties;
}

interface AnimationToggleState {}

export default class AnimationToggle extends Component<AnimationToggleProps, AnimationToggleState> {
    constructor(props: AnimationToggleProps) {
        super(props);
        this.state = {};
    }

    componentDidMount = async () => {};

    render = () => {
        return (
            <Toggle
                style={{ ...this.props.style }}
                checked={animationsEnabled.value}
                onClick={() => {
                    animationsEnabled.value = !animationsEnabled.value;
                }}
                title="Toggle animations"
                className={`AnimationToggle text-primaryDim mt-2${this.props.className ?? ""}`}
            >
                Animations
            </Toggle>
        );
    };
}
