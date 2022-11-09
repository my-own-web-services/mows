import { Component, JSX } from "preact";
import { BsFillGrid1X2Fill, BsFillGridFill, BsFillSquareFill } from "react-icons/bs";
import { FaThList } from "react-icons/fa";
import "./SelectView.scss";

export interface SelectViewOption {
    name: string;
    icon: JSX.Element;
}

const defaultSelectViewOptions: SelectViewOption[] = [
    {
        name: "Sheets",
        icon: <BsFillGrid1X2Fill />
    },
    {
        name: "Grid",
        icon: <BsFillGridFill size={16.5} />
    },
    {
        name: "List",
        icon: <FaThList size={16.5} />
    },
    {
        name: "Single",
        icon: <BsFillSquareFill />
    }
];

interface SelectViewProps {
    options?: SelectViewOption[];
}
interface SelectViewState {
    selectedOption: number;
}
export default class SelectView extends Component<SelectViewProps, SelectViewState> {
    constructor(props: SelectViewProps) {
        super(props);
        this.state = {
            selectedOption: 0
        };
    }
    render = () => {
        const options = this.props.options
            ? defaultSelectViewOptions.concat(this.props.options)
            : defaultSelectViewOptions;
        return (
            <div id="SelectView">
                {options.map((option, i) => {
                    return (
                        <button
                            className={`SelectViewOption${
                                this.state.selectedOption === i ? " selected" : ""
                            }${" " + option.name}`}
                            onClick={() => {
                                this.setState({ selectedOption: i });
                            }}
                            title={option.name}
                        >
                            {option.icon}
                        </button>
                    );
                })}
            </div>
        );
    };
}
