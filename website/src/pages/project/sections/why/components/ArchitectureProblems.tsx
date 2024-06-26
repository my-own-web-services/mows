import { Component } from "preact";

interface ProblemCategory {
    name: string;
    color?: string;
}

const problemCategories: ProblemCategory[] = [
    { name: "Difficulty", color: "#9603f9ff" },
    { name: "Privacy", color: "#ff0000ff" },
    { name: "Reliability", color: "#ffdd00ff" },
    { name: "Cost", color: "#00ffeeff" },
    { name: "Flexibility / Lock-in", color: "#ff00f6" },
    { name: "Sovereignty", color: "#ff2266ff" }
];

interface Concept {
    name: string;
    groups: number[];
    image: string;
    description: string;
    cons: {
        category: number;
        description: string;
        groups?: number[];
    }[];
}

const concepts: Concept[] = [
    {
        name: "Corporate Cloud",
        image: "consumer/concept_1.svg",
        description:
            "Your data is stored on the servers of a corporate cloud provider. You can use it through their web interface or their sync clients.",
        cons: [
            {
                category: 0,
                description:
                    "Sync clients can't be used on all devices. Provided web applications can't be extended or customized."
            },
            {
                category: 1,
                description:
                    "Providers can do anything with your data. Everything you do is monitored and stored."
            },
            {
                category: 2,
                description:
                    "Data is hopefully backed up, but you can't be sure. The provider can terminate or delete your data at any time. Effectively, you have no backups if you don't manage them yourself."
            },
            {
                category: 2,
                description:
                    "Internet connection is required. If the provider or your connection goes down, you can't access your data."
            },
            {
                category: 5,
                description:
                    "When using streaming services or buying digital content that you can't download unencrypted, you are at the mercy of the provider for access. Even if you bought a movie or song, you don't own it, and it can vanish at any time."
            },
            {
                category: 4,
                description:
                    "You are locked in to the provider. You can't easily switch to another provider if you don't like it anymore. This is often made difficult on purpose."
            },

            {
                category: 3,
                description:
                    "Sooner or later you will hit the free storage limit. After that, you have to pay a lot for the storage."
            }
        ],
        groups: [0]
    },
    {
        name: "Webspace",
        description:
            "You rent a webspace from a provider. You can run your own website with limited storage, performance and features.",
        cons: [
            {
                category: 4,
                description:
                    "You are locked in to the provider. You can't easily switch to another provider if you don't like their services anymore or outgrow of them. This is often made difficult on purpose. Migrating is difficult, time-consuming, error-prone and sometimes impossible."
            },
            {
                category: 2,
                description:
                    "No real backups of your data, you will have to manage that yourself. Backups of the provider can consume your already limited storage. The backups are often stored on the same webspace directory as the running service, when the server is compromised, the backups are too."
            },
            {
                category: 3,
                description:
                    "If you have larger amounts of data, you will have to pay a lot for the storage."
            },
            {
                category: 3,
                description:
                    "For the price you pay, you get very limited storage and performance. You can't run custom applications or services outside of the provided ones."
            },
            {
                category: 0,
                description:
                    "Managing services and data is difficult. You have to use the provider's web interface, which is often limited and slow. These rarely upgraded service instances are often a security risk as they are difficult to maintain and configure securely in the first place."
            },
            {
                category: 1,
                description:
                    "The provider can not only monitor everything you do, but also everything your visitors do. This also can create compliance issues as you often have no idea where your visitors' data is stored or how it is used."
            }
        ],
        groups: [1],
        image: "provider/concept_1.svg"
    },
    {
        name: "Corporate Cloud APIS",
        description: "You build your application on the proprietary APIs of cloud providers.",
        cons: [
            {
                category: 4,
                description:
                    "Especially when building on the proprietary APIS of cloud providers, you are locked in to the provider. Your application is worthless without the provider. The provider can raise prices or terminate your service at any time, leaving you in the dust."
            },
            {
                category: 3,
                description:
                    "Cloud APIS are often very expensive making some business models unfeasible. The pricing is often difficult to understand and can change at any time."
            },
            {
                category: 1,
                description:
                    "The provider can not only monitor everything you do, but also everything your visitors do. This also can create compliance issues as you often have no idea where your visitors' data is stored or how it is used."
            }
        ],
        groups: [1],
        image: "provider/concept_2.svg"
    },
    {
        name: "Mostly Local",
        image: "consumer/concept_2.svg",
        description:
            "Your data is stored mostly locally on each device you use. You use corporate cloud services for mail and other services.",
        cons: [
            {
                category: 1,
                description:
                    "You are at least still using a corporate provider for your mail but most likely also many other online services."
            },
            {
                category: 0,
                description:
                    "You have to manage each system and its data manually, data is not synchronized between devices."
            },
            {
                category: 2,
                description:
                    "No backups of your data, you will have to manage that yourself. Most people don't or do it poorly."
            },
            {
                category: 0,
                description: "No easy method to share larger amounts of data with others."
            }
        ],
        groups: [0]
    },
    {
        name: "Single Rented server",
        image: "consumer/concept_3.svg",
        description: "You rent a server from a provider. You can run any service you want on it.",
        cons: [
            {
                category: 1,
                description:
                    "Privacy is better than with corporate cloud providers, but the server hardware provider can still access your data."
            },
            {
                category: 3,
                description:
                    "If you have larger amounts of data, you will have to pay a lot for the storage."
            },
            {
                category: 2,
                description:
                    "Internet connection is required. If the provider or your connection goes down, you can't access your data.",
                groups: [0]
            },
            {
                category: 2,
                description: "No real backups of your data, you will have to manage that yourself."
            },
            {
                category: 0,
                description:
                    "You have to manage the system and its services yourself. This is not easy and takes lots of time."
            }
        ],
        groups: [0, 1]
    },
    {
        name: "Single Local server",
        image: "consumer/concept_4.svg",
        description:
            "You run a single server at home or in your office. You can run any service you want on it.",
        cons: [
            {
                category: 0,
                description:
                    "You have to manage the system and its services yourself. This is not easy and takes lots of time."
            },
            {
                category: 2,
                description: "No real backups of your data, you will have to manage that yourself."
            },
            {
                category: 2,
                description:
                    "If your server goes down you have to fix it yourself as soon as possible to keep your services running. Bad luck if you are on vacation.",
                groups: [0]
            },
            {
                category: 2,
                description:
                    "If your server goes down you have to fix it yourself as soon as possible to keep your services running. Bad luck if your business relies on it.",
                groups: [1]
            }
        ],
        groups: [0, 1]
    },
    {
        name: "Multiple Local Servers",
        image: "consumer/concept_5.svg",
        description:
            "You run multiple servers at home or in your office. You can run any service you want on them.",
        cons: [
            {
                category: 0,
                description:
                    "You have to manage the system and its services yourself. This is not easy and takes lots of time. Manually managing multiple bare metal servers is very difficult."
            },
            {
                category: 2,
                description: "No real backups of your data, you will have to manage that yourself."
            }
        ],
        groups: [0, 1]
    },
    {
        name: "MOWS",
        image: "consumer/concept_6.svg",
        description:
            "MOWS handles all the complexity for you. You can run any service you want on it.",
        cons: [
            {
                category: 2,
                description:
                    "Backups can't be created off-site without an internet connection. There is no way around this."
            },
            {
                category: 2,
                description:
                    "If you lose your internet connection, your services go offline for the rest of the world, although most connections are very stable these days. You can still access your services and data locally. You can further increase availability by using multiple internet connections and/or business tariffs."
            },
            {
                category: 0,
                description:
                    "Managing your own email server can be made very easy regarding the technical concerns but unfortunately big providers sometimes block email servers, so you might need to contact them to get removed. The problem is that a few big providers have too much power and often aren't following standards. Things like this are big problems for the decentralization of the internet."
            }
        ],
        groups: [0, 1]
    }
];

const groupType = [
    {
        name: "Consumer"
    },
    {
        name: "Provider"
    }
];

interface ArchitectureProblemsProps {}
interface ArchitectureProblemsState {
    readonly selectedConcept: number;
    readonly selectedGroupType: number;
}
export default class ArchitectureProblems extends Component<
    ArchitectureProblemsProps,
    ArchitectureProblemsState
> {
    constructor(props: ArchitectureProblemsProps) {
        super(props);
        this.state = {
            selectedConcept: 0,
            selectedGroupType: 0
        };
    }

    selectConcept = (selectedConcept: number) => {
        this.setState({ selectedConcept });
    };

    selectGroupType = (selectedGroupType: number) => {
        // when changing the group type set the selected concept to the first one matching the new group type

        const selectedConcept = concepts.findIndex(c => c.groups.includes(selectedGroupType));

        this.setState({ selectedGroupType, selectedConcept });
    };

    render = () => {
        return (
            <div className="ArchitectureProblems">
                <div className={"pickers"}>
                    <div className={"groupPicker picker"}>
                        {groupType.flatMap((p, index) => {
                            return (
                                <button onClick={() => this.selectGroupType(index)}>
                                    <span
                                        className={"text-2xl"}
                                        style={{
                                            borderBottom:
                                                index === this.state.selectedGroupType
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
                    <div className={"picker"}>
                        {concepts.flatMap((p, index) => {
                            if (!p.groups.includes(this.state.selectedGroupType)) {
                                return null;
                            }
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
                </div>

                <div
                    className={
                        "architectureDisplay md:flex-row md:h-[850px] flex flex-col justify-between align-top mt-8"
                    }
                >
                    <div className={"imageBox md:max-w-[520px]"}>
                        <img
                            src={`/assets/architecture-problems/${
                                concepts[this.state.selectedConcept]?.image
                            }`}
                            className={"rounded-lg border-primary md:border-2"}
                            width={600}
                            height={600}
                            loading={"lazy"}
                            alt=""
                        />
                        <div className={"text-primaryDim mt-2 p-4"}>
                            {concepts[this.state.selectedConcept]?.description}
                        </div>
                    </div>
                    <ul className={"md:max-w-96 lg:max-w-[500px]"}>
                        {concepts[this.state.selectedConcept]?.cons
                            .sort((a, b) => a.category - b.category)
                            .flatMap(c => {
                                if (c.groups && !c.groups.includes(this.state.selectedGroupType)) {
                                    return null;
                                }
                                const isFirst =
                                    concepts[this.state.selectedConcept].cons.find(
                                        x => x.category === c.category
                                    ) === c;

                                return (
                                    <ul className={""}>
                                        {isFirst ? (
                                            <ul>
                                                <li
                                                    className={
                                                        "h-3 w-3 float-left mt-[8px] mr-[10px] ml-[5px] rounded-full transform scale-150"
                                                    }
                                                    style={{
                                                        background:
                                                            problemCategories[c.category].color ??
                                                            "var(--c-text)"
                                                    }}
                                                ></li>
                                                <li
                                                    className={
                                                        "font-bold text-xl mt-5 mb-1 text-primary"
                                                    }
                                                >
                                                    {problemCategories[c.category].name}
                                                </li>
                                            </ul>
                                        ) : null}
                                        <li className={"mb-4"}>{c.description}</li>
                                    </ul>
                                );
                            })}
                    </ul>
                </div>
            </div>
        );
    };
}
