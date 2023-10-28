import { PureComponent, createRef } from "react";
import FileGroup from "./FileGroup";

interface CreateFileGroupProps {}

interface CreateFileGroupState {}

export default class CreateFileGroup extends PureComponent<
    CreateFileGroupProps,
    CreateFileGroupState
> {
    ref: React.RefObject<FileGroup>;

    constructor(props: CreateFileGroupProps) {
        super(props);
        this.state = {};

        this.ref = createRef();
    }

    create = async (): Promise<boolean> => {
        const res = await this.ref.current?.create();
        return res ? true : false;
    };

    render = () => {
        return (
            <div className="CreateFileGroup">
                <FileGroup ref={this.ref} />
            </div>
        );
    };
}
