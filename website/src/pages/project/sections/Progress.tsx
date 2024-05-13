import { Component } from "preact";
import Collapsible from "../../../components/Collapsible";
import HashNavLink from "../../../components/HashNavLink";
import { CSSProperties } from "react";

interface ProgressPart {
    name: string;
    logo: string;
    milestones: Milestone[];
}

interface Milestone {
    name: string;
    description: string;
    priority: number;
    tasks: Task[];
}

interface Task {
    name: string;
    description: string;
    status: "done" | "todo" | "inProgress";
    priority: number;
    tasks?: Task[];
}

const parts: ProgressPart[] = [
    {
        name: "Manager",
        logo: "manager",
        milestones: [
            {
                name: "Install Cluster",
                description:
                    "Install the OS, the core APIs and the MOWS Operator automatically on a cluster",
                priority: 1,
                tasks: [
                    {
                        name: "Install OS",
                        description: "Install KairOS with k3s on VMs",
                        status: "done",
                        priority: 1,
                        tasks: [
                            {
                                name: "Create VMs",
                                description: "Create VMs for the cluster",
                                status: "done",
                                priority: 1
                            },
                            {
                                name: "Setup Netboot",
                                description: "Setup netboot to install the system on the VMs",
                                status: "done",
                                priority: 1
                            }
                        ]
                    },
                    {
                        name: "Install Core APIs",
                        description: "Install and configure MOWS Core APIs and services",
                        status: "inProgress",
                        priority: 1
                    },
                    {
                        name: "Install Operator",
                        description: "Install MOWS Operator",
                        status: "todo",
                        priority: 1
                    },
                    {
                        name: "Install OS on Hardware",
                        description: "Install the OS on real hardware",
                        status: "todo",
                        priority: 2
                    },
                    {
                        name: "Install OS on remote machines",
                        description: "Install the OS on remote machines",
                        status: "todo",
                        priority: 2
                    },

                    {
                        name: "Drive Provisioning",
                        description: "Setup automatic hard drive provisioning",
                        status: "todo",
                        priority: 3
                    },
                    {
                        name: "Automatic Updates",
                        description: "Setup automatic updates for the cluster",
                        status: "todo",
                        priority: 3
                    }
                ]
            },
            {
                name: "Static IP Ingress",
                description: "Setup public static IP ingress at remote provider",
                priority: 2,
                tasks: [
                    {
                        name: "Hetzner",
                        description: "Create ingress with hcloud VM",
                        status: "todo",
                        priority: 1
                    }
                ]
            },
            {
                name: "Backup Machine",
                description: "Setup backup machine for MOWS",
                priority: 2,
                tasks: []
            },
            {
                name: "Full Cluster Restore",
                description: "Restore a full cluster from backup",
                priority: 3,
                tasks: []
            },
            {
                name: "Automatic DNS Setup",
                description: "Setup DNS records for MOWS",
                priority: 4,
                tasks: []
            }
        ]
    },
    {
        name: "Operator",
        logo: "operator",
        milestones: [
            {
                name: "Create Operator",
                description: "Create the MOWS Operator with its additional components",
                priority: 1,
                tasks: []
            },
            {
                name: "Manifest Specification",
                description: "Create the MOWS app manifest specification",
                priority: 2,
                tasks: []
            },
            {
                name: "App Lifecycle",
                description: "Implement app lifecycle management",
                priority: 2,
                tasks: []
            },
            {
                name: "Health Checks",
                description: "Implement health checks for the cluster",
                priority: 3,
                tasks: []
            }
        ]
    },
    {
        name: "Hardware",
        logo: "hardware",
        milestones: [
            {
                name: "Create and integrate the first Cluster",
                description: "Select hardware and configure it to fit the operation",
                priority: 1,
                tasks: [
                    {
                        name: "Select Hardware",
                        description: "Select hardware for the cluster",
                        status: "done",
                        priority: 1
                    },
                    {
                        name: "Configure Hardware",
                        description: "Configure hardware for the cluster",
                        status: "done",
                        priority: 1
                    },
                    {
                        name: "Create full Cluster",
                        description: "Create a full cluster with the selected hardware",
                        status: "todo",
                        priority: 1
                    },
                    {
                        name: "Automatic BIOS Setup",
                        description: "Setup the BIOS settings automatically",
                        status: "todo",
                        priority: 2
                    }
                ]
            },
            {
                name: "Automate BIOS Setup",
                description: "Automate the BIOS setup for the cluster",
                priority: 2,
                tasks: [
                    {
                        name: "Create Pico KVM",
                        description: "Create a working Pico KVM",
                        status: "todo",
                        priority: 1
                    },
                    {
                        name: "Create Assistant",
                        description:
                            "Create an assistant that can automatically adjust the BIOS settings by reading the display output over a hdmi capture card, and sending keyboard commands with the Pico KVM",
                        status: "todo",
                        priority: 2
                    }
                ]
            }
        ]
    },
    {
        name: "Cloud APIs",
        logo: "cloud_apis",
        milestones: [
            {
                name: "File API",
                description: "Create a file API",
                priority: 1,
                tasks: []
            },
            {
                name: "Auth API",
                description: "Create a auth API",
                priority: 1,
                tasks: []
            },
            {
                name: "Config API",
                description:
                    "Create a config API for providing user settings to apps, language, theme, etc.",
                priority: 2,
                tasks: []
            },
            {
                name: "Notification API",
                description: "Create a notification API",
                priority: 2,
                tasks: []
            },
            {
                name: "AI API",
                description: "Create a artificial intelligence API",
                priority: 3,
                tasks: []
            },
            {
                name: "Realtime API",
                description: "Create a realtime API",
                priority: 3,
                tasks: []
            }
        ]
    },
    {
        name: "Apps",
        logo: "apps",
        milestones: [
            {
                name: "Password Manager",
                description: "Create a password manager",
                priority: 1,
                tasks: []
            },
            {
                name: "Music Player",
                description: "Create a music player with synchronized listening",
                priority: 1,
                tasks: []
            },
            {
                name: "Video Player",
                description: "Create a video player",
                priority: 1,
                tasks: []
            },

            {
                name: "Photo Gallery",
                description: "Create a photo gallery",
                priority: 1,
                tasks: []
            },
            {
                name: "Life Services",
                description:
                    "Create a app for mood tracking, journaling, health tracking, calendar for future and past, tracking of routes, visited places and more all in one, file e2e encrypted",
                priority: 1,
                tasks: []
            },
            {
                name: "File Downloader",
                description: "Create a app for downloading files from the web and torrents",
                priority: 1,
                tasks: []
            },
            {
                name: "Public/Private photo diary sites with friends",
                description: "Create a app similar to hexlerz",
                priority: 1,
                tasks: []
            },
            {
                name: "Simple Blog",
                description: "Create a easy to use blog system",
                priority: 1,
                tasks: []
            }
        ]
    }
];

interface ProgressProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly id?: string;
}
interface ProgressState {}
export default class Progress extends Component<ProgressProps, ProgressState> {
    Milestone = (milestone: Milestone, index?: number) => {
        const completed = milestone.tasks.filter(task => task.status === "done");
        return (
            <div className={"milestone"}>
                <div className={"topLine"}>
                    <span className={"name"}>{milestone.name}</span>
                    <div className={`priority p${milestone.priority}`}>
                        <span>{milestone.priority}</span>
                    </div>
                    <span>
                        {completed.length}/{milestone.tasks.length}
                    </span>
                </div>
                <div>{milestone.description}</div>

                <br />
                <div>{milestone.tasks.sort((a, b) => a.priority - b.priority).map(this.Task)}</div>
            </div>
        );
    };

    Task = (task: Task, index?: number) => {
        return (
            <Collapsible
                className={"pusher"}
                key={index}
                title={
                    <div className={"task"}>
                        <div className={`priority p${task.priority}`}>
                            <span>{task.priority}</span>
                        </div>
                        <span className={"icon"}>
                            {task.status === "done" ? "✅" : task.status === "todo" ? "❌" : "🚧"}
                        </span>
                        <span title={task.name} className={`taskName ${task.status}`}>
                            {task.name}
                        </span>
                    </div>
                }
            >
                <div className={"taskDescription"}>{task.description}</div>

                {task.tasks?.sort((a, b) => a.priority - b.priority).map(this.Task)}
            </Collapsible>
        );
    };

    render = () => {
        return (
            <div
                className={`Progress ${this.props.className}`}
                style={{ ...this.props.style }}
                id={this.props.id}
            >
                <HashNavLink className={this.props.id}>
                    <h1>Progress</h1>
                </HashNavLink>
                {parts.map(part => (
                    <Collapsible
                        className="subprojectCollapsible"
                        title={
                            <div className={"wipSubprojectName"}>
                                <img
                                    src={`/assets/logos/${part.logo}_logo.svg`}
                                    alt={part.name}
                                    width={100}
                                    height={100}
                                />
                                <span>{part.name}</span>
                            </div>
                        }
                    >
                        <div className={"subproject"}>
                            <div className={"milestones"}>
                                {part.milestones
                                    .sort((a, b) => a.priority - b.priority)
                                    .map(this.Milestone)}
                            </div>
                        </div>
                    </Collapsible>
                ))}
            </div>
        );
    };
}
