import { FilezFile } from "@firstdorsal/filez-client";
import { CSSProperties, PureComponent } from "react";
import { InputPicker, TagPicker } from "rsuite";
import Input from "rsuite/Input";
import { ItemDataType } from "rsuite/esm/@types/common";

interface MetaEditorProps {
    readonly file?: FilezFile;
    readonly style?: CSSProperties;
}

interface MetaEditorState {
    readonly possibleOwners: ItemDataType[];
    readonly name: string;
    readonly ownerId: string;
    readonly keywords: string[];
    readonly knownKeywords: string[];
}

export default class MetaEditor extends PureComponent<MetaEditorProps, MetaEditorState> {
    constructor(props: MetaEditorProps) {
        super(props);
        this.state = {
            possibleOwners: [],
            name: "",
            ownerId: "",
            keywords: [],
            knownKeywords: []
        };
    }

    componentDidMount = async () => {
        await this.loadFile();
    };

    componentDidUpdate = (
        prevProps: Readonly<MetaEditorProps>,
        prevState: Readonly<MetaEditorState>,
        snapshot?: any
    ) => {
        if (prevProps.file !== this.props.file) {
            this.loadFile();
        }
    };

    loadFile = async () => {
        if (!this.props.file) return;

        this.setState({
            name: this.props.file.name,
            possibleOwners: [{ value: this.props.file.ownerId, label: this.props.file.ownerId }],
            ownerId: this.props.file.ownerId,
            keywords: this.props.file.keywords,
            knownKeywords: []
        });
    };

    render = () => {
        if (!this.props.file) return;
        return (
            <div style={{ ...this.props.style }} className="Filez FileMetaEditor">
                <h5>Basics</h5>
                <div>
                    <label>Name</label>
                    <Input value={this.state.name} />
                </div>
                <div>
                    <label>Owner</label>
                    <br />
                    <InputPicker
                        block
                        virtualized
                        value={this.state.ownerId}
                        data={this.state.possibleOwners}
                    />
                </div>
                <div>
                    <label>Keywords</label>
                    <TagPicker
                        value={this.state.keywords}
                        data={this.state.knownKeywords.map(keyword => ({
                            value: keyword
                        }))}
                        block
                        virtualized
                    />
                </div>
            </div>
        );
    };
}
