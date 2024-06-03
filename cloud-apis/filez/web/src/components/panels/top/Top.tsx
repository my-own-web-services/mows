import { Component } from "preact";
import { G } from "../../../App";
import Upload from "../../upload/Upload";
import "./Top.scss";

interface TopProps {
    readonly g: G;
}
interface TopState {
    readonly addFileModalOpen: boolean;
}
export default class Top extends Component<TopProps, TopState> {
    addFileModalClose = () => {
        this.setState({
            addFileModalOpen: false
        });
    };

    render = () => {
        return (
            <div className="Top">
                <button
                    onClick={() =>
                        this.setState({
                            addFileModalOpen: true
                        })
                    }
                >
                    Add File
                </button>
                {this.state.addFileModalOpen && (
                    <Upload
                        g={this.props.g}
                        closeModal={this.addFileModalClose}
                        open={this.state.addFileModalOpen}
                    ></Upload>
                )}
            </div>
        );
    };
}
