import { Component, RefObject, createRef } from "preact";
import HashNavLink from "../../../../components/HashNavLink";
import ManagerSVG from "../../../../assets/manager.svg";
import OperatorSVG from "../../../../assets/operator.svg";
import ManifestExampleImage from "../../../../assets/manifest_example.jpg";
import ClusterFailure from "../../../../components/animations/ClusterNodeFailure";
import AnyMachine from "../../../../components/animations/AnyMachine";

interface FivePartsProps {}
interface FivePartsState {}
export default class FiveParts extends Component<FivePartsProps, FivePartsState> {
    clusterNodeFailure: RefObject<ClusterFailure>;
    anyMachine: RefObject<AnyMachine>;

    constructor(props: FivePartsProps) {
        super(props);
        this.clusterNodeFailure = createRef<ClusterFailure>();
        this.anyMachine = createRef<AnyMachine>();
    }
    render = () => {
        return (
            <section id="FiveParts" className={"FiveParts"}>
                <HashNavLink className={"FiveParts"}>
                    <h1>One Vision, Five Parts</h1>
                </HashNavLink>
                <div className={"mt-10"} id="FivePartsOperator">
                    <div className={"flex flex-col-reverse md:flex-row"}>
                        <div className={"md:w-[50%] mb-10"}>
                            <HashNavLink className={"FivePartsOperator"}>
                                <h2>Operator</h2>
                            </HashNavLink>
                            <p className={"largeText"}>
                                The Operator is the brain of the system and has its components
                                running on all computers in the cluster. It handles the internal
                                operation, resource allocation and the lifecycle of applications. It
                                also runs backups, health checks and many other tasks.
                            </p>
                        </div>

                        {/* don't use css: scale here as it messes with the layout in chrome when jumping to an element with id by using the #id in the url (not a problem in firefox) */}
                        <img
                            width={400}
                            height={400}
                            draggable={false}
                            src={OperatorSVG}
                            className={"glow md:w-[50%] -my-32"}
                            alt="Operator"
                        />
                    </div>
                    <div className={"mt-10"}>
                        <div
                            className={
                                "flex flex-col md:flex-row gap-10 justify-center md:justify-start items-center"
                            }
                        >
                            <div className={"md:w-[50%]"}>
                                <HashNavLink className={"FivePartsOperatorApplicationManagement"}>
                                    <h3>Application Management</h3>
                                </HashNavLink>
                                <p>
                                    Every app comes with an application manifest that describes its
                                    recommended and minimum resource requirements. These resources
                                    include things like storage, network, secrets, compute and MOWS
                                    APIs. <br /> The administrator of the cluster can install apps
                                    through a web interface, choosing if they want to give an app
                                    the requested resources, to adjust them, or to deny the
                                    installation.
                                </p>
                            </div>
                            <div className={"w-full md:w-[50%]"}>
                                <img
                                    width={1239}
                                    height={560}
                                    draggable={false}
                                    src={ManifestExampleImage}
                                    className={"w-[100%] h-auto rounded-lg"}
                                    alt="A example of a manifest file written in yaml"
                                />
                            </div>
                        </div>
                        <div
                            className={
                                "flex flex-col md:flex-row gap-10 justify-center md:justify-start items-center mt-10"
                            }
                        >
                            <div style={"md:w-[50%]"}>
                                <HashNavLink className={"FivePartsOperatorStorage"}>
                                    <h3>Storage</h3>
                                </HashNavLink>
                                <p>
                                    Through the use of a storage provider, replicated storage is
                                    provisioned and made available to the applications. In case of a
                                    node(computer) or hard drive failure at least one other node is
                                    available to continue operating. As the data does not fulfill
                                    its replication goal anymore it is replicated to another healthy
                                    node in the background.
                                </p>
                            </div>
                            <ClusterFailure
                                ref={this.clusterNodeFailure}
                                className={"mx-auto md:w-[50%]"}
                            />
                        </div>
                        <div className={"my-10"}>
                            <HashNavLink className={"FivePartsOperatorBackup"}>
                                <h3>Backup</h3>
                            </HashNavLink>
                            <p>
                                An out-of-cluster backup is performed on a regular basis given that
                                another machine is provided. The backup is encrypted, compressed,
                                append only(if applicable) and cannot be deleted without physical
                                access to the machine. The backup machine should reside at a another
                                physical location than the cluster, for example on a rented server,
                                at a friend's house, or on another persons cluster. The backups are
                                regularly checked for recovery viability. <br />
                                The backup also contains the cluster's configuration data, making it
                                possible to fully restore the cluster to its last healthy state
                                after a whole-cluster failure. The full cluster restore procedure is
                                performed by the MOWS Manager.
                            </p>
                        </div>
                        <div>
                            <HashNavLink className={"FivePartsOperatorHealthChecks"}>
                                <h3>Health Checks</h3>
                            </HashNavLink>
                            <p>
                                Regular health checks are performed on drives, backups and running
                                applications. <br /> Depending on the cluster setup, even low level
                                checks like MemTest can be performed by shutting down the machine to
                                be checked and controlling it with another cluster machine.
                            </p>
                        </div>
                    </div>
                </div>

                <div className={"mt-32"} id="FivePartsManager">
                    <div className={"flex flex-col md:flex-row"}>
                        <div>
                            <HashNavLink className={"FivePartsManager"}>
                                <h2>Manager</h2>
                            </HashNavLink>
                            <p className={"largeText"}>
                                The Manager handles everything that can’t be performed on the
                                cluster, setup, adding or removing nodes or drives, decryption of
                                the drives on a full restart, and recovering the cluster from backup
                                in case of a complete failure.
                            </p>
                        </div>
                        <img
                            width={400}
                            height={400}
                            src={ManagerSVG}
                            alt="Manager"
                            className={"glow md:w-[50%] -my-32 "}
                        />
                    </div>
                    <div className={"Parts"}>
                        <div
                            className={
                                "flex flex-col md:flex-row gap-10 justify-center md:justify-start items-center mt-10"
                            }
                        >
                            <div>
                                <HashNavLink className={"FivePartsManagerSetup"}>
                                    <h3>Setup</h3>
                                </HashNavLink>

                                <p>
                                    The initial setup is performed by choosing the machines to
                                    install the cluster on. Any combination of Local VMs, Local
                                    pyhsical machines and rented remote machines can be used.
                                </p>
                                <p>
                                    If external services are used, their API keys need to be
                                    provided. After the installation, you are provided with a single
                                    string of text that contains all system information, secrets and
                                    encryption keys. This information should be stored securely and
                                    reliably as it contains everything required to decrypt, restore
                                    from backup or repair the cluster from the outside. Without it,
                                    encrypted data cannot be recovered.
                                </p>
                            </div>
                            <AnyMachine
                                ref={this.anyMachine}
                                className={
                                    "scale-75 -ml-24 lg:scale-100 lg:ml-0 w-[100%] md:w-[50%]"
                                }
                            />
                        </div>
                        <div className={"mt-10"}>
                            <HashNavLink className={"FivePartsManagerDecryption"}>
                                <h3>Decryption</h3>
                            </HashNavLink>
                            <p>
                                After a complete shutdown of the cluster, you will need to provide
                                your secret to the manager to start it again.
                            </p>
                        </div>
                        <div className={"mt-10"}>
                            <HashNavLink className={"FivePartsManagerAddingRemovingDrivesNodes"}>
                                <h3>Adding/Removing Nodes/Drives</h3>
                            </HashNavLink>
                            <p>
                                When adding nodes or drives, your secret needs to be provided.
                                Adding a node requires the selection of a machine to add and waiting
                                for the setup to finish. The removal of a node requires the
                                selection of a cluster machine to remove. Adding or removing drives
                                works by starting the removal procedure in the manager ui that will
                                then guide you through the process, shutting down the node and
                                starting it again after you finished the manual addition or removal
                                of the drives.
                            </p>
                        </div>
                        <div className={"mt-10"}>
                            <HashNavLink className={"FivePartsManagerRecovery"}>
                                <h3>Recovery</h3>
                            </HashNavLink>
                            <p>
                                After a full system failure you can choose to recreate the cluster
                                from the backup. The process starts with the normal setup, but then
                                imports your operating and user data to restore everything. Some
                                encryption keys will change in the process.
                            </p>
                        </div>
                    </div>
                </div>

                <div className={"mt-32"} id="FivePartsHardware">
                    <HashNavLink className={"FivePartsHardware"}>
                        <h2>Hardware</h2>
                    </HashNavLink>
                    <p className={"largeText"}>
                        The hardware part of the project aims to provide a well-integrated,
                        performant, cost-effective solution as a base for the system on top. You can
                        build it yourself from parts, or buy the assembled version to save some
                        time. To automate the installation on bare metal, and support as much
                        consumer hardware as much as possible, the manager is extended with a few
                        components and a cheap KVM solution is provided.
                    </p>
                    <div className={"Parts"}>
                        <div>
                            <HashNavLink className={"FivePartsHardwarePicoKVM"}>
                                <h3>Pico KVM</h3>
                            </HashNavLink>
                            <p>
                                Pi-KVM is awesome, but it needs another computer with a full
                                operating system, that would need to be set up and could fail. We
                                already have three machines to manage and would need three more (or
                                a relatively expensive KVM switch) to manage them with Pi-KVM. So we
                                need to convert our existing machines into a KVM device. For the
                                video input, a cheap USB capture card can be used. To emulate a
                                keyboard, a USB host device would be required on the sending
                                machine, but this is rarely the case. To achieve this cheaply, a
                                custom solution was made that has a Pi Pico forwarding keystrokes to
                                the other computer, bridging this age-old flaw in the USB
                                specification.
                            </p>
                        </div>
                    </div>
                </div>

                <div className={"mt-32"} id="FivePartsCloudAPIs">
                    <HashNavLink className={"FivePartsCloudApis"}>
                        <h2>MOWS Cloud APIs</h2>
                    </HashNavLink>
                    <p className={"largeText"}>
                        The MOWS cloud APIs make it easy to develop web applications that are well
                        integrated with the MOWS ecosystem. Building on these APIs makes it possible
                        for apps to integrate with each other as well as sparing developers from
                        implementing basic requirements over and over again. The APIs are provided
                        through http, clients for different languages and directly through frontend
                        components.
                    </p>
                    <div className={"Parts"}>
                        <div>
                            <HashNavLink className={"FivePartsApisFilez"}>
                                <h3>Filez</h3>
                            </HashNavLink>
                            <p>
                                Filez makes it easy to handle everything file related. It brings
                                many features with it:
                                <ul>
                                    <li>File upload, download, sorting etc.</li>
                                    <li>
                                        Optimized display of images by converting them to different
                                        formats and sizes
                                    </li>
                                    <li>
                                        Optimized video playback by creating multiple different
                                        sized versions of videos to make adaptive streaming possible
                                    </li>
                                    <li>
                                        Synchronization features and native clients to bridge
                                        compatibility gaps
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
                                    <li>And many more</li>
                                </ul>
                            </p>
                        </div>
                        <div>
                            <HashNavLink className={"FivePartsApisAuth"}>
                                <h3>Auth</h3>
                            </HashNavLink>
                            <p>
                                The Auth API handles everything related to identity and access
                                management. Its is based on the{" "}
                                <a rel={"noreferrer noopener"} href="https://zitadel.com/">
                                    Zitadel
                                </a>{" "}
                                project and configured by the MOWS Operator to integrate with your
                                Apps.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        );
    };
}