import { Component } from "preact";
import { CSSProperties } from "preact/compat";

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
        description: "View k3s logs"
    },
    {
        content: "kubectl -n mows-dev-k8s-dashboard create token admin-user",
        type: "default",
        description: "Create a token for the kubernetes-dashboard"
    },
    {
        content:
            "kubectl delete ciliumclusterwidenetworkpolicy.cilium.io -A --all && kubectl delete ciliumnetworkpolicy.cilium.io -A --all && kubectl apply -f /install/core-apis/network/policies/",
        type: "default",
        description:
            "Re-apply network policies from install directory, omit the last part to just delete all policies"
    },
    {
        content: "kubectl get ciliumendpoints -A",
        type: "default",
        description: "List cilium endpoints"
    },
    {
        content:
            "helm plugin install https://github.com/komodorio/helm-dashboard.git ; helm dashboard --bind=0.0.0.0",
        type: "default",
        description: "Install and run helm dashboard"
    },
    {
        content: "kubectl port-forward service/my-argo-cd-argocd-server 8080:80 --address=0.0.0.0",
        type: "default",
        description: "Forward argo-cd service to https://localhost:8080"
    },
    {
        content: "kubectl kustomize --enable-helm /install/argocd/ | kubectl apply -f -",
        type: "default",
        description: "Apply kustomize resources"
    }
];
// a notes component that persists notes in local storage

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
