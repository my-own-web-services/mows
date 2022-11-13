import { Component } from "preact";
import "./Group.scss";

interface GroupProps {}
interface GroupState {}
export default class Group extends Component<GroupProps, GroupState> {
    render = () => {
        return <div className="Group"></div>;
    };
}
