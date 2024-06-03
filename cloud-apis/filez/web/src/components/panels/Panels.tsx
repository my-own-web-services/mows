import { Component, JSX } from "preact";
import Split from "react-split";
import "./Panels.scss";

interface PanelsProps {
    readonly left: JSX.Element;
    readonly center: JSX.Element;
    readonly right: JSX.Element;
    readonly strip: JSX.Element;
}
interface PanelsState {
    readonly splitVerticalSize: number;
    readonly splitHorizontalLeftSize: number;
    readonly splitHorizontalRightSize: number;
}
export default class Panels extends Component<PanelsProps, PanelsState> {
    constructor(props: PanelsProps) {
        super(props);
        this.state = {
            splitVerticalSize: 20,
            splitHorizontalLeftSize: 15,
            splitHorizontalRightSize: 15
        };
    }

    componentDidMount = () => {
        splitResetOnDoubleClick(this);
    };

    render = () => {
        return (
            <div id="Panels">
                <Split
                    gutterSize={5}
                    sizes={[100 - this.state.splitVerticalSize, this.state.splitVerticalSize]}
                    minSize={[500, 0]}
                    maxSize={[1000, 300]}
                    onDragEnd={e => {
                        if (e[1] != this.state.splitVerticalSize) {
                            this.setState({
                                splitVerticalSize: e[1]
                            });
                        }
                    }}
                    snapOffset={0}
                    direction="vertical"
                    id="split-vertical"
                >
                    <div id="main-panel">
                        <Split
                            cols={3}
                            gutterSize={5}
                            onDragEnd={e => {
                                if (e[0] != this.state.splitHorizontalLeftSize) {
                                    this.setState({
                                        splitHorizontalLeftSize: e[0]
                                    });
                                }

                                if (e[2] != this.state.splitHorizontalRightSize) {
                                    this.setState({
                                        splitHorizontalRightSize: e[2]
                                    });
                                }
                            }}
                            sizes={[
                                this.state.splitHorizontalLeftSize,
                                100 -
                                    this.state.splitHorizontalLeftSize -
                                    this.state.splitHorizontalRightSize,
                                this.state.splitHorizontalRightSize
                            ]}
                            minSize={[0, 300, 0]}
                            maxSize={[400, 10000, 400]}
                            snapOffset={0}
                            direction="horizontal"
                            id="split-horizontal"
                        >
                            {this.props.left}
                            {this.props.center}
                            {this.props.right}
                        </Split>
                    </div>
                    {this.props.strip}
                </Split>
            </div>
        );
    };
}

const splitResetOnDoubleClick = (t: Panels) => {
    const sv = document.getElementById("split-vertical");
    const svGutter = sv?.childNodes[1];

    const titleText = "Double click to reset";

    svGutter?.addEventListener("dblclick", () => {
        t.setState({ splitVerticalSize: 20 });
    });

    /*@ts-ignore*/
    svGutter?.setAttribute("title", titleText);

    const sh = document.getElementById("split-horizontal");
    const shGutter1 = sh?.childNodes[1];
    const shGutter2 = sh?.childNodes[3];

    /*@ts-ignore*/
    shGutter1?.setAttribute("title", titleText);
    /*@ts-ignore*/
    shGutter2?.setAttribute("title", titleText);

    shGutter1?.addEventListener("dblclick", () => {
        t.setState({ splitHorizontalLeftSize: 15 });
    });
    shGutter2?.addEventListener("dblclick", () => {
        t.setState({ splitHorizontalRightSize: 15 });
    });
};
