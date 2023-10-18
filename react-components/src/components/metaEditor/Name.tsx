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
            localName: "",
            serverName: ""
        };
    }

    componentDidMount = () => {
        this.init();
    };

    componentDidUpdate(
        prevProps: Readonly<NameProps>,
        _prevState: Readonly<NameState>,
        _snapshot?: any
    ): void {
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
                        onChange={(value: string) => {
                            this.setState(
                                update(this.state, {
                                    localName: { $set: value }
                                })
                            );
                        }}
                    />
                    {this.state.localName !== this.state.serverName && (
                        <>
                            <InputGroup.Button
                                onClick={() => {
                                    this.setState(state =>
                                        update(state, {
                                            localName: { $set: state.serverName }
                                        })
                                    );
                                }}
                                title="Cancel"
                            >
                                <BiUndo />
                            </InputGroup.Button>
                            <InputGroup.Button
                                onClick={async () => {
                                    const res = await this.context?.filezClient.update_file_infos(
                                        this.props.file._id,
                                        {
                                            Name: this.state.localName
                                        }
                                    );
                                    if (res?.status === 200) {
                                        this.setState(state =>
                                            update(state, {
                                                serverName: { $set: state.localName }
                                            })
                                        );
                                    }
                                }}
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
