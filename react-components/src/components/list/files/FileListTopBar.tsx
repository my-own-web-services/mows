import { PureComponent } from "react";
import { AiOutlineSearch } from "react-icons/ai";
import { ButtonGroup, IconButton, Input, InputGroup } from "rsuite";
import { BsFillGridFill } from "react-icons/bs";
import { FaThList } from "react-icons/fa";

interface FileListTopBarProps {}

interface FileListTopBarState {}

export default class FileListTopBar extends PureComponent<
    FileListTopBarProps,
    FileListTopBarState
> {
    constructor(props: FileListTopBarProps) {
        super(props);
        this.state = {};
    }

    render = () => {
        return (
            <div style={{ width: "100%", height: "40px" }} className="FileListTopBar">
                <InputGroup size="sm" inside style={{ width: "200px", float: "left" }}>
                    <Input title="Search File Groups" placeholder="Search Files" />
                    <InputGroup.Button>
                        <AiOutlineSearch size={21} />
                    </InputGroup.Button>
                </InputGroup>
                <span className="Buttons">
                    <ButtonGroup size="xs">
                        <IconButton
                            title="New File Group"
                            icon={<FaThList style={{ transform: "scale(0.9)" }} size={17} />}
                        />
                        <IconButton
                            title="Reload Groups"
                            icon={<BsFillGridFill style={{ transform: "scale(0.9)" }} size={17} />}
                        />
                    </ButtonGroup>
                </span>
            </div>
        );
    };
}
