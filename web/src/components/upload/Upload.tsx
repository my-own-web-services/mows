import { Component, createRef } from "preact";
import "./Upload.scss";
import { Modal, Button, Uploader, Checkbox, Input } from "rsuite";
import { G } from "../../App";
import { CreateGroupRequestGroupType } from "@firstdorsal/filez-client";

interface UploadProps {
    readonly g: G;
    readonly open: boolean;
    readonly closeModal: () => void;
}
interface UploadState {
    readonly fileList: any[];
    readonly addToUploadGroup: boolean;
    readonly uploadGroupName: string;
}
export default class Upload extends Component<UploadProps, UploadState> {
    uploader = createRef();

    constructor(props: UploadProps) {
        super(props);
        const a = new Intl.DateTimeFormat(undefined, {
            year: "numeric",
            month: "numeric",
            day: "numeric",
            hour: "numeric",
            minute: "numeric",
            hour12: false
        }).format(new Date());

        this.state = {
            fileList: [],
            addToUploadGroup: true,
            uploadGroupName: `upload-${a}`
        };
    }

    render = () => {
        const uploadUrl = `${this.props.g.filezClient.filezEndpoint}/api/create_file`;

        return (
            <div className="Upload">
                <Modal
                    aria-labelledby=""
                    aria-describedby=""
                    open={this.props.open}
                    onClose={this.props.closeModal}
                    size="md"
                >
                    <Modal.Header>
                        <h1>Upload Files</h1>
                    </Modal.Header>
                    <Modal.Body>
                        <Uploader
                            /* @ts-ignore */
                            onChange={fileList => {
                                this.setState({ fileList });
                            }}
                            autoUpload={false}
                            action={uploadUrl}
                            ref={this.uploader}
                            multiple
                        >
                            <div>
                                <span>Click or Drag files to this area to upload</span>
                            </div>
                        </Uploader>
                        <div>
                            <p style={{ display: "inline-block" }}>Add to Upload Group</p>
                            <Checkbox
                                style={{ display: "inline-block" }}
                                checked={this.state.addToUploadGroup}
                                onClick={value => {
                                    this.setState(state => ({
                                        addToUploadGroup: !state.addToUploadGroup
                                    }));
                                }}
                            />
                            <Input
                                disabled={!this.state.addToUploadGroup}
                                style={{ display: "inline-block", width: "400px" }}
                                placeholder="Name"
                                value={this.state.uploadGroupName}
                                onChange={value => {
                                    this.setState({
                                        uploadGroupName: value
                                    });
                                }}
                            />
                        </div>
                    </Modal.Body>
                    <Modal.Footer style={{ textAlign: "left" }}>
                        <Button
                            disabled={!this.state.fileList.length}
                            onClick={async () => {
                                let groupId: string | null = null;
                                // create group if needed
                                if (this.state.addToUploadGroup) {
                                    const res = await this.props.g.filezClient.create_group({
                                        name: this.state.uploadGroupName,
                                        groupType: CreateGroupRequestGroupType.File
                                    });
                                    groupId = res.groupId;
                                }

                                // upload files

                                for (const file of this.state.fileList) {
                                    const reader = new FileReader();
                                    reader.readAsArrayBuffer(file.blobFile);
                                    await new Promise(resolve =>
                                        reader.addEventListener("load", async event => {
                                            await this.props.g.filezClient.create_file(
                                                // @ts-ignore
                                                event.target.result,
                                                {
                                                    mimeType: file.blobFile.type,
                                                    name: file.blobFile.name,
                                                    ...(groupId && {
                                                        staticFileGroupIds: [groupId]
                                                    })
                                                }
                                            );

                                            resolve(true);
                                        })
                                    );
                                }
                            }}
                            appearance="primary"
                        >
                            Upload
                        </Button>
                        <Button onClick={this.props.closeModal} appearance="subtle">
                            Cancel
                        </Button>
                    </Modal.Footer>
                </Modal>
            </div>
        );
    };
}
