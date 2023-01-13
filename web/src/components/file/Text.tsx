import { Component } from "preact";
import { ReducedFilezFile } from "../../types";
import "./Text.scss";

interface TextProps {
    readonly file: ReducedFilezFile;
}
interface TextState {
    readonly textContent: string;
}
export default class Text extends Component<TextProps, TextState> {
    componentDidMount = () => {
        fetch(`/api/get_file/${this.props.file._id}`)
            .then(response => response.text())
            .then(text => {
                this.setState({ textContent: text });
            });
    };

    render = () => {
        return (
            <div className="Text">
                <p>{this.state.textContent}</p>
            </div>
        );
    };
}
