import { Component } from "preact";
import { G } from "../../../App";
import { FileGroup } from "../../../types";
import { VisualFileGroup } from "../../../utils/convertFileGroups";
import CreateGroupModal from "../../group/CreateGroupModal";
import "./Left.scss";
import GroupList from "./list/GroupList";

interface LeftProps {
    readonly g: G;
    readonly groups: VisualFileGroup[];
}
interface LeftState {
    readonly createGroupModalOpen: boolean;
}
export default class Left extends Component<LeftProps, LeftState> {
    render = () => {
        return (
            <div id="main-panel-left" className="Left horizontal-panel panel">
                <button onClick={() => this.setState({ createGroupModalOpen: true })}>
                    Add Group
                </button>
                <CreateGroupModal
                    onClose={() => this.setState({ createGroupModalOpen: false })}
                    isOpen={this.state.createGroupModalOpen}
                    g={this.props.g}
                />
                <GroupList g={this.props.g} groups={this.props.groups}></GroupList>
            </div>
        );
    };
}
