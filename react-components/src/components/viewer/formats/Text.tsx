import { PureComponent } from "react";

interface TextProps {}

interface TextState {}

export default class Text extends PureComponent<TextProps, TextState> {
    constructor(props: TextProps) {
        super(props);
        this.state = {};
    }

    render = () => {
        return <div className="Text"></div>;
    };
}
