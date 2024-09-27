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
        description: "View k3s logs, run it on the node not in the manager"
    },
    {
        content: "k -n mows-dev-k8s-dashboard create token admin-user",
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
        content:
            "helm plugin install https://github.com/komodorio/helm-dashboard.git ; helm dashboard --bind=0.0.0.0",
        type: "default",
        description: "Install and run helm dashboard"
    },
    {
        content: "k kustomize --enable-helm /install/core/ | kubectl apply --server-side -f -",
        type: "default",
        description: "Apply kustomize resources"
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
            "kubectl port-forward -n mows-core-secrets-vault service/mows-vault-ui --address 0.0.0.0 8080:http",
        type: "default",
        description: "Forward vault ui to http://localhost:8080/ui/"
    }
];
// a notes component that persists notes in local storage

//hvs.it0SZYVxyvUhoBY9Mm0VuLyh F+l5Jh/wtjFGJcXRZLLbPn2vdHgldo1/kcNcDru6QsAB a8+EJc8zihMNdHPGiP+bSxE2TEeV61XwoQd4oLlxYvfm

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
