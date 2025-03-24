import { Component } from "preact";
import { CSSProperties, useState } from "preact/compat";
import { IoCopy } from "react-icons/io5";
import { IconButton } from "rsuite";

interface NotesProps {
    readonly className?: string;
    readonly style?: CSSProperties;
}

interface NotesState {
    readonly newNote: string;
    readonly notes: Note[];
}

interface Note {
    id?: string;
    content: string;
    type: "default" | "custom";
    description?: string;
}

const defaultNotes: Note[] = [
    {
        content: "sudo journalctl -u k3s -b",
        type: "default",
        description: "View k3s logs, run it on the node not in the manager"
    },
    {
        content: "k -n mows-dev-k8s-dashboard create token admin-user --duration 488h",
        type: "default",
        description: "Create a token for the kubernetes-dashboard"
    },
    {
        content:
            "k delete ciliumclusterwidenetworkpolicy.cilium.io -A --all && k delete ciliumnetworkpolicy.cilium.io -A --all && k apply -f /install/core-apis/network/policies/",
        type: "default",
        description:
            "Re-apply network policies from install directory, omit the last part to just delete all policies"
    },
    {
        content: "k get ciliumendpoints -A",
        type: "default",
        description: "List cilium endpoints"
    },

    {
        content: "k logs POD -n NAMESPACE -c CONTAINER_IN_POD ",
        type: "default",
        description:
            "get logs from a specific container in a pod, useful for failing init containers"
    },
    {
        content: `k -n mows-core-argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d ; echo`,
        type: "default",
        description: "Get the argocd admin password"
    },
    {
        content:
            "kubectl port-forward -n mows-core-secrets-vault service/vault-ui --address 0.0.0.0 8080:http",
        type: "default",
        description: "Forward vault ui to http://localhost:8080/ui/"
    },
    {
        content:
            "kubectl port-forward -n mows-core-network-cilium service/hubble-ui --address 0.0.0.0 8080:http",
        type: "default",
        description: "Forward cilium/hubble ui to http://localhost:8080/ui/"
    },
    {
        content: `kubectl apply -f /operators/vault-resource-controller/yaml/crd.yaml && helm upgrade --install mows-core-secrets-vrc /operators/vault-resource-controller/charts/vrc/ -n mows-core-secrets-vrc --create-namespace ; helm upgrade mows-core-dns-pektin /apis/core/pektin/charts/pektin --create-namespace --namespace mows-core-dns-pektin --install ; kubectl apply -f /operators/pektin-resource-controller/yaml/crd.yaml && helm upgrade --install mows-core-dns-pektin-controller /operators/pektin-resource-controller/charts/pektin-resource-controller/ -n mows-core-dns-pektin --create-namespace `,
        description: "Install vault-resource-controller, pektin and pektin-resource-controller",
        type: "default"
    },
    {
        content:
            "kubectl port-forward -n mows-core-tracing service/mows-core-tracing-jaeger-query --address 0.0.0.0 8080:http-query",
        description: "Forward jaeger query to http://localhost:8080/",
        type: "default"
    },
    {
        content:
            "helm repo add jaegertracing https://jaegertracing.github.io/helm-charts ; helm upgrade mows-core-tracing-jaeger jaegertracing/jaeger -n mows-core-tracing --set allInOne.enabled=true --create-namespace --install --set storage.type=memory --set agent.enabled=false --set collector.enabled=false --set query.enabled=false --set provisionDataStore.cassandra=false",
        description: "Install jaeger all-in-one",
        type: "default"
    },
    {
        content: "Zitadel login data: zitadel-admin / Password1!",
        description: "Zitadel login data",
        type: "default"
    }
];

export default class Notes extends Component<NotesProps, NotesState> {
    constructor(props: NotesProps) {
        super(props);
        this.state = {
            newNote: "",
            notes: []
        };
    }

    getNotes = () => {
        // get notes from local storage and merge them with the default notes
        const notes = JSON.parse(localStorage.getItem("notes") ?? "[]") as Note[];
        return [...defaultNotes, ...notes];
    };

    addNote = async () => {
        const newNote: Note = {
            content: this.state.newNote,
            id: Math.random().toString(),
            type: "custom"
        };

        const notes = [...this.state.notes, newNote];
        localStorage.setItem("notes", JSON.stringify(notes));
        this.setState({ notes, newNote: "" });
    };

    removeNote = async (id?: string) => {
        const notes = this.state.notes.filter((note) => note.id !== id);
        localStorage.setItem("notes", JSON.stringify(notes));
        this.setState({ notes });
    };

    private static copyToClipboardButton = (content: string) => {
        // turn the button green when successfully copied

        const [copied, setCopied] = useState(false);

        return (
            <IconButton
                className={`max-h-8 ${copied ? "!bg-[#139d3f]" : ""}`}
                onClick={() => {
                    navigator.clipboard.writeText(content);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 500);
                }}
                icon={<IoCopy />}
            ></IconButton>
        );
    };

    render = () => {
        // combine the notes
        const notes = this.getNotes();
        return (
            <div
                style={{ ...this.props.style }}
                className={`Notes w-full ${this.props.className ?? ""}`}
            >
                <div className={"flex h-full flex-col gap-2 overflow-y-auto"}>
                    {notes.map((note, index) => (
                        <div key={index} className={"flex justify-between gap-2"}>
                            {Notes.copyToClipboardButton(note.content)}
                            <pre
                                className={
                                    "w-full max-w-full whitespace-pre-wrap break-words rounded-lg bg-[black] p-2"
                                }
                                title={note.description}
                            >
                                {note.content}
                            </pre>
                        </div>
                    ))}
                </div>
            </div>
        );
    };
}
