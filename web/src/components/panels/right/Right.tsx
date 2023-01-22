import { Component } from "preact";
import { G } from "../../../App";
import { FilezFile } from "../../../types";
import "./Right.scss";
import { Input } from "rsuite";
import { TagPicker } from "rsuite";
import { InputPicker } from "rsuite";
import { SelectPicker } from "rsuite";

interface RightProps {
    readonly g: G;
    readonly files: FilezFile[];
}

interface RightState {
    readonly name: string;
    readonly keywords: string[];
    readonly staticGroups: string[];
    readonly ownerId: string;
    readonly storageId: string | null;
    readonly availableStorage: string[] | null;
    readonly mimeType: string;
    readonly readonly: boolean;
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
    setF = (f?: FilezFile) => {
        if (f !== undefined) {
            this.setState({
                name: f.name,
                keywords: f.keywords,
                staticGroups: f.staticFileGroupIds,
                ownerId: f.ownerId,
                storageId: f.storageId,
                mimeType: f.mimeType,
                readonly: f.readonly
            });
        }
    };

    nameSubmit = () => {
        this.props.g.filezClient.update_file_infos(this.props.g.selectedFiles[0]?._id, {
            Name: this.state.name
        });
    };

    render = () => {
        const s = this.state;
        // TODO display the tag picker with a text and tag version that can be toggled
        // TODO fix the tag picker by maybe switching to react
        return (
            <div id="main-panel-right" className="Right horizontal-panel panel">
                {s.name === undefined ? null : (
                    <>
                        <div>
                            <div>Name</div>
                            <Input
                                onChange={(value: string) => {
                                    this.setState({ name: value });
                                }}
                                onPressEnter={this.nameSubmit}
                                placeholder="Name"
                                value={s.name}
                                style={{ width: "100%" }}
                            />
                        </div>
                        <div>
                            <div>Keywords</div>
                            <TagPicker
                                creatable
                                trigger={["Enter", "Comma"]}
                                data={this.state.keywords.map(item => ({
                                    label: item,
                                    value: item
                                }))}
                                value={this.state.keywords}
                                block
                                onChange={(value: string[]) => {
                                    this.props.g.filezClient.update_file_infos(
                                        this.props.g.selectedFiles[0]?._id,
                                        { Keywords: value }
                                    );
                                    this.setState({ keywords: value });
                                }}
                            />
                        </div>
                        <div>
                            <div>Static Groups</div>
                            <TagPicker
                                creatable
                                trigger={["Enter", "Comma"]}
                                data={this.state.staticGroups.map(item => ({
                                    label: item,
                                    value: item
                                }))}
                                value={this.state.staticGroups}
                                block
                                onChange={(value: string[]) => {
                                    this.props.g.filezClient.update_file_infos(
                                        this.props.g.selectedFiles[0]?._id,
                                        { StaticFileGroupIds: value }
                                    );
                                    this.setState({ staticGroups: value });
                                }}
                            />
                        </div>
                        <div>
                            <div>Mime Type</div>
                            <InputPicker
                                creatable
                                data={[
                                    "application/json",
                                    "text/html",
                                    "image/png",
                                    "image/jpeg"
                                ].map(item => ({
                                    label: item,
                                    value: item
                                }))}
                                onChange={(value: string) => {
                                    this.props.g.filezClient.update_file_infos(
                                        this.props.g.selectedFiles[0]?._id,
                                        { MimeType: value }
                                    );
                                    this.setState({ mimeType: value });
                                }}
                                placeholder="Mime Type"
                                value={s.mimeType}
                                style={{ width: "100%" }}
                            />
                        </div>
                        <div>
                            <div>Storage</div>
                            {this.state.readonly ? (
                                <Input
                                    value="Readonly"
                                    title="File is readonly mounted. It's storage can only be changed by moving it on the server and updating its path in the api-server config."
                                    disabled
                                />
                            ) : (
                                <SelectPicker
                                    onOpen={() => {
                                        this.props.g.filezClient.get_user_info().then(user => {
                                            this.setState({
                                                availableStorage: Object.keys(user.limits)
                                            });
                                        });
                                    }}
                                    data={
                                        this.state.availableStorage?.map(item => ({
                                            label: item,
                                            value: item
                                        })) ?? []
                                    }
                                ></SelectPicker>
                            )}
                        </div>
                        <div>
                            <div>Owner</div>
                        </div>
                    </>
                )}
            </div>
        );
    };
}
