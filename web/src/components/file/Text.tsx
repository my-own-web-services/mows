import { Component } from "preact";
import { G } from "../../App";
import { FilezFile } from "../../types";
import "./Text.scss";

interface TextProps {
    readonly g: G;
    readonly file: FilezFile;
}
interface TextState {
    readonly textContent: string;
}
export default class Text extends Component<TextProps, TextState> {
    componentDidMount = async () => {
        const text = await this.props.g.filezClient.get_file(this.props.file._id);

        this.setState({ textContent: text });
    };

    render = () => {
        return (
            <div className="Text">
                <p>{this.state.textContent}</p>
            </div>
        );
    };
}
