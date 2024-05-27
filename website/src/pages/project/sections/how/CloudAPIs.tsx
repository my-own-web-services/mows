import { Component } from "preact";
import { CSSProperties } from "preact/compat";
import HashNavLink from "../../../../components/HashNavLink";

interface API {
    name: string;
    content: JSX.Element;
}

const apis: API[] = [
    {
        name: "Filez",
        content: (
            <>
                <p>
                    Filez makes it easy to handle everything file related. It brings many features
                    with it:
                    <ul className={"list-disc list-outside ml-4"}>
                        <li>File upload, download, sorting etc.</li>
                        <li>
                            Optimized display of images by converting them to different formats and
                            sizes
                        </li>
                        <li>
                            Optimized video playback by creating multiple different sized versions
                            of videos to make adaptive streaming possible
                        </li>
                        <li>
                            Synchronization features and native clients to bridge compatibility gaps
                        </li>
                        <li>Metadata extraction to enable quick searches</li>
                        <li>File sharing</li>
                        <li>Grouping files manually</li>
                        <li>Automatic grouping of files based on metadata</li>
                        <li>Tagging files</li>
                        <li>Searching files</li>
                        <li>OCR</li>
                        <li>Automatic image classification</li>
                        <li>Transcriptions for audio and video files</li>
                        <li>Virtualized scrolling through huge file lists</li>
                        <li>Option for setting custom metadata on files per app</li>
                        <li>
                            API to extend it, to for example create previews for special files etc.
                        </li>
                        <li>And many more</li>
                    </ul>
                </p>
            </>
        )
    },
    {
        name: "Auth",
        content: (
            <>
                <p>
                    The Auth API handles everything related to identity and access management. Its
                    is based on the{" "}
                    <a rel={"noreferrer noopener"} href="https://zitadel.com/">
                        Zitadel
                    </a>{" "}
                    project and configured by the MOWS Operator to integrate with your Apps.
                </p>
            </>
        )
    },
    { name: "Notification", content: <></> },

    { name: "Realtime", content: <></> },
    { name: "AI", content: <></> },
    {
        name: "Federation",
        content: (
            <>
                <p>
                    The federation API makes it possible to build apps that can exchange data with
                    other MOWS clusters.
                </p>
            </>
        )
    },
    { name: "Collaboration", content: <></> },
    { name: "Monitoring", content: <></> },
    { name: "Payment", content: <></> },
    { name: "Maps", content: <></> },
    { name: "User Config", content: <></> },
    { name: "Secrets", content: <></> }
];

interface CloudAPIsProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly id?: string;
    readonly h2Class?: string;
}

interface CloudAPIsState {}

export default class CloudAPIs extends Component<CloudAPIsProps, CloudAPIsState> {
    constructor(props: CloudAPIsProps) {
        super(props);
        this.state = {};
    }

    componentDidMount = async () => {};

    render = () => {
        return (
            <div
                style={{ ...this.props.style }}
                className={`CloudAPIs ${this.props.className ?? ""}`}
                id={this.props.id}
            >
                <HashNavLink className={"FivePartsCloudApis"}>
                    <h2 className={this.props.h2Class}>Cloud APIs</h2>
                </HashNavLink>
                <div className={"flex flex-col-reverse md:flex-row"}>
                    <p className={"largeText"}>
                        The MOWS cloud APIs make it easy to develop web applications that are well
                        integrated with the MOWS ecosystem. Building on these APIs makes it possible
                        for apps to integrate with each other as well as sparing developers from
                        implementing basic requirements over and over again. The APIs are provided
                        through http, clients for different languages and directly through frontend
                        components.
                    </p>
                    <img
                        width={400}
                        height={400}
                        src={"/assets/logos/cloud_apis_logo.svg"}
                        alt="Cloud APIS Logo"
                        className={"glow md:w-[50%] -my-16 "}
                        loading={"lazy"}
                    />
                </div>
                <div>
                    {apis.map(({ name, content }) => {
                        const className = `mb-12 FivePartsApis${name}`;
                        return (
                            <div className={className}>
                                <HashNavLink className={className}>
                                    <h3>{name}</h3>
                                </HashNavLink>

                                <div>{content}</div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };
}
