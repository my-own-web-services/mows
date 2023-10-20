import { PureComponent } from "react";
import { AiOutlineFolderAdd, AiOutlineSearch } from "react-icons/ai";
import { IoReloadSharp } from "react-icons/io5";
import { ButtonGroup, IconButton, Input, InputGroup } from "rsuite";
interface FileGroupListTopBarProps {}

interface FileGroupListTopBarState {}

export default class FileGroupListTopBar extends PureComponent<
    FileGroupListTopBarProps,
    FileGroupListTopBarState
> {
    constructor(props: FileGroupListTopBarProps) {
        super(props);
        this.state = {};
    }

    render = () => {
        return (
            <div
                className="Filez FileGroupListTopBar"
                style={{ width: "100%", height: "40px", padding: "5px" }}
            >
                <InputGroup size="sm" inside style={{ width: "200px", float: "left" }}>
                    <Input title="Search File Groups" placeholder="Search Groups" />
                    <InputGroup.Button>
                        <AiOutlineSearch size={21} />
                    </InputGroup.Button>
                </InputGroup>
                <span className="Buttons">
                    <ButtonGroup size="xs">
                        <IconButton
                            title="New File Group"
                            icon={
                                <AiOutlineFolderAdd size={17} style={{ transform: "scale(1.2)" }} />
                            }
                        />
                        <IconButton title="Reload Groups" icon={<IoReloadSharp size={17} />} />
                    </ButtonGroup>
                </span>
            </div>
        );
    };
}
