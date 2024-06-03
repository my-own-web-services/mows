import { Component } from "preact";
import { G } from "../../App";
import { FileView } from "../../types";
import { VisualFileGroup } from "../../utils/convertFileGroups";
import File from "../file/File";
import Group from "../group/Group";
import "./GroupOrFileItem.scss";
import { FilezFile } from "@firstdorsal/filez-client";
interface GroupOrFileItemProps {
    readonly fileGroup?: VisualFileGroup;
    readonly file?: FilezFile;
    readonly viewType?: FileView;
    readonly g: G;
    readonly itemWidth?: number;
}
interface GroupOrFileItemState {}
export default class GroupOrFileItem extends Component<GroupOrFileItemProps, GroupOrFileItemState> {
    render = () => {
        const isSelected = (() => {
            if (this.props.fileGroup) {
                return this.props.g.selectedGroups.includes(this.props.fileGroup);
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
                            if (this.props.fileGroup) {
                                return this.props.fileGroup;
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
                className={`GroupOrFileItem`}
            >
                {(() => {
                    if (this.props.fileGroup) {
                        return (
                            <Group
                                g={this.props.g}
                                isSelected={isSelected}
                                fileGroup={this.props.fileGroup}
                            ></Group>
                        );
                    } else if (this.props.file) {
                        if (!this.props.viewType) {
                            throw new Error(
                                "GroupOrFileItem: render: this.props.viewType is undefined"
                            );
                        }
                        return (
                            <File
                                itemWidth={this.props.itemWidth}
                                viewType={this.props.viewType}
                                isSelected={isSelected}
                                g={this.props.g}
                                file={this.props.file}
                            ></File>
                        );
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
