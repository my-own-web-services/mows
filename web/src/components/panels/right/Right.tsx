import { Component } from "preact";
import { G } from "../../../App";
import { ReducedFilezFile } from "../../../types";
import "./Right.scss";
import { Input } from "rsuite";
import { TagPicker } from "rsuite";

interface RightProps {
    readonly g: G;
    readonly files: ReducedFilezFile[];
}

interface RightState {
    readonly name: string;
    readonly keywords: string[];
}
export default class Right extends Component<RightProps, RightState> {
    componentDidMount = () => {
        this.reload();
    };

    componentDidUpdate = (prevProps: RightProps) => {
        this.reload(prevProps);
    };

    reload = (prevProps?: RightProps) => {
        const file = this.props.g.selectedFiles[0];

        if (prevProps !== undefined) {
            const prevFile = prevProps.g.selectedFiles[0];
            if (prevFile?._id !== file?._id) {
                this.setF(file);
            }
        } else {
            this.setF(file);
        }
    };
    setF = (f?: ReducedFilezFile) => {
        if (f !== undefined) {
            this.setState({
                name: f.name,
                keywords: []
            });
        }
    };

    render = () => {
        const s = this.state;
        // TODO display the tag picker with a text and tag version that can be toggled
        // TODO fix the tag picker by maybe switching to react
        return (
            <div id="main-panel-right" className="Right horizontal-panel panel">
                {s.name === undefined ? null : (
                    <div>
                        <div style={{ marginBottom: "20px" }}>
                            <div>Name</div>
                            <Input
                                onChange={(value: string) => {
                                    this.setState({ name: value });
                                }}
                                placeholder="Name"
                                value={s.name}
                                style={{ width: "100%" }}
                            />
                        </div>
                        <div style={{ marginBottom: "20px" }}>
                            <div>Keywords</div>
                            <TagPicker
                                creatable
                                trigger={["Enter", "Comma"]}
                                data={["test", "test2"].map(item => ({ label: item, value: item }))}
                                block
                                virtualized={true}
                            />
                        </div>
                    </div>
                )}
            </div>
        );
    };
}
