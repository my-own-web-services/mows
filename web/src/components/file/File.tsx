import { Component } from "preact";
import "./File.scss";
interface FileProps {}
interface FileState {}
export default class File extends Component<FileProps, FileState> {
    render = () => {
        return <div className="File"></div>;
    };
}
