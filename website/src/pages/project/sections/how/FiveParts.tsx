import { Component, RefObject, createRef } from "preact";
import HashNavLink from "../../../../components/HashNavLink";

import ManifestExampleImage from "../../../../assets/manifest_example.jpg";
import ClusterFailure from "../../../../components/animations/ClusterNodeFailure";
import AnyMachine from "../../../../components/animations/AnyMachine";
import CloudAPIs from "./CloudAPIs";
import Toggle from "../../../../components/Toggle";
import { animationsEnabled } from "../../../../components/Nav";
import Figure from "../../../../components/Figure";
import AnimationToggle from "../../../../components/animations/AnimationToggle";

interface FivePartsProps {
    readonly id?: string;
}
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
        const h2Class = "text-center md:text-left text-4xl font-bold";
        return (
            <section id={this.props.id}>
                <HashNavLink className={this.props.id}>
                    <h1>One Vision, Five Parts</h1>
                </HashNavLink>
                <p className={"largeText"}>
                    MOWS consists of five parts: Operator, Manager, Hardware, Cloud APIs and Apps.
                    The parts are designed to work together seamlessly, providing a complete
                    solution for managing your own web services without compromising on the
                    flexibility to run whatever you want.
                </p>

                <div className={"mt-32 intersect"} id="FivePartsManager">
                    <HashNavLink className={"FivePartsManager"}>
                        <h2 className={h2Class}>Manager</h2>
                    </HashNavLink>
                    <div className={"flex flex-col-reverse md:flex-row"}>
                        <p className={"largeText"}>
                            The Manager handles everything that can’t be performed on the cluster.
                            It handles the setup, adding or removing of nodes or drives, decryption
                            of the drives on a full restart, and recovering the cluster from backup
                            in case of a complete failure.
                        </p>
                        <img
                            width={400}
                            height={400}
                            src={"/assets/logos/manager_logo.svg"}
                            alt="Manager Logo"
                            className={"glow md:w-[50%] -my-20 md:-my-40"}
                            loading={"lazy"}
                        />
                    </div>
                    <div className={"w-full py-10"}>
                        <img
                            width={1482}
                            height={982}
                            src="/assets/diagrams/manager.svg"
                            alt="Diagram showing a MOWS manager"
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
                                    physical machines and rented remote machines can be used.
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
                            <Figure
                                className={"w-[100%] md:w-[50%] h-[300px]"}
                                caption={
                                    <>
                                        Use any machine: Local, VM or Rented. Switch anytime.
                                        <AnimationToggle />
                                    </>
                                }
                            >
                                <AnyMachine
                                    className="w-full h-full"
                                    ref={this.anyMachine}
                                    loop={true}
                                />
                            </Figure>
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
                                works by starting the removal procedure in the manager UI that will
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

                <div className={"mt-20 intersect"} id="FivePartsOperator">
                    <HashNavLink className={"FivePartsOperator"}>
                        <h2 className={h2Class}>Operator + Core APIs</h2>
                    </HashNavLink>
                    <div className={"flex flex-col-reverse md:flex-row "}>
                        <p className={"largeText "}>
                            The Operator is the brain of the system and has its components running
                            on all computers in the cluster. It handles the internal operation,
                            resource allocation and the lifecycle of applications. It also runs
                            backups, health checks and many other tasks. The Operator goes hand in
                            hand with the Core APIs, which provide the building blocks for the
                            System.
                        </p>

                        {/* don't use css: scale here as it messes with the layout in chrome when jumping to an element with id by using the #id in the url (not a problem in firefox) */}
                        <img
                            width={400}
                            height={400}
                            draggable={false}
                            src={"/assets/logos/operator_logo.svg"}
                            className={"glow md:w-[50%] -my-20 md:-my-40"}
                            alt="Operator Logo"
                            loading={"lazy"}
                        />
                    </div>
                    <div className={"w-full py-10"}>
                        <img
                            width={1482}
                            height={982}
                            src="/assets/diagrams/cluster.svg"
                            alt="Diagram showing a MOWS cluster"
                        />
                    </div>
                    <div className={"mt-10"}>
                        <div
                            className={
                                "flex flex-col md:flex-row gap-10 justify-center md:justify-start items-center mt-10"
                            }
                        >
                            <div>
                                <HashNavLink className={"FivePartsOperatorCoreAPIs"}>
                                    <h3>Core APIs</h3>
                                </HashNavLink>
                                <p>
                                    The Core APIs provide the basics for a stateful distributed
                                    system. These APIs are needed as Kubernetes is not a complete
                                    system by itself compared to for example Docker which brings all
                                    the required components with it. This makes it more difficult to
                                    setup but also more flexible in it's use.
                                    <br />
                                    <br />
                                    The Core APIs are:
                                    <ul className={"list-disc list-outside ml-6"}>
                                        <li>
                                            Longhorn, providing replicated storage including backup
                                            procedures
                                        </li>
                                        <li>
                                            KubeVIP, providing a virtual IP to the cluster to reach
                                            the control plane on a single IP that automatically
                                            fails over to another node in case of a node failure
                                        </li>
                                        <li>
                                            Cilium as a network provider, providing a fast and
                                            secure connection between nodes and applications as well
                                            as network isolation
                                        </li>
                                        <li>
                                            Kubevirt for running virtual machines on the cluster
                                        </li>
                                        <li>
                                            Pektin DNS for resolving the names of the applications
                                            to their IPs
                                        </li>
                                        <li>
                                            Verkehr, a reverse proxy that terminates TLS and routes
                                            the traffic to the right application
                                        </li>
                                        <li>
                                            The MOWS Operator, that manages the applications and the
                                            cluster
                                        </li>
                                    </ul>
                                </p>
                            </div>
                            <div className={"w-full md:w-[50%]"}>
                                <img
                                    width={100}
                                    height={99.999992}
                                    className={"w-full"}
                                    src="/assets/diagrams/apis_core.svg"
                                    alt="Diagram showing the core APIs of MOWS"
                                />
                            </div>
                        </div>
                        <div
                            className={
                                "flex flex-col md:flex-row gap-10 justify-center md:justify-start items-center mt-10"
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
                                    Cloud APIs. <br /> The administrator of the cluster can install
                                    apps through a web interface, choosing if they want to give an
                                    app the requested resources, to adjust them, or to deny the
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
                                    loading={"lazy"}
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

                            <Figure
                                caption={
                                    <>
                                        A failing node and the recovery process of the cluster.
                                        <AnimationToggle />
                                    </>
                                }
                            >
                                <ClusterFailure loop ref={this.clusterNodeFailure} />
                            </Figure>
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

                <CloudAPIs
                    className={"mt-32 intersect"}
                    h2Class={h2Class}
                    id="FivePartsCloudAPIs"
                />

                <div className={"mt-32 intersect"} id="FivePartsHardware">
                    <HashNavLink className={"FivePartsHardware"}>
                        <h2 className={h2Class}>Hardware</h2>
                    </HashNavLink>
                    <div className={"flex flex-col-reverse md:flex-row"}>
                        <p className={"largeText"}>
                            The hardware part of the project aims to provide a well-integrated,
                            performant, cost-effective solution as a base for the system on top. You
                            can build it yourself from parts, or buy the assembled version to save
                            some time. To automate the installation on bare metal and facilitate
                            this process for consumer hardware as much as possible, the manager is
                            extended with a few components and a cheap KVM solution is provided.
                        </p>
                        <img
                            width={400}
                            height={400}
                            src={"/assets/logos/hardware_logo.svg"}
                            alt="Hardware Logo"
                            className={"glow md:w-[50%] -my-20 "}
                            loading={"lazy"}
                        />
                    </div>
                    <div className={"Parts"}>
                        <div className={"mt-10"}>
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
                                custom solution will be created that has a Pi Pico forwarding
                                keystrokes to the other computer.
                            </p>
                        </div>
                    </div>
                </div>

                <div className={"mt-32 intersect"} id="FivePartsApps">
                    <HashNavLink className={"FivePartsApps"}>
                        <h2 className={h2Class}>Apps</h2>
                    </HashNavLink>
                    <div className={"flex flex-col-reverse md:flex-row"}>
                        <p className={"largeText"}>
                            The MOWS Apps aim to cover the basic needs of everyday users as well as
                            showing the possibilities and ease of use of the MOWS Cloud APIs and
                            components.
                        </p>

                        <img
                            width={400}
                            height={400}
                            src={"/assets/logos/apps_logo.svg"}
                            alt="Apps Logo"
                            className={"glow md:w-[50%] -my-16 "}
                            loading={"lazy"}
                        />
                    </div>
                    <div className={"Parts"}></div>
                </div>
            </section>
        );
    };
}
