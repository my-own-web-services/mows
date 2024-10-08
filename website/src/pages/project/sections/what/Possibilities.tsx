import { Component } from "preact";
import { CSSProperties } from "react";
import HashNavLink from "../../../../components/HashNavLink";
import { removeNonAlphaNumericCharacters } from "../../../../utils/utils";
import Image from "../../../../components/Image";

interface Capability {
    readonly title: string;
    readonly description: string;
    readonly image?: string;
}

const capabilities: Capability[] = [
    {
        title: "Stream your PC!",
        description:
            "Stream any operating system to any device, wherever you are, without worrying about failing hardware when you just want to get work done. Make the most of your hardware, and never worry about losing your data or settings again.",
        image: "stream-desktop.webp"
    },
    {
        title: "Own your files!",
        description:
            "Search through all your data with any device at lightning speed. No more folders, external drives, or limited cloud services that train AI models with your data. Never loose a file again with automatic backups and finally have an easy way to share and collaborate on files. Extend your file cloud with any app that integrates with it and stop building up file backends for every new project.",
        image: "files.webp"
    },
    {
        title: "You've got mail!",
        description:
            "And it gets delivered right into your house, like in the good old days, but at the speed of light. No storage limits and more mail addresses than there are particles in the universe. No more eavesdropping, ads, tracking or full inboxes.",
        image: "mail.webp"
    },
    {
        title: "Password: 123456?",
        description:
            "Manage all your passwords and other secrets in one place, securely and easily accessible from all your devices. Great security, low effort, no subscription.",
        image: "passwords.webp"
    },
    {
        title: "Your home, your rules.",
        description:
            "Control all your smart home devices without the need for an internet connection, and without the fear of someone else turning your house and its robots against you!",
        image: "smart-home.webp"
    },
    {
        title: "Your media, your way.",
        description:
            "Store all your movies and music in one place, accessible from all your devices, without the need for a subscription. No more ads, censorship or taking away your bought content.",
        image: "movies.webp"
    },
    {
        title: "It's better together!",
        description:
            "Run your own game servers for any game that supports it. Play with your friends, wherever they are, without arbitrary player limits, only bound by your hardware.",
        image: "game-server.webp"
    },
    {
        title: "Ad-free everywhere!",
        description:
            "Block most ads and other creepy stuff on all your devices in all apps, network wide, without the need for a browser extension.",
        image: "ads.webp"
    },
    {
        title: "Wifi everywhere!",
        description:
            "Ditch the ISP's router and run your own, with better security, more features, and less spying. Use your cluster nodes as wifi access points, and roam freely without losing connection or buying another device. Provide free wifi to everyone around and profit from everyone else when you're out and about.",
        image: "wifi.webp"
    },
    {
        title: "Your personal assistant, not theirs.",
        description:
            "Get help with your daily tasks, as well as with work, without the need for a subscription or giving away your most personal data or that of your company.",
        image: "assistant.webp"
    },

    {
        title: "Unlimited gaming!",
        description:
            "Run PC, console and emulated games on your cluster and stream them to any device in your network without the need to stuff your living room full with old dying consoles and cables. Make the most of your hardware and never worry about losing your bought games, savegames or settings again.",
        image: "gaming.webp"
    }
];

interface PossibilitiesProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly id?: string;
}

interface PossibilitiesState {}

export default class Possibilities extends Component<PossibilitiesProps, PossibilitiesState> {
    constructor(props: PossibilitiesProps) {
        super(props);
        this.state = {};
    }

    componentDidMount = async () => {};

    render = () => {
        return (
            <section
                style={{ ...this.props.style }}
                className={`Possibilities ${this.props.className ?? ""}`}
                id={this.props.id}
            >
                <HashNavLink className={this.props.id}>
                    <h1>Endless possibilities...</h1>
                </HashNavLink>
                <h3 className={"hl1 -mt-4"}>What can you do with your own cloud?</h3>
                <p className={"largeText w-full"}>
                    Here are some examples of what you can do with your own cloud, MOWS primary goal
                    is to develop a solid platform that makes it easy to run, use and develop
                    services like these. These are just <b>ideas</b> of what could be made, not 
                    promises of what will be included in MOWS.
                    <br /> <br />
                    The images in this section (and some more below) 
                    are AI generated, these images only serve as decoration to make the page look less text-heavy. 
                    All AI generated images are marked as such with a small red dot.
                </p>
                <div className={"mt-16"}>
                    {capabilities.map((capability, index) => {
                        const hashLink =
                            "Possibilities" + removeNonAlphaNumericCharacters(capability.title);
                        return (
                            <div
                                key={index}
                                id={hashLink}
                                className={`flex flex-col ${
                                    index % 2 === 0 ? "lg:flex-row" : "lg:flex-row-reverse"
                                } content-between justify-center gap-20 rounded-xl mb-32 `}
                            >
                                <div className={"flex justify-center flex-col w-5/5 lg:w-1/2"}>
                                    <HashNavLink className={hashLink}>
                                        <h2 className={"glow"}>{capability.title}</h2>
                                    </HashNavLink>
                                    <p className={"largeText"}>{capability.description}</p>
                                </div>
                                {capability.image && (
                                    <Image
                                        image={{width: 1024, height: 1024, src: `/assets/what/${capability.image}`}}                              
                                        alt={capability.title}
                                        figClassName={"-mt-10 lg:w-2/5 lg:mt-5 lg:-ml-10"}
                                        imgClassName={"rounded-2xl"}
                                        aiGenerated={true}
                                    ></Image>
                                
                                )}
                            </div>
                        );
                    })}
                </div>
            </section>
        );
    };
}
