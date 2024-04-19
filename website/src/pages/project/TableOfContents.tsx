import { Component } from "preact";
import { IoChevronBack, IoChevronForward } from "react-icons/io5";

interface TableOfContentsItem {
    title: string;
    href: string;
    children: TableOfContentsItem[];
}

const table: TableOfContentsItem[] = [
    {
        title: "Overview",
        href: "#Overview",
        children: []
    },
    {
        title: "Why?",
        href: "#Why",
        children: [
            {
                title: "Current Problems",
                href: "#WhyProblems",
                children: []
            }
        ]
    },
    {
        title: "How?",
        href: "#How",
        children: [
            {
                title: "One Vision, Five Parts",
                href: "#FiveParts",
                children: [
                    {
                        title: "Operator",
                        href: "#FivePartsOperator",
                        children: []
                    },
                    {
                        title: "Manager",
                        href: "#FivePartsManager",
                        children: []
                    },
                    {
                        title: "Hardware",
                        href: "#FivePartsHardware",
                        children: []
                    },
                    {
                        title: "Cloud APIs",
                        href: "#FivePartsCloudAPIs",
                        children: []
                    },
                    {
                        title: "Apps",
                        href: "#FivePartsApps",
                        children: []
                    }
                ]
            }
        ]
    },
    {
        // make this vision a reality
        title: "Contribute",
        href: "#Contribute",
        children: [
            {
                title: "Work",
                href: "#ContributeWork",
                children: []
            },
            {
                title: "Donations",
                href: "#ContributeDonations",
                children: []
            },
            {
                title: "Feedback",
                href: "#ContributeFeedback",
                children: []
            }
        ]
    },
    {
        title: "Progress",
        href: "#Progress",
        children: []
    },
    {
        title: "FAQ",
        href: "#FAQ",
        children: []
    }
];
// flatten table and rename titles of nested items to include parent titles
const flattenTable = (table: TableOfContentsItem[]): TableOfContentsItem[] => {
    return table.flatMap(item => [item, ...flattenTable(item.children)]);
};

const flatTable = flattenTable(table);

interface TableOfContentsProps {
    readonly className?: string;
    readonly mode: "desktop" | "mobile";
    readonly onExpandFlip?: () => void;
}
interface TableOfContentsState {
    readonly currentSection: string;
    readonly reachedEnd: boolean;
    readonly reachedStart: boolean;
}
export default class TableOfContents extends Component<TableOfContentsProps, TableOfContentsState> {
    constructor(props: TableOfContentsProps) {
        super(props);
        this.state = {
            currentSection: "",
            reachedEnd: false,
            reachedStart: true
        };
    }

    componentDidMount = () => {
        const observer = new IntersectionObserver(
            entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && entry.target.id.length) {
                        this.setState({ currentSection: "#" + entry.target.id });
                    }
                });
            },
            {
                threshold: 0.5
            }
        );

        document.querySelectorAll("div, section").forEach(section => {
            observer.observe(section);
        });
    };

    TableOfContentsItem = (item: TableOfContentsItem, nesting: number) => {
        return (
            <div
                key={item.href}
                className="TableOfContentsItem"
                style={{
                    marginTop: nesting === 0 ? "10px" : "",
                    marginLeft: nesting * 10
                }}
            >
                <svg
                    className={"inline -mt-1 w-3 h-3 mr-3"}
                    width="101"
                    height="101"
                    viewBox="0 0 101 101"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        d="M7.54639 26.0689L50.3477 1.35762L93.1489 26.0689V75.4916L50.3477 100.203L7.54639 75.4916L7.54639 26.0689Z"
                        fill={
                            this.state.currentSection === item.href
                                ? "var(--c-hl2)"
                                : "var(--c-hl1)"
                        }
                    />
                </svg>

                <a
                    href={item.href}
                    style={{
                        color:
                            this.state.currentSection === item.href
                                ? "var(--c-hl2)"
                                : "var(--c-text-dim)"
                    }}
                    className="text-primary whitespace-nowrap overflow-hidden text-ellipsis"
                    onClick={e => {
                        e.preventDefault();

                        document.querySelector(item.href)?.scrollIntoView({
                            behavior: "smooth"
                        });
                        this.setState({ currentSection: item.href });

                        history.pushState(null, "", item.href);
                    }}
                >
                    {item.title}
                </a>
                {item.children.length > 0 && (
                    <div>
                        {item.children.map(item => this.TableOfContentsItem(item, nesting + 1))}
                    </div>
                )}
            </div>
        );
    };

    jumpToSection = (direction: boolean) => {
        const currentIndex = flatTable.findIndex(item => item.href === this.state.currentSection);
        const newIndex = currentIndex + (direction ? 1 : -1);
        if (newIndex < 0 || newIndex >= flatTable.length) return;

        const newSection = flatTable[newIndex].href;
        document.querySelector(newSection)?.scrollIntoView({
            behavior: "smooth"
        });
        this.setState({
            currentSection: newSection,
            reachedEnd: newIndex === flatTable.length - 1,
            reachedStart: newIndex === 0
        });
        history.pushState(null, "", newSection);
    };

    MobileSwitchThrough = () => {
        return (
            <div className={"MobileSwitchThrough flex justify-between flex-grow"}>
                <button
                    onClick={() => this.jumpToSection(false)}
                    className={`block md:hidden ${
                        this.state.reachedStart ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                >
                    <IoChevronBack size={35} />
                </button>
                <button className={"flex items-center max-w-36"} onClick={this.props.onExpandFlip}>
                    <span
                        className={
                            "w-full overflow-hidden whitespace-nowrap text-ellipsis font-bold "
                        }
                    >
                        {flatTable.find(item => item.href === this.state.currentSection)?.title ??
                            "Overview"}
                    </span>
                </button>
                <button
                    onClick={() => this.jumpToSection(true)}
                    className={`block md:hidden
                ${this.state.reachedEnd ? "opacity-50 cursor-not-allowed" : ""}
                `}
                >
                    <IoChevronForward size={35} />
                </button>
            </div>
        );
    };

    render = () => {
        return (
            <div className={`TableOfContents ${this.props.className ?? ""} select-none`}>
                {this.props.mode === "desktop" && (
                    <aside
                        className={`fixed hidden 2xl:flex top-0 left-0 h-full w-72 flex-col justify-center pl-8 overflow-hidden text-sm whitespace-nowrap text-ellipsis`}
                    >
                        {table.map(item => this.TableOfContentsItem(item, 0))}
                    </aside>
                )}

                {this.props.mode === "mobile" && this.MobileSwitchThrough()}
            </div>
        );
    };
}
