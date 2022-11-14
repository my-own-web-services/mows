import { Component } from "preact";
import { VisualFileGroup, VisualFileGroupType } from "../../utils/convertFileGroups";
import "./Group.scss";
import { IoMdArrowDropdown, IoMdArrowDropright } from "react-icons/io";
import { VscFolderLibrary, VscFolder, VscRootFolder } from "react-icons/vsc";
import { FileGroupType } from "../../types";

interface GroupProps {
    fileGroup: VisualFileGroup;
}
interface GroupState {}
export default class Group extends Component<GroupProps, GroupState> {
    render = () => {
        const g = this.props.fileGroup;
        const isOpen = g.isOpen;
        return (
            <div
                className="Group"
                style={{
                    marginLeft: g.depth * 20
                }}
            >
                {isOpen ? (
                    <IoMdArrowDropdown></IoMdArrowDropdown>
                ) : (
                    <IoMdArrowDropright></IoMdArrowDropright>
                )}
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
                <span style={{ marginLeft: "5px", verticalAlign: "1px" }}>{g.name}</span>
            </div>
        );
    };
}
