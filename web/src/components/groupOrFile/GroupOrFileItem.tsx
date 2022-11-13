import { Component } from "preact";
import { G } from "../../App";
import { FileGroup, FilezFile } from "../../types";
import "./GroupOrFileItem.scss";
interface GroupOrFileItemProps {
    readonly group?: FileGroup;
    readonly file?: FilezFile;
    readonly g: G;
}
interface GroupOrFileItemState {}
export default class GroupOrFileItem extends Component<GroupOrFileItemProps, GroupOrFileItemState> {
    render = () => {
        const isSelected = (() => {
            if (this.props.group) {
                return this.props.g.selectedGroups.includes(this.props.group);
            } else if (this.props.file) {
                return this.props.g.selectedFiles.includes(this.props.file);
            } else {
                throw new Error(
                    "GroupOrFileItem: render: this.props.group and this.props.file are both undefined"
                );
            }
        })();

        return (
            <div
                onClick={e =>
                    this.props.g.fn.itemClick(
                        (() => {
                            if (this.props.group) {
                                return this.props.group;
                            } else if (this.props.file) {
                                return this.props.file;
                            } else {
                                throw new Error(
                                    "GroupOrFileItem: render: this.props.group and this.props.file are both undefined"
                                );
                            }
                        })(),
                        isSelected,
                        e
                    )
                }
                className={`GroupOrFileItem${isSelected ? " selected" : ""}`}
            >
                {(() => {
                    if (this.props.group) {
                        return this.props.group.groupId;
                    } else if (this.props.file) {
                        return this.props.file.fileId;
                    } else {
                        throw new Error(
                            "GroupOrFileItem: render: this.props.group and this.props.file are both undefined"
                        );
                    }
                })()}
            </div>
        );
    };
}
