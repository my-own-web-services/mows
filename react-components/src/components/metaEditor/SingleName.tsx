import { PureComponent } from "react";
import { Input, InputGroup } from "rsuite";
import { FilezContext } from "../../FilezProvider";
import update from "immutability-helper";
import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";
import { BiUndo } from "react-icons/bi";
import { AiOutlineCheck } from "react-icons/ai";

interface NameProps {
    readonly inputSize: "lg" | "md" | "sm" | "xs";
    readonly file: FilezFile;
    readonly onNameFieldChange?: (name: string) => void;
    readonly onCommitNameChange?: (name: string) => void;
    readonly serverUpdate?: boolean;
}

interface NameState {
    readonly localName: string;
    readonly serverName: string;
}

export default class Name extends PureComponent<NameProps, NameState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    constructor(props: NameProps) {
        super(props);
        this.state = {
            localName: props.file.name,
            serverName: props.file.name
        };
    }

    componentDidMount = () => {
        this.init();
    };

    componentDidUpdate(prevProps: Readonly<NameProps>): void {
        if (prevProps.file._id !== this.props.file._id) {
            this.init();
        }
    }

    init = () => {
        this.setState({
            localName: this.props.file.name,
            serverName: this.props.file.name
        });
    };

    onNameFieldChange = (value: string) => {
        this.props.onNameFieldChange?.(value);

        this.setState(
            update(this.state, {
                localName: { $set: value }
            })
        );
    };

    onUpdateNameCancel = () => {
        this.setState(state =>
            update(state, {
                localName: { $set: state.serverName }
            })
        );
    };

    updateServerName = async () => {
        if (this.props.serverUpdate !== false) {
            if (!this.context) return;
            const res = await this.context.filezClient?.update_file_infos([
                {
                    fields: {
                        name: this.state.localName
                    },
                    file_id: this.props.file._id
                }
            ]);
            if (res.status === 200) {
                this.setState({ serverName: this.state.localName });
                this.props.onCommitNameChange?.(this.state.localName);
            }
        } else {
            this.props.onCommitNameChange?.(this.state.localName);
        }
    };

    render = () => {
        if (this.state.localName === "") {
            return;
        }
        return (
            <div className="Name">
                <label>Name</label>
                <InputGroup>
                    <Input
                        className="selectable"
                        size={this.props.inputSize}
                        value={this.state.localName}
                        onChange={this.onNameFieldChange}
                    />
                    {this.state.localName !== this.state.serverName && (
                        <>
                            <InputGroup.Button onClick={this.onUpdateNameCancel} title="Cancel">
                                <BiUndo />
                            </InputGroup.Button>
                            <InputGroup.Button
                                onClick={this.updateServerName}
                                appearance="primary"
                                title="Save"
                            >
                                <AiOutlineCheck />
                            </InputGroup.Button>
                        </>
                    )}
                </InputGroup>
            </div>
        );
    };
}
