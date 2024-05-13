import { Component } from "preact";
import { CSSProperties } from "react";
import HashNavLink from "../../../components/HashNavLink";
import Collapsible from "../../../components/Collapsible";

interface FAQItem {
    readonly question: string;
    readonly answer: string;
}

interface FAQProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly id?: string;
}

interface FAQState {}

const faq: FAQItem[] = [
    {
        question: "Why not docker-compose?",
        answer: "The docker and docker-compose ecosystem is awesome and great for getting started with containers, but it is missing a lot of features that would be required for home-labs to grow out of the lab stage into a system that you can rely on every day. A software platform can really only grow well when it can not only support some home users, but also small businesses and even larger organizations. Kubernetes is a great platform for this, but as it is only one part of a larger system, it is not enough to just install Kubernetes and call it a day. MOWS is a complete solution that is designed to be easy to use, but also to be able to grow with you as your needs grow."
    },
    {
        question: "Why not use a cloud provider?",
        answer: "Privacy and sovereignty are important. The cloud providers have a lot of power over your data and can use it in ways that you may not agree with. They can also be forced to give up your data to governments or other organizations. By using MOWS, you can have control over your data and how it is used. You can also have control over the hardware that your data is stored on. This can be important if you have specific requirements for your data storage, such as needing to keep it in a specific country or needing to have it stored on hardware that you trust."
    },
    {
        question: "Three servers seem overkill and very expensive. Why not just use one?",
        answer: "For the same price as a single server, you can have three servers that are more reliable and can be easier maintained. One server fails? Just rip it out and replace it with a new one. No need to worry about data loss or downtime. The hardware part of the project aims to deliver an affordable computer cluster option that is easy to set up and not just a tech enthusiast experimenting toy but an actual reliable solution. As MOWS can easily run virtual machines, you can easily stream any desktop operating system to a super cheap thin client, cutting out the need for many expensive desktops. This way you can make the most out of your hardware and have a reliable system that can grow with you. A cluster like this could also be easily shared with friends or family, making it even more cost-effective. You can also cut out expensive cloud services and the cost of expensive mobile devices that you bought to have that easy to use but walled off ecosystem. The MOWS services can run on any device that can run a web browser, so you can have the ease of use on any cheaper device."
    },
    {
        question: "The idea looks great, but isn't this way too ambitious?",
        answer: "Yes, it is ambitious. But not as impossible as it may seem. We are not trying to build a new operating system or a new programming language. We are using existing open-source technologies that are already in production-use by many of the largest companies in the world. The problem is that they are not easy to use for the average person. We are trying to make these technologies easy to use and accessible to everyone, while not creating another locked in cloud provider. The biggest make or break for this project is the community. We need people to help us build this system and to help us test it. We need people to help us write documentation and to help us make it easy to use. We need people to help us find bugs and to help us fix them. We need people to help us make this system better. We need you."
    },
    {
        question: "Why another device?",
        answer: "The aim is to not just provide another device but the primary device, you can run and stream any operating system, any web service, any docker container, your home automation, your password manager, your router, your e-mail, your network wide ad-blocker, your blog, your development environment, your business website and much more."
    },
    {
        question: "Do I always need to have a internet connection?",
        answer: "No, you can run the services on your local network and access them from any device that is connected to the same network. When outside, you need to have an internet connection to access the services. The MOWS Cloud APIs make it easy to create well working offline first web applications that can sync with the server when a connection is available."
    },
    {
        question: "How can I run a mail server on a dynamic IP at home?",
        answer: "You can't as most mail providers will block it. You need a static IP to run a mail server. As most ISPs are absolute garbage, they don't even offer you an option to get a static IP without switching to a business contract. Currently, our best option, besides voting against big oligopolies that all offer the same garbage contracts, is to rent a cheap virtual server with a static IP and use it as a relay (L3). This is also mostly automated by MOWS. Your data still resides on your own hardware and the company behind the relay server can only read the metadata of the connection (as your ISP can too). The provider of the IP can also be easily switched out. At some point, we would just like to have a service that offers you a static IP for a fair price and without the need to switch to a business contract. This is a political issue that we would like to address in the future."
    },
    {
        question: "Is this the future?",
        answer: "We don't know, but we would like to think so. The current cloud providers are getting more and more powerful and are starting to control more and more of our lives. We believe that we need to take back control of our data and our lives. We believe that we need to build a better internet that is not controlled by a few large companies. No matter what device comes after the smartphone, there will always be a need for a cloud service. We believe that MOWS is the best way to build that service. We believe that MOWS is the future."
    },
    {
        question: "What about Web3?",
        answer: "The idea of decentralization is great, but it is absurd to believe that a complicated ecosystem with so much legacy code could be replaced solely by some version of a blockchain. However, Blockchain and similar technologies may very well be part of the future and the solution to some problems, that we want to solve with MOWS. Some form of decentralized payment system will be required for a true sovereign private and independent World Wide Web. Such a system will be included in the API stack at some point."
    }
];

export default class FAQ extends Component<FAQProps, FAQState> {
    constructor(props: FAQProps) {
        super(props);
        this.state = {};
    }

    componentDidMount = async () => {};

    render = () => {
        return (
            <section
                style={{ ...this.props.style }}
                className={`FAQ ${this.props.className ?? ""}`}
                id={this.props.id}
            >
                <HashNavLink className={this.props.id}>
                    <h1>FAQ</h1>
                </HashNavLink>
                <div>
                    {faq.map(({ question, answer }) => (
                        <Collapsible
                            title={<span className={"text-xl"}>{question}</span>}
                            key={question}
                        >
                            <p>{answer}</p>
                        </Collapsible>
                    ))}
                </div>
            </section>
        );
    };
}
