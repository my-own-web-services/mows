import { Component } from "preact";
import { CSSProperties } from "react";
import HashNavLink from "../../../../components/HashNavLink";

interface ContributeProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly id?: string;
}

interface ContributeState {}

export default class Contribute extends Component<ContributeProps, ContributeState> {
    constructor(props: ContributeProps) {
        super(props);
        this.state = {};
    }

    componentDidMount = async () => {};

    render = () => {
        const ul = "list-disc list-inside";
        const subUl = "list-disc list-inside ml-8";
        const sections = "mt-8";
        return (
            <section
                style={{ ...this.props.style }}
                className={`Contribute ${this.props.className ?? ""}`}
                id={this.props.id}
            >
                <HashNavLink className={this.props.id}>
                    <h1>Contribute</h1>
                </HashNavLink>
                <p className={"largeText"}>
                    MOWS is currently in the early stages of development. Many problems have a
                    conceptualized solution, but the implementation is still pending. <br /> If you
                    like the vision please consider to share it and leave a star on{" "}
                    <a rel="noreferrer noopener" href="https://github.com/my-own-web-services/mows">
                        GitHub
                    </a>{" "}
                    to keep us motivated. 🤗🤩 <br />
                </p>
                <div className={"mt-8 intersect"} id="ContributeWork">
                    <HashNavLink className={"ContributeWork"}>
                        <h2>Work</h2>
                    </HashNavLink>
                    <p>
                        MOWS is fully open-source and licensed under the{" "}
                        <a rel="noreferrer noopener" href="https://opensource.org/license/agpl-v3">
                            AGPL-3.0
                        </a>
                        . Contributions in work are not only welcome but also required to make this
                        vision a reality.
                    </p>
                    <p className={"mt-4"}>
                        The core team currently consists of 1 member, so you could be the first one
                        to join me on my quest to create something great.
                    </p>
                    <p className={"mt-4"}>
                        Don't be afraid to reach out if you haven't touched some technology or topic
                        yet, as long as you are open to learning something new we are on the same
                        page.
                    </p>
                    <p className={"mt-4"}>
                        I am stubborn on the vision but flexible on details. So if you like the
                        vision but disagree with some detail, let's talk about it!
                    </p>
                    <p className={"mt-4"}>
                        Listed below are some related topics, helpful skills and experiences that
                        would help out a lot.
                    </p>

                    <p className={"mt-4"}>
                        Every contribution will be honored in the{" "}
                        <a href="/hall-of-fame">MOWS Hall of Fame</a>
                    </p>

                    <div className={sections}>
                        <HashNavLink className={"ContributeWorkLanguage"}>
                            <h3>Language 🗣️</h3>
                        </HashNavLink>
                        <ul className={ul}>
                            <li>Fix my bad english</li>
                            <li>Translate the project</li>
                        </ul>
                    </div>
                    <div className={sections}>
                        <HashNavLink className={"ContributeWorkEducation"}>
                            <h3>Education 🧑‍🏫</h3>
                        </HashNavLink>
                        <p>
                            This is currently my primary job, however I would rather like to work on
                            the technical side of the project
                        </p>
                        <ul className={ul}>
                            <li>Explain the project and vision</li>
                            <li>
                                Give guidance on how to develop the project and in the future apps
                                for it
                            </li>
                        </ul>
                    </div>

                    <div className={sections}>
                        <HashNavLink className={"ContributeWorkFrontend"}>
                            <h3>Frontend 💻</h3>
                        </HashNavLink>
                        <ul className={ul}>
                            <li>
                                React/Preact
                                <ul className={subUl}>
                                    <li>Building interfaces</li>
                                    <li>Building libraries for others to build interfaces</li>
                                </ul>
                            </li>
                            <li>Other Frontend Frameworks</li>
                            <li>Typescript</li>
                            <li>Tailwind</li>
                            <li>
                                Progressive Web Apps (PWA)
                                <ul className={subUl}>
                                    <li>Service Workers</li>
                                    <li>Offline Storage</li>
                                    <li>Web encryption for E2E</li>
                                </ul>
                            </li>
                        </ul>
                    </div>
                    <div className={sections}>
                        <HashNavLink className={"ContributeWorkBackend"}>
                            <h3>Backend 🔌</h3>
                        </HashNavLink>
                        <ul className={ul}>
                            <li>
                                Linux
                                <ul className={subUl}>
                                    <li>Networking</li>
                                    <li>Process isolation</li>
                                    <li>General Linux system administration</li>
                                </ul>
                            </li>
                            <li>Netbooting</li>
                            <li>
                                Cloud Native
                                <ul className={subUl}>
                                    <li>
                                        Kubernetes(k3s)
                                        <ul className={subUl}>
                                            <li>Operators</li>
                                            <li>etcd backups</li>
                                        </ul>
                                    </li>
                                    <li>Longhorn</li>
                                    <li>Cilium</li>
                                    <li>Kubevirt</li>
                                    <li>Kata</li>
                                    <li>Helm</li>
                                    <li>Docker</li>
                                    <li>Docker Compose</li>
                                </ul>
                            </li>
                            <li>
                                VMs
                                <ul className={subUl}>
                                    <li>QEMU, libvirt etc.</li>
                                </ul>
                            </li>
                            <li>Rust</li>
                            <li>Go</li>
                            <li>Creating standards</li>
                            <li>Systems and API design</li>
                            <li>
                                Distributed systems
                                <ul className={subUl}>
                                    <li>Database runtime, lifecycle, backups etc. on them</li>
                                </ul>
                            </li>
                            <li>OpenApi/Swagger</li>
                            <li>gRPC/REST/GraphQL</li>
                            <li>CI/CD</li>
                            <li>Developer experience (Making other developers job easier)</li>
                            <li>Wireguard</li>
                            <li>Hetzners hcloud and other Cloud APIs</li>
                        </ul>
                    </div>
                    <div className={sections}>
                        <HashNavLink className={"ContributeWorkDesign"}>
                            <h3>Design 🎨</h3>
                        </HashNavLink>
                        <ul className={ul}>
                            <li>Figma</li>
                            <li>Inkscape, Illustrator etc.</li>
                            <li>GIMP, Photopea, Photoshop</li>
                            <li>UI/UX Design</li>
                            <li>Vector illustration</li>
                            <li>Animation</li>
                            <li>Design and UI systems</li>
                        </ul>
                    </div>
                    <div className={sections}>
                        <HashNavLink className={"ContributeWorkHardwareProduct"}>
                            <h3>Hardware Product 🔩</h3>
                        </HashNavLink>
                        <ul className={ul}>
                            <li>Embedded programming</li>
                            <li>OCR</li>
                            <li>
                                Business skills
                                <ul className={subUl}>
                                    <li>Money management (Taxes, Bookkeeping etc.)</li>
                                    <li>Communication with suppliers</li>
                                </ul>
                            </li>
                        </ul>
                    </div>
                    <div className={sections}>
                        <HashNavLink className={"ContributeWorkPublicRelations"}>
                            <h3>Public Relations 📢</h3>
                        </HashNavLink>
                        <ul className={ul}>
                            <li>Social Media</li>
                            <li>Marketing</li>
                        </ul>
                    </div>
                </div>
                <div className={"mt-8 intersect"} id="ContributeDonations">
                    <HashNavLink className={"ContributeDonations"}>
                        <h2>Donations</h2>
                    </HashNavLink>
                    <p>
                        Donations are highly appreciated and will be used to fund the development of
                        the project. Every donation will be honored in the{" "}
                        <a href="/hall-of-fame">MOWS Hall of Fame</a> if you accepted the{" "}
                        <a href="/hall-of-fame/terms-and-conditions">terms and conditions</a>. You
                        can also donate anonymously. Bigger donations will get you a larger spot in
                        the Hall of Fame.
                    </p>
                    <p className={"mt-4"}>
                        You can choose whether you want to donate once or on a regular basis. The
                        donation can also be made in the form of hardware or services or only to
                        specific parts of the project. If you want to donate hardware or services,
                        please <a href="mailto:mows@vindelicum.eu">contact us</a>.
                    </p>
                    <div className={"mt-4"}>
                        <HashNavLink className={"ContributeDonationsMonero"}>
                            <h3>Monero</h3>
                        </HashNavLink>
                        <span className={`font-mono break-all select-all`}>
                            83ghxanazDjhC9ApUPdunjiNmRuEV8ZDr77eCydjAGdM9M6fQFJzxGUGuGMrugErVQUhhtVvYdw6j5DykBqhqYRPMuRKpSx
                        </span>
                    </div>
                </div>
                <div className={"mt-8 intersect"} id="ContributeFeedback">
                    <HashNavLink className={"ContributeFeedback"}>
                        <h2>Feedback</h2>
                    </HashNavLink>
                    <p>
                        After reading the FAQ, feel free to leave questions and feedback in the{" "}
                        <a
                            rel={"noreferrer noopener"}
                            href="https://github.com/my-own-web-services/mows/discussions"
                        >
                            GitHub Discussions
                        </a>{" "}
                        section or write us a mail at{" "}
                        <a href="mailto:mows@vindelicum.eu">mows@vindelicum.eu</a>
                    </p>
                </div>
            </section>
        );
    };
}
