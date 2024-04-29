import { Component } from "preact";
import { CSSProperties } from "preact/compat";
import HashNavLink from "../../../../components/HashNavLink";

interface Capability {
    readonly title: string;
    readonly description: string;
}

// see ideas.md

const capabilities: Capability[] = [
    {
        title: "Take your desktop with you!",
        description:
            "Stream any operating system to any device, wherever you are, without worrying about failing hardware when you just want to get work done."
    },
    {
        title: "You've got mail!",
        description:
            "Enjoy the power of your own mail server: privacy, infinite mail addresses and finally a great web-mail experience."
    },
    {
        title: "Password: 123456?",
        description:
            "Manage all your passwords and other secrets in one place, securely and easily accessible from all your devices."
    },
    {
        title: "Your home, your rules.",
        description:
            "Control all your smart home devices without the need for an internet connection, and without the fear of your data being sold to the highest bidder."
    },
    {
        title: "Your media, your way.",
        description:
            "Store all your photos, videos and music in one place, accessible from all your devices, without the need for a subscription."
    },
    {
        title: "Game on!",
        description:
            "Run your own game servers. Play with your friends, wherever they are, without paying for a subscription."
    },
    {
        title: "Ad-free everywhere",
        description:
            "Block most ads on all your devices in all apps, without the need for a browser extension."
    }
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
                <HashNavLink className={"Overview"}>
                    <h1>What</h1>
                </HashNavLink>
            </div>
        );
    };
}
