import { Component } from "preact";
import { G } from "../../App";
import { Modal, Button, Toggle, Input, SelectPicker } from "rsuite";
import update from "immutability-helper";
import {
    CreateGroupRequestGroupType,
    DynamicGroupRule,
    DynamicGroupRuleType,
    FileGroupType
} from "@firstdorsal/filez-client";
interface CreateGroupModalProps {
    readonly g: G;
    readonly isOpen: boolean;
    readonly onClose: () => void;
}
interface CreateGroupModalState {
    readonly name: string;
    readonly dynamic: boolean;
    readonly dynamicRules?: DynamicGroupRule;
}

const ruleTypes = [
    { label: "Match Regex", value: DynamicGroupRuleType.MatchRegex },
    { label: "Not Match Regex", value: DynamicGroupRuleType.NotMatchRegex }
];

export default class CreateGroupModal extends Component<
    CreateGroupModalProps,
    CreateGroupModalState
> {
    constructor(props: CreateGroupModalProps) {
        super(props);
        this.state = {
            name: "",
            dynamic: false,
            dynamicRules: {
                field: "",
                ruleType: DynamicGroupRuleType.MatchRegex,
                value: ""
            }
        };
    }

    createGroup = async () => {
        const createGroupRes = await this.props.g.filezClient.create_group({
            name: this.state.name,
            groupType: CreateGroupRequestGroupType.File
        });

        const updateGroupRes = await this.props.g.filezClient.update_file_group({
            fileGroupId: createGroupRes.groupId,
            newName: this.state.name,
            newGroupType: this.state.dynamic ? FileGroupType.Dynamic : FileGroupType.Static,
            newDynamicGroupRules: this.state.dynamicRules
        });

        this.props.onClose();
    };

    render = () => {
        return (
            <div className="CreateGroupModal">
                <Modal
                    aria-labelledby=""
                    aria-describedby=""
                    open={this.props.isOpen}
                    onClose={this.props.onClose}
                    size="md"
                >
                    <Modal.Header>
                        <h1>Create Group</h1>
                    </Modal.Header>
                    <Modal.Body>
                        <Input
                            onChange={c => this.setState({ name: c })}
                            placeholder="Name"
                        ></Input>
                        <br />
                        <br />
                        <span>Dynamic</span>{" "}
                        <Toggle onChange={c => this.setState({ dynamic: c })} />
                        <br />
                        <br />
                        {this.state.dynamic && (
                            <>
                                <h2>Dynamic Rules</h2>
                                <div>
                                    <Input
                                        onChange={c => {
                                            this.setState(() => {
                                                return update(this.state, {
                                                    dynamicRules: {
                                                        field: { $set: c }
                                                    }
                                                });
                                            });
                                        }}
                                        style={{ width: "200px", display: "inline-block" }}
                                        placeholder="Field"
                                    ></Input>
                                    <SelectPicker
                                        onChange={c => {
                                            if (!c) {
                                                return;
                                            }
                                            this.setState(() => {
                                                return update(this.state, {
                                                    dynamicRules: {
                                                        ruleType: { $set: c }
                                                    }
                                                });
                                            });
                                        }}
                                        style={{ width: "200px", display: "inline-block" }}
                                        data={ruleTypes}
                                        placeholder="Rule Type"
                                    ></SelectPicker>
                                    <Input
                                        onChange={c => {
                                            this.setState(() => {
                                                return update(this.state, {
                                                    dynamicRules: {
                                                        value: { $set: c }
                                                    }
                                                });
                                            });
                                        }}
                                        style={{ width: "200px", display: "inline-block" }}
                                        placeholder="Value"
                                    ></Input>
                                </div>
                            </>
                        )}
                    </Modal.Body>
                    <Modal.Footer>
                        <Button onClick={this.createGroup} appearance="primary">
                            Ok
                        </Button>
                        <Button onClick={this.props.onClose} appearance="subtle">
                            Cancel
                        </Button>
                    </Modal.Footer>
                </Modal>
            </div>
        );
    };
}
