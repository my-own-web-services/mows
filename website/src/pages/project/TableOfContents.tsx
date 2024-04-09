import { Component } from "preact";

interface TableOfContentsItem {
    title: string;
    href: string;
    children: TableOfContentsItem[];
}

const table: TableOfContentsItem[] = [
    {
        title: "Introduction",
        href: "#MOWS",
        children: []
    },
    {
        title: "Why?",
        href: "#Why",
        children: [
            {
                title: "Problems With Current Architectures",
                href: "#WhyProblems",
                children: []
            },
            {
                title: "What Makes MOWS Different?",
                href: "#WhyDifferent",
                children: []
            }
        ]
    },
    {
        title: "How?",
        href: "#How",
        children: [
            {
                title: "One Vision, Many Parts",
                href: "#HowManyParts",
                children: [
                    {
                        title: "Operator",
                        href: "#HowManyPartsOperator",
                        children: []
                    },
                    {
                        title: "Manager",
                        href: "#HowManyPartsManager",
                        children: []
                    },
                    {
                        title: "Hardware",
                        href: "#HowManyPartsHardware",
                        children: []
                    },
                    {
                        title: "Cloud APIs",
                        href: "#HowManyPartsCloudAPIs",
                        children: []
                    },
                    {
                        title: "Apps",
                        href: "#HowManyPartsApps",
                        children: []
                    }
                ]
            }
        ]
    },

    {
        title: "Contributing",
        href: "#Contributing",
        children: []
    }
];

interface TableOfContentsProps {}
interface TableOfContentsState {
    readonly currentSection: string;
}
export default class TableOfContents extends Component<TableOfContentsProps, TableOfContentsState> {
    constructor(props: TableOfContentsProps) {
        super(props);
        this.state = {
            currentSection: ""
        };
    }

    // handle this with an intersection observer
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
                    width="101"
                    height="101"
                    viewBox="0 0 101 101"
                    fill="none"
                    style={{ width: "10px", height: "10px", marginRight: "10px" }}
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
                    <div className="TableOfContentsChildren">
                        {item.children.map(item => this.TableOfContentsItem(item, nesting + 1))}
                    </div>
                )}
            </div>
        );
    };
    render = () => {
        return (
            <aside className="TableOfContents">
                {table.map(item => this.TableOfContentsItem(item, 0))}
            </aside>
        );
    };
}
