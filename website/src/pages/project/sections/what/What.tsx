import { Component } from "preact";
import { CSSProperties } from "preact/compat";
import HashNavLink from "../../../../components/HashNavLink";

interface Capability {
    readonly title: string;
    readonly description: string;
    readonly image?: string;
}

// see ideas.md

const capabilities: Capability[] = [
    {
        title: "Stream your PC!",
        description:
            "Stream any operating system to any device, wherever you are, without worrying about failing hardware when you just want to get work done, or play games with your friends. Make the most of your hardware, and ",
        image: "stream-desktop.webp"
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
        title: "Game on!",
        description:
            "Run your own game servers. Play with your friends, wherever they are, without paying for a subscription.",
        image: "game-server.webp"
    },
    {
        title: "Ad-free everywhere!",
        description:
            "Block most ads on all your devices in all apps, network wide, without the need for a browser extension.",
        image: "ads.webp"
    }
    /*
    {
        title: "Your personal AI assistant.",
        description:
            "Get help with your daily tasks, like scheduling, reminders, shopping lists, and more, without the need for a subscription.",
        image: "ai.webp"
    }*/
    /*
    Router
    Freifunk
    
    */
];

interface WhatProps {
    readonly className?: string;
    readonly style?: CSSProperties;
}

interface WhatState {}

export default class What extends Component<WhatProps, WhatState> {
    constructor(props: WhatProps) {
        super(props);
        this.state = {};
    }

    componentDidMount = async () => {};

    render = () => {
        return (
            <div style={{ ...this.props.style }} className={`What ${this.props.className ?? ""}`}>
                <HashNavLink className={"What"}>
                    <h1 className={""}>Endless possibilities...</h1>
                </HashNavLink>
                <div className={"mt-16"}>
                    {capabilities.map((capability, index) => (
                        <div
                            key={index}
                            className={`flex flex-col ${
                                index % 2 === 0 ? "lg:flex-row" : "lg:flex-row-reverse"
                            } content-between justify-center gap-20 rounded-xl mb-32 `}
                        >
                            <div className={"flex justify-center flex-col w-5/5 lg:w-1/2"}>
                                <h2 className={"glow"}>{capability.title}</h2>
                                <p className={"largeText"}>{capability.description}</p>
                            </div>
                            {capability.image && (
                                <img
                                    width={1024}
                                    height={1024}
                                    src={`/assets/what/${capability.image}`}
                                    alt={capability.title}
                                    className={"-mt-10 lg:w-2/5 lg:mt-5 lg:-ml-10 rounded-2xl"}
                                />
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    };
}
