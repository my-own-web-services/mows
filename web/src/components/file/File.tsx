import { Component } from "preact";
import { DraggableItem } from "../drag/DraggableItem";
import "./File.scss";
interface FileProps {}
interface FileState {}
export default class File extends Component<FileProps, FileState> {
    render = () => {
        return (
            <div className="File">
                <DraggableItem></DraggableItem>
            </div>
        );
    };
}
