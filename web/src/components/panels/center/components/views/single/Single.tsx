import { Component } from "preact";
import { G } from "../../../../../../App";
import { FileView, FilezFile } from "../../../../../../types";
import File from "../../../../../file/File";
import "./Single.scss";

interface SingleProps {
    readonly g: G;
}
interface SingleState {}
export default class Single extends Component<SingleProps, SingleState> {
    render = () => {
        return <div className="Single"></div>;
    };
}
