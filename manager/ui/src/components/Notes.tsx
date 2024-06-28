import { Component } from "preact";
import { CSSProperties } from "preact/compat";
import { IoTrash } from "react-icons/io5";
import { Button, Input } from "rsuite";

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
}

const defaultNotes: Note[] = [
    {
        content: "sudo journalctl -u k3s -b",
        type: "default"
    },
    {
        content: "kubectl -n kubernetes-dashboard create token admin-user",
        type: "default"
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
                className={`Notes w-full rounded-lg bg-[black] p-4 ${this.props.className ?? ""}`}
            >
                <div className={"flex flex-col gap-4"}>
                    {notes.map((note, index) => (
                        <div key={index} className={"flex justify-between gap-2"}>
                            <pre>{note.content}</pre>
                            {note.type === "custom" && (
                                <Button
                                    onClick={() => this.removeNote(note.id)}
                                    size="xs"
                                    appearance="default"
                                    color="red"
                                >
                                    <IoTrash />
                                </Button>
                            )}
                        </div>
                    ))}
                </div>

                <div className={"flex gap-2 pt-4"}>
                    <Input
                        onChange={(value) => {
                            this.setState({ newNote: value });
                        }}
                        placeholder={"New Note"}
                        value={this.state.newNote}
                    />
                    <Button
                        onClick={this.addNote}
                        appearance={"primary"}
                        className={"flex-shrink-0"}
                    >
                        Add
                    </Button>
                </div>
            </div>
        );
    };
}
