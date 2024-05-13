import { Component } from "preact";
import HashNavLink from "../../../../components/HashNavLink";
import basicsLine from "../../../../assets/basics.svg";
import { CSSProperties } from "react";

const basics = [
    {
        title: "Easy to Use",
        description:
            "MOWS is designed to be easy to set up and operate. It's designed to be usable by everyone, on any device, everywhere.",
        imageName: "easy",
        top: 0,
        left: 200,
        width: 332,
        classesLg: "md:top-[0px] md:left-[200px] md:w-[332px]"
    },
    {
        title: "Reliable",
        description:
            "MOWS is built to run across multiple computers, so it's highly reliable, and designed to keep on working after a failure, even when you are not around.",
        imageName: "reliable",
        top: 177,
        left: 295,
        width: 395,
        classesLg: "md:top-[177px] md:left-[295px] md:w-[395px]"
    },
    {
        title: "Secure",
        description:
            "Application isolation is at the core of the MOWS ecosystem, ensuring that no bit can escape your control. Full encryption at rest ensures that your data cannot be stolen physically.",
        imageName: "secure",
        top: 360,
        left: 200,
        width: 456,
        classesLg: "md:top-[360px] md:left-[200px] md:w-[456px]"
    },
    {
        title: "Private",
        description:
            "Reclaim privacy by storing your data locally again, while not losing the amenities of modern web applications that are usable on—and synced to—every device.",
        imageName: "private",
        top: 525,
        left: 400,
        width: 422,
        classesLg: "md:top-[525px] md:left-[400px] md:w-[422px]"
    },
    {
        title: "Open",
        description:
            "The open nature of MOWS makes it impossible to get locked in to one provider. No centralized app store can tell you what to do. MOWS is licensed under GNU AGPL v3.",
        imageName: "open",
        top: 700,
        left: 295,
        width: 441,
        classesLg: "md:top-[700px] md:left-[295px] md:w-[441px]"
    },
    {
        title: "Developer-Friendly",
        description:
            "MOWS streamlines app development by offering a variety of essential APIs, sparing developers repetitive, cluttered groundwork while creating awesome integrated web services.",
        imageName: "developer_friendly",
        top: 866,
        left: 295,
        width: 473,
        classesLg: "md:top-[866px] md:left-[295px] md:w-[473px]"
    },
    {
        title: "Comprehensive",
        description:
            "MOWS is a holistic solution for a lot of challenges in the current software ecosystem regarding privacy, ease of use, compatibility, reliability, easy app development (while preserving privacy) and many more.",
        imageName: "comprehensive",
        top: 1052,
        left: 200,
        width: 550,
        classesLg: "md:top-[1052px] md:left-[200px] md:w-[550px]"
    },
    {
        title: "Scalable",
        description:
            "No matter if you are starting in a home lab or in a data center, MOWS scales with your needs. It is designed to run on multiple computers but can also run on a single one. MOWS can run on any machine that can run Linux.",
        imageName: "scalable",
        top: 1230,
        left: 295,
        width: 574,
        classesLg: "md:top-[1230px] md:left-[295px] md:w-[574px]"
    }
];

interface DifferencesProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly id?: string;
}
interface DifferencesState {}
export default class Differences extends Component<DifferencesProps, DifferencesState> {
    render = () => {
        return (
            <section
                style={{ ...this.props.style }}
                className={`Differences ${this.props.className ?? ""}`}
                id={this.props.id}
            >
                <HashNavLink className={this.props.id}>
                    <h1>What makes MOWS different?</h1>
                </HashNavLink>

                <div className={"basicsLine md:relative md:-ml-4 mt-10 lg:w-[860px] lg:mx-auto"}>
                    <img
                        width={352}
                        height={1406}
                        draggable={false}
                        loading={"lazy"}
                        className={"glow md:block hidden md:ml-5 lg:ml-0 lg:mt-2"}
                        src={basicsLine}
                        alt=""
                    />

                    {basics.map(({ title, description, imageName, classesLg }) => (
                        <div
                            key={title}
                            className={`Differences${title.replace(
                                / /g,
                                ""
                            )} md:absolute ${classesLg} md:block text-center md:text-left my-10 md:my-0 md:-mt-5 lg:mt-0`}
                        >
                            <img
                                className={"md:hidden glow mx-auto"}
                                width={100}
                                height={100}
                                draggable={false}
                                loading={"lazy"}
                                src={`/assets/different/basics_single/${imageName}.svg`}
                                alt=""
                            />
                            <HashNavLink className={`Differences${title.replace(/ /g, "")}`}>
                                <h3>{title}</h3>
                            </HashNavLink>
                            <p className={"glow md:w-[360px] lg:w-[inherit]"}>{description}</p>
                        </div>
                    ))}
                </div>
            </section>
        );
    };
}
