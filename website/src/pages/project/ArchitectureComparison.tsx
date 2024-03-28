import { Component } from "preact";

interface ProblemGroup {
    name: string;
    color?: string;
}

const problems = [
    { name: "Difficulty", color: "#9603f9ff" },
    { name: "Privacy", color: "#ff0000ff" },
    { name: "Reliability", color: "#ffdd00ff" },
    { name: "Cost" },
    { name: "Flexibility" },
    { name: "Custom applications" },
    { name: "Sovereignty" }
];

interface Concept {
    name: string;
    cons: {
        group: number;
        description: string;
    }[];
}

const concepts: Concept[] = [
    {
        name: "Corporate Cloud",
        cons: [
            {
                group: 1,
                description:
                    "Provider can do anything with your data. Everything you do is monitored and stored."
            },
            {
                group: 2,
                description:
                    "Data is hopefully backed up, but you can't be sure. The provider can terminate or delete your data at any time."
            },
            {
                group: 2,
                description:
                    "Internet connection is required. If the provider or your connection goes down, you can't access your data."
            },
            {
                group: 6,
                description:
                    "When using streaming services or buying digital content that you cant download unencrypted, you are at the mercy of the provider to give you access. Even if you bought a movie or song, you don't own it as it can vanish at any time."
            },
            {
                group: 4,
                description:
                    "You are locked in to the provider. You can't easily switch to another provider if you don't like it anymore."
            },
            {
                group: 5,
                description:
                    "You can't easily customize the services to your needs. You have to use the provider's limited applications. You can't run any custom applications."
            },
            {
                group: 3,
                description:
                    "If you have any larger amount of data, you will have to pay a lot for the storage."
            }
        ]
    },
    {
        name: "Mostly Local",
        cons: [
            {
                group: 1,
                description:
                    "You are at least still using a corporate provider for your mail but most likely also many other online services."
            },
            {
                group: 0,
                description:
                    "You have to manage each system and it's data manually, data is not synchronized between devices."
            },
            {
                group: 2,
                description:
                    "No backups of your data, you will have to manage that yourself. Most people don't or do it poorly."
            },
            {
                group: 0,
                description: "No easy method to share larger amounts of data with others."
            }
        ]
    },
    {
        name: "Single Rented server",
        cons: [
            {
                group: 3,
                description:
                    "If you have any larger amount of data, you will have to pay a lot for the storage."
            },
            {
                group: 2,
                description:
                    "Internet connection is required. If the provider or your connection goes down, you can't access your data."
            },
            {
                group: 2,
                description: "No real backups of your data, you will have to manage that yourself."
            },
            {
                group: 0,
                description:
                    "You have to manage the system and its services yourself. This is not easy for most people and takes lots of time."
            }
        ]
    },
    {
        name: "Single Local server",
        cons: [
            {
                group: 0,
                description:
                    "You have to manage the system and its services yourself. This is not easy for most people and takes lots of time."
            },
            {
                group: 2,
                description: "No real backups of your data, you will have to manage that yourself."
            },
            {
                group: 2,
                description:
                    "If your server goes down you have to fix it yourself as soon as possible to keep your services running. Bad luck if you are on vacation."
            }
        ]
    },
    {
        name: "Multiple Local Servers",
        cons: [
            {
                group: 0,
                description:
                    "You have to manage the system and its services yourself. This is not easy for most people and takes lots of time. Manually managing multiple servers is even more complex."
            },
            {
                group: 2,
                description: "No real backups of your data, you will have to manage that yourself."
            }
        ]
    },
    {
        name: "MOWS",
        cons: []
    }
];

interface ArchitectureComparisonProps {}
interface ArchitectureComparisonState {
    readonly selectedConcept: number;
}
export default class ArchitectureComparison extends Component<
    ArchitectureComparisonProps,
    ArchitectureComparisonState
> {
    constructor(props: ArchitectureComparisonProps) {
        super(props);
        this.state = {
            selectedConcept: 0
        };
    }

    selectConcept = (selectedProblem: number) => {
        this.setState({ selectedConcept: selectedProblem });
    };

    render = () => {
        return (
            <div className="ArchitectureComparison">
                <div className={"comparison"}>
                    <div className={"picker"}>
                        {concepts.map((p, index) => {
                            return (
                                <button onClick={() => this.selectConcept(index)}>
                                    <span
                                        style={{
                                            borderBottom:
                                                index === this.state.selectedConcept
                                                    ? "3px solid var(--c-hl1)"
                                                    : "3px solid transparent"
                                        }}
                                    >
                                        {p.name}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    <div className={"architectureDisplayViewer"}>
                        <div className={"architectureDisplay"}>
                            <img
                                src={`/assets/architecture-problems/concept_${
                                    this.state.selectedConcept + 1
                                }.svg`}
                                width={600}
                                height={600}
                                alt=""
                            />
                        </div>
                        <div className={"writtenProblems"}>
                            {concepts[this.state.selectedConcept].cons
                                .sort((a, b) => a.group - b.group)
                                .map(c => {
                                    const isFirst =
                                        concepts[this.state.selectedConcept].cons.find(
                                            x => x.group === c.group
                                        ) === c;

                                    return (
                                        <ul className={"con"}>
                                            {isFirst ? (
                                                <div>
                                                    <div
                                                        style={{
                                                            height: 10,
                                                            width: 10,
                                                            background:
                                                                problems[c.group].color ??
                                                                "var(--c-text)",
                                                            float: "left",
                                                            marginTop: 8,
                                                            marginRight: 8,
                                                            borderRadius: "50%",
                                                            transform: "scale(1.5)"
                                                        }}
                                                    ></div>
                                                    <h4>{problems[c.group].name}</h4>
                                                </div>
                                            ) : null}
                                            <li>- {c.description}</li>
                                        </ul>
                                    );
                                })}
                        </div>
                    </div>
                </div>
            </div>
        );
    };
}
