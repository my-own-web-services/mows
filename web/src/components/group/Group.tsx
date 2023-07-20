import { Component } from "preact";
import { VisualFileGroup, VisualFileGroupType } from "../../utils/convertFileGroups";
import "./Group.scss";
import { IoMdArrowDropdown, IoMdArrowDropright } from "react-icons/io";
import { VscFolderLibrary, VscFolder, VscRootFolder } from "react-icons/vsc";
import { G } from "../../App";
import { FileGroupType } from "@firstdorsal/filez-client";

interface GroupProps {
    readonly fileGroup: VisualFileGroup;
    readonly g: G;
    readonly isSelected: boolean;
}
interface GroupState {}
export default class Group extends Component<GroupProps, GroupState> {
    render = () => {
        const g = this.props.fileGroup;
        const isOpen = g.isOpen;
        return (
            <div
                onDblClick={() => {
                    this.props.g.fn.groupDoubleClick(g);
                }}
                className={`Group${this.props.isSelected ? " selected" : ""}`}
            >
                <div
                    style={{
                        marginLeft: g.depth * 20
                    }}
                >
                    <span
                        onClick={() => {
                            this.props.g.fn.groupArrowClick(g);
                        }}
                    >
                        {isOpen ? (
                            <IoMdArrowDropdown></IoMdArrowDropdown>
                        ) : (
                            <IoMdArrowDropright></IoMdArrowDropright>
                        )}
                    </span>
                    <span>
                        {(() => {
                            const fgt = g.fileGroup?.groupType;
                            if (g.type === VisualFileGroupType.FileGroupFolder) {
                                return <VscFolderLibrary></VscFolderLibrary>;
                            } else if (fgt === FileGroupType.Static) {
                                return <VscFolder></VscFolder>;
                            } else if (fgt === FileGroupType.Dynamic) {
                                return <VscRootFolder></VscRootFolder>;
                            }
                        })()}
                    </span>
                    <span style={{ marginLeft: "5px", verticalAlign: "1px" }}>{g.name}</span>
                    <span style={{ marginLeft: "5px", opacity: "0.5" }}>{g.itemCount}</span>
                </div>
            </div>
        );
    };
}
