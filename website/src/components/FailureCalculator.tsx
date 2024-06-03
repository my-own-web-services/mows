import { Component } from "preact";
import { CSSProperties } from "preact/compat";
import { Chart, Line } from "react-chartjs-2";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
} from "chart.js";
interface FailureCalculatorProps {
    readonly className?: string;
    readonly style?: CSSProperties;
}

interface FailureCalculatorState {
    readonly nodeCount: number;
    readonly machineComponents: MachineComponent[];
    readonly daysToFixNode: number;
}

interface MachineComponent {
    name: string;
    failProbPerYearPercent: number;
}

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const machineComponents: MachineComponent[] = [
    {
        name: "CPU",
        failProbPerYearPercent: 10
    },
    {
        name: "Cooling",
        failProbPerYearPercent: 10
    },
    {
        name: "Memory",
        failProbPerYearPercent: 10
    },
    {
        name: "Mainboard",
        failProbPerYearPercent: 10
    },
    {
        name: "Disk",
        failProbPerYearPercent: 50
    },
    {
        name: "Power Supply",
        failProbPerYearPercent: 25
    }
];

export default class FailureCalculator extends Component<
    FailureCalculatorProps,
    FailureCalculatorState
> {
    constructor(props: FailureCalculatorProps) {
        super(props);
        this.state = {
            nodeCount: 3,
            machineComponents: machineComponents,
            daysToFixNode: 14
        };
    }

    componentDidMount = async () => {};

    render = () => {
        const inputClass =
            "bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-1.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500";

        const labelClass = "block mb-2 text-sm font-medium text-gray-900 dark:text-white";

        const h2Class = "text-lg font-semibold text-gray-900 dark:text-white";

        return (
            <div
                style={{ ...this.props.style }}
                className={`FailureCalculator flex gap-8  flex-col m-12${
                    this.props.className ?? ""
                }`}
            >
                <div>
                    <h2 className={h2Class}>General</h2>
                    <div className={"flex gap-4"}>
                        <div className={"w-32"}>
                            <label for="node_count" className={labelClass}>
                                Node Count
                            </label>
                            <input
                                onChange={e => {
                                    //@ts-ignore
                                    this.setState({ nodeCount: parseInt(e.target.value) });
                                }}
                                min={1}
                                step={1}
                                max={100}
                                value={this.state.nodeCount}
                                type="number"
                                id="node_count"
                                className={inputClass}
                                placeholder="3"
                                required
                            />
                        </div>
                        <div className={"w-32"}>
                            <label for="days_to_fix_node" className={labelClass}>
                                Days to fix node
                            </label>
                            <input
                                onChange={e => {
                                    //@ts-ignore
                                    this.setState({ daysToFixNode: parseInt(e.target.value) });
                                }}
                                min={1}
                                step={1}
                                max={100}
                                value={this.state.daysToFixNode}
                                type="number"
                                id="days_to_fix_node"
                                className={inputClass}
                                placeholder="3"
                                required
                            />
                        </div>
                    </div>
                </div>
                <div>
                    <h2 className={h2Class}>Fail Probabilities per Year</h2>

                    <div className={"flex gap-4"}>
                        {this.state.machineComponents.map(component => {
                            return (
                                <div className={"w-24"}>
                                    <label for={component.name} className={labelClass}>
                                        {component.name}
                                    </label>
                                    <input
                                        onChange={e => {
                                            //@ts-ignore
                                            this.setState({
                                                machineComponents: this.state.machineComponents.map(
                                                    comp =>
                                                        comp.name === component.name
                                                            ? {
                                                                  name: comp.name,
                                                                  failProbPerYearPercent: clamp(
                                                                      // @ts-ignore
                                                                      parseFloat(e.target.value),
                                                                      0,
                                                                      100
                                                                  )
                                                              }
                                                            : comp
                                                )
                                            });
                                        }}
                                        min={0}
                                        step={0.1}
                                        max={100}
                                        value={component.failProbPerYearPercent}
                                        type="number"
                                        id={component.name}
                                        className={inputClass}
                                        placeholder="1"
                                        required
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div>
                    <Line
                        options={{
                            responsive: true,
                            plugins: {
                                legend: {
                                    position: "top" as const
                                },
                                title: {
                                    display: true,
                                    text: "Prob"
                                }
                            }
                        }}
                        data={{
                            datasets: [
                                {
                                    data: [
                                        {
                                            x: 1,
                                            y: 2
                                        }
                                    ]
                                }
                            ]
                        }}
                    />
                </div>
            </div>
        );
    };
}

const clamp = (num: number, min: number, max: number) => {
    return Math.min(Math.max(num, min), max);
};

const binomialCoefficient = (n: number, k: number) => {
    if (k > n) return 0;
    let coeff = 1;
    for (let i = 0; i < k; i++) {
        coeff *= (n - i) / (i + 1);
    }
    return coeff;
};

export const calcNodeFailProbPerDay = (components: MachineComponent[]) => {
    let nodeFailProbPerDay = 1;

    components.forEach(component => {
        nodeFailProbPerDay *= 1 - component.failProbPerYearPercent / 365;
    });
    return 1 - nodeFailProbPerDay;
};

export const calcsysFailProbPerDay = (nodeCount: number, nodeFailProbPerDay: number) => {
    const nodesToFail = Math.floor(nodeCount / 2) + (nodeCount % 2);

    let sysFailProb = 0;
    for (let i = nodesToFail; i <= nodeCount; i++) {
        sysFailProb +=
            binomialCoefficient(nodeCount, i) *
            Math.pow(nodeFailProbPerDay, i) *
            Math.pow(1 - nodeFailProbPerDay, nodeCount - i);
    }

    return sysFailProb;
};

const calcNDayProb = (nodeCount: number, nodeFailProbPerDay: number, days: number) => {
    const nodesToFail = Math.floor(nodeCount / 2) + (nodeCount % 2);
    let sysFailProbAtDayN = 0;
    let sysFailProbLastDay = 0;

    for (let j = 0; j < days; j++) {
        let sysFailProbCurrentDay = 0;
        for (let i = nodesToFail; i <= nodeCount; i++) {
            sysFailProbCurrentDay +=
                binomialCoefficient(nodeCount, i) *
                Math.pow(nodeFailProbPerDay, i) *
                Math.pow(1 - nodeFailProbPerDay, nodeCount - i) *
                (1 - sysFailProbLastDay);
        }
        sysFailProbLastDay = sysFailProbCurrentDay;

        sysFailProbAtDayN += sysFailProbCurrentDay;
    }

    return sysFailProbAtDayN;
};
