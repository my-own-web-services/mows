import { Component, RefObject, createRef } from "preact";
import Face from "../assets/face.jpg";
import basics from "../assets/basics.svg";
import HashNavLink from "../components/HashNavLink";
import AnyMachine from "../components/animations/AnyMachine";
import ManagerSVG from "../assets/manager.svg";
import OperatorSVG from "../assets/operator.svg";
import ManifestExampleImage from "../assets/manifest_example.jpg";
import ClusterFailure from "../components/animations/ClusterNodeFailure";
import ArchitectureComparison from "./project/ArchitectureComparison";

interface ProjectProps {}
interface ProjectState {}
export default class Project extends Component<ProjectProps, ProjectState> {
    clusterNodeFailure: RefObject<ClusterFailure>;

    constructor(props: ProjectProps) {
        super(props);
        this.clusterNodeFailure = createRef<ClusterFailure>();
    }

    componentDidMount = () => {};

    render = () => {
        return (
            <div className="Project">
                <section className={"Hero"}>
                    <div className={"HeroText"}>
                        <h1>
                            <span>Leave the dark clouds behind and</span>
                            <span className={"hl1"}> create your own!</span>
                        </h1>
                        <p className={"largeText"}>
                            Break free from the confines of tech giants' locked-in cloud
                            surveillance systems while enjoying the easy, worry-free operation of
                            your own cloud environment. Reclaim your privacy and sovereignty with
                            ease by using MOWS.
                        </p>
                    </div>
                    <div className={"Face"}>
                        <img height={1100} width={967} draggable={false} src={Face} alt="" />
                    </div>
                </section>
                <section className={"Basics"}>
                    <div className={"basicsTop"}>
                        <HashNavLink className={"Basics"}>
                            <h1>My Own Web Services</h1>
                        </HashNavLink>
                        <h2 className={"hl1"}>The cloud OS with batteries included</h2>
                        <p className={"largeText"}>
                            MOWS makes it easy to start your own multi-computer cloud system from
                            scratch. Perfect for businesses, individuals, and beyond, it enables
                            effortless empowerment in reclaiming data sovereignty and privacy. It
                            offers an open solution but still has you covered on all operational
                            basics, to let you focus on what truly matters.
                        </p>
                    </div>
                    <div>
                        <HashNavLink className={"BasicsComparison"}>
                            <h2>Problems with current architectures</h2>
                        </HashNavLink>
                        <ArchitectureComparison />
                    </div>
                    <div>
                        <HashNavLink className={"BasicsDifferent"}>
                            <h2>
                                What makes{" "}
                                <span
                                    className={"hl1"}
                                    style={{ borderBottom: "3px solid var(--c-hl1)" }}
                                >
                                    MOWS
                                </span>{" "}
                                different?
                            </h2>
                        </HashNavLink>
                        <div className={"basicsLine"}>
                            <img
                                width={352}
                                height={1406}
                                draggable={false}
                                className={"glow"}
                                src={basics}
                                alt=""
                            />
                            <div style={{ top: 0, left: 200, width: 332 }}>
                                <HashNavLink className={"BasicsEasyToUse"}>
                                    <h3>Easy to use</h3>
                                </HashNavLink>
                                <p>
                                    MOWS is designed to be easy to setup, use and operate. It is
                                    designed to be usable by everyone, on every device, everywhere.
                                </p>
                            </div>
                            <div style={{ top: 177, left: 295, width: 380 }}>
                                <HashNavLink className={"BasicsReliable"}>
                                    <h3>Reliable</h3>
                                </HashNavLink>
                                <p>
                                    As MOWS is built to run across multiple computers it is highly
                                    reliable, to keep on working after a failure even when you are
                                    not around.
                                </p>
                            </div>

                            <div style={{ top: 360, left: 200, width: 456 }}>
                                <HashNavLink className={"BasicsSecure"}>
                                    <h3>Secure</h3>
                                </HashNavLink>
                                <p>
                                    Application isolation is at the core of the MOWS ecosystem,
                                    ensuring that no bit can escape your control. Full encryption at
                                    rest ensures that your data cannot be stolen physically.
                                </p>
                            </div>
                            <div style={{ top: 525, left: 400, width: 422 }}>
                                <HashNavLink className={"BasicsPrivate"}>
                                    <h3>Private</h3>
                                </HashNavLink>
                                <p>
                                    Reclaim privacy by storing your data locally again, while not
                                    losing the amenities of modern web applications that are usable
                                    on and synced to every device.
                                </p>
                            </div>

                            <div style={{ top: 700, left: 295, width: 441 }}>
                                <HashNavLink className={"BasicsOpen"}>
                                    <h3>Open</h3>
                                </HashNavLink>
                                <p>
                                    The open nature of MOWS makes it impossible to get locked in to
                                    one provider. No centralized app store can tell you what to do.
                                    MOWS is licensed under GNU AGPL v3.
                                </p>
                            </div>
                            <div style={{ top: 875, left: 295, width: 370 }}>
                                <HashNavLink className={"BasicsDeveloperFriendly"}>
                                    <h3>Developer Friendly</h3>
                                </HashNavLink>
                                <p>
                                    MOWS streamlines app development by offering a variety of
                                    essential APIs, sparing developers from repetitive, cluttered
                                    groundwork.
                                </p>
                            </div>
                            <div style={{ top: 1052, left: 200, width: 550 }}>
                                <HashNavLink className={"BasicsComprehensive"}>
                                    <h3>Comprehensive</h3>
                                </HashNavLink>
                                <p>
                                    MOWS is a holistic solution for a lot of challenges in the
                                    current software ecosystem regarding privacy, ease of use,
                                    compatibility, reliability, easy app development (while
                                    preserving privacy) and many more.
                                </p>
                            </div>
                            <div style={{ top: 1230, left: 295, width: 574 }}>
                                <HashNavLink className={"BasicsScalable"}>
                                    <h3>Scalable</h3>
                                </HashNavLink>
                                <p>
                                    No matter if you are starting in a home lab or in a data center,
                                    MOWS scales with your needs. It is designed to run on multiple
                                    computers but can also run on a single one. MOWS can run on
                                    every machine that can run Linux.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>
                <section className={"FourParts"}>
                    <div className={"FourPartsTop"}>
                        <HashNavLink className={"FourParts"}>
                            <h1>One Vision, Four Parts</h1>
                        </HashNavLink>
                    </div>
                    <div className={"FourPartsOperator"}>
                        <div className={"FourPartsOperatorTop childrenSideBySide"}>
                            <div style={{ maxWidth: "50%" }}>
                                <HashNavLink className={"FourPartsOperator"}>
                                    <h2>Operator</h2>
                                </HashNavLink>
                                <p className={"largeText"}>
                                    The Operator is the brain of the system and has its components
                                    running on all computers in the cluster. It handles the internal
                                    operation, resource allocation and the lifecycle of
                                    applications. It also runs backups, health checks and many other
                                    tasks.
                                </p>
                            </div>
                            <img
                                width={100}
                                height={100}
                                draggable={false}
                                src={OperatorSVG}
                                className={"glow"}
                                alt="Operator"
                                style={{ width: "50%", scale: "4", zIndex: "-1" }}
                            />
                        </div>
                        <div className={"Parts"}>
                            <div>
                                <div className={"childrenSideBySide"}>
                                    <div>
                                        <HashNavLink
                                            className={"FourPartsOperatorApplicationManagement"}
                                        >
                                            <h3>Application Management</h3>
                                        </HashNavLink>
                                        <p>
                                            Every app comes with a application manifest that
                                            describes its minimum and recommended resource
                                            requirements. These resources include things like
                                            storage, network, secrets, compute and MOWS APIS. <br />{" "}
                                            The admin of the cluster can install apps through a web
                                            interface choosing if they want to give an app the
                                            described resources, to adjust them to his liking or
                                            deny the installation.
                                        </p>
                                    </div>
                                    <img
                                        width={1239}
                                        height={560}
                                        draggable={false}
                                        src={ManifestExampleImage}
                                        className={"manifestExample"}
                                        alt="A example of a manifest file written in yaml"
                                    />
                                </div>
                            </div>
                            <div>
                                <div className={"childrenSideBySide"}>
                                    <div>
                                        <HashNavLink className={"FourPartsOperatorStorage"}>
                                            <h3>Storage</h3>
                                        </HashNavLink>
                                        <p>
                                            Through the use of a storage provider, replicated
                                            storage gets provisioned and made available to the
                                            applications. In case of a node(computer) or hard drive
                                            <span
                                                onClick={() =>
                                                    this.clusterNodeFailure.current?.runAnimation()
                                                }
                                                title="Click to run animation"
                                                className={"hl1 animationTrigger"}
                                            >
                                                {" "}
                                                failure
                                            </span>{" "}
                                            at least one other node is available to continue
                                            operating. As the data does not fulfill its replication
                                            goal anymore it is replicated to another healthy node in
                                            the background.
                                        </p>
                                    </div>
                                    <ClusterFailure
                                        ref={this.clusterNodeFailure}
                                        style={{ width: "50%", margin: "0px auto" }}
                                    />
                                </div>
                            </div>
                            <div>
                                <HashNavLink className={"FourPartsOperatorBackup"}>
                                    <h3>Backup</h3>
                                </HashNavLink>
                                <p>
                                    A out of cluster backup is performed on a regular basis given
                                    that another machine is provided. The backup is encrypted,
                                    compressed, append only and cannot be deleted without physical
                                    access to the machine. The backup machine should reside at a
                                    another physical location than the cluster, for example on a
                                    rented server, a friends house or virtually on another persons
                                    cluster. The backups are regularly checked to be recoverable.{" "}
                                    <br />
                                    The backup also contains the clusters configuration data, to
                                    make it possible to fully restore the cluster to its last
                                    healthy state after a whole cluster failure. The full cluster
                                    restore procedure is performed by the MOWS Manager.
                                </p>
                            </div>
                            <div>
                                <HashNavLink className={"FourPartsOperatorHealthChecks"}>
                                    <h3>Health Checks</h3>
                                </HashNavLink>
                                <p>
                                    Regular health checks are performed on drives, backups and
                                    running applications. <br /> Depending on the cluster setup even
                                    low level checks like MemTest can be performed by shutting down
                                    the machine to be checked and controlling it with another
                                    cluster machine.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className={"FourPartsManager"}>
                        <div className={"FourPartsOperatorTop childrenSideBySide"}>
                            <div style={{ maxWidth: "50%" }}>
                                <HashNavLink className={"FourPartsManager"}>
                                    <h2>Manager</h2>
                                </HashNavLink>
                                <p className={"largeText"}>
                                    The Manager handles everything that can’t be performed on the
                                    cluster, like the setup, decryption of the drives on a full
                                    restart, adding or removing nodes or drives and recovering the
                                    cluster from backup in case of a complete failure.
                                </p>
                            </div>
                            <img
                                width={100}
                                height={100}
                                src={ManagerSVG}
                                alt="Manager"
                                style={{ width: "50%", scale: "4" }}
                            />
                        </div>
                        <div className={"Parts"}>
                            <div>
                                <HashNavLink className={"FourPartsManagerSetup"}>
                                    <h3>Setup</h3>
                                </HashNavLink>
                                <p>
                                    The initial setup is performed by choosing the machines to
                                    install the cluster on and providing a domain name to use, in
                                    case of using external services their API keys need to be
                                    provided. After the installation you are provided with a single
                                    string of text that contains all system information, secrets and
                                    encryption keys. This information should be stored securely and
                                    reliably as it contains everything required to decrypt, restore
                                    from backup or repair the cluster from the outside. Without it
                                    all your data is lost to the encryption missing its decryption
                                    key.
                                </p>
                            </div>
                            <div>
                                <HashNavLink className={"FourPartsManagerDecryption"}>
                                    <h3>Decryption</h3>
                                </HashNavLink>
                                <p>
                                    After a complete shutdown of the cluster you will need to
                                    provide your secret to the manager to start it again.
                                </p>
                            </div>
                            <div>
                                <HashNavLink
                                    className={"FourPartsManagerAddingRemovingDrivesNodes"}
                                >
                                    <h3>Adding/Removing Nodes/Drives</h3>
                                </HashNavLink>
                                <p>
                                    When adding nodes or drives your secret needs to be provided.
                                    Adding a node requires the selection of a machine to add and
                                    waiting for the setup to finish. The removal of a node requires
                                    the selection of a cluster machine to remove. Adding or removing
                                    drives works by starting the removal procedure in the manager ui
                                    that will then guide you through the process, shutting down the
                                    node and starting it again after you finished the manual
                                    addition or removal of the drives.
                                </p>
                            </div>
                            <div>
                                <HashNavLink className={"FourPartsManagerRecovery"}>
                                    <h3>Recovery</h3>
                                </HashNavLink>
                                <p>
                                    After a full system failure you can choose to recreate the
                                    cluster from the backup. The process starts with the normal
                                    setup but then imports your operating and user data to restore
                                    everything. Some encryption keys will change in the process.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className={"FourPartsHardware"}>
                        <HashNavLink className={"FourPartsHardware"}>
                            <h2>Hardware</h2>
                        </HashNavLink>
                        <p className={"largeText"}>
                            The hardware part of the project aims to provide a well integrated,
                            performant, cost effective solution as a base for the system on top. You
                            can build it yourself from parts or buy the assembled version to save
                            some time. To automate the installation on bare metal, consumer hardware
                            as much as possible, the manager is extended with a few components and a
                            ultra cheap KVM solution is provided.
                        </p>
                        <div className={"Parts"}>
                            <div>
                                <HashNavLink className={"FourPartsHardwarePicoKVM"}>
                                    <h3>Pico KVM</h3>
                                </HashNavLink>
                                <p>
                                    Pi-KVM is awesome but it needs another computer with a full
                                    operating system, that would need to be set up and could fail.
                                    We already have three machines to manage and would need three
                                    other ones or an relatively expensive KVM switch to manage them
                                    with Pi-KVM. So we need to convert our existing machines into a
                                    KVM device. For the video input a cheap USB capture card can be
                                    used. To send keystrokes a USB host device would be required on
                                    the sending machine but this is rarely the case. To achieve this
                                    cheaply, a custom solution was made that has a Pi Pico
                                    forwarding keystrokes to the other computer, bridging this age
                                    old flaw in the USB specification.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>
                <AnyMachine />
            </div>
        );
    };
}
