import { Component, JSX } from "preact";
import { BsFillGridFill, BsFillSquareFill } from "react-icons/bs";
import { FaThList } from "react-icons/fa";
import App from "../../../../../App";
import { View } from "../../Center";
import "./SelectView.scss";

export interface SelectViewOption {
    name: View;
    icon: JSX.Element;
}

const defaultSelectViewOptions: SelectViewOption[] = [
    {
        name: "Grid" as View.Grid,
        icon: <BsFillGridFill size={16.5} />
    },
    {
        name: "List" as View.List,
        icon: <FaThList size={16.5} />
    },
    {
        name: "Single" as View.Single,
        icon: <BsFillSquareFill />
    }
];

interface SelectViewProps {
    readonly options?: SelectViewOption[];
    readonly selectCenterView: App["selectCenterView"];
    readonly selectedView: View;
}
interface SelectViewState {}
export default class SelectView extends Component<SelectViewProps, SelectViewState> {
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
                                this.props.selectedView === option.name ? " selected" : ""
                            }${" " + option.name}`}
                            onClick={() => this.props.selectCenterView(option.name)}
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
