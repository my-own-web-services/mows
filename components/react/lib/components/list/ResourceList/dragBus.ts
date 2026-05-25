import type { BaseResource } from "./ResourceListTypes";

// Module-level singleton describing the in-flight drag, if any.
// HTML5 drag-and-drop forbids reading dataTransfer payload during
// `dragover`, so target lists rely on this bus to know whether to
// accept the current drag and to read out the item payload after a
// drop. The session is mutated through the helpers below; subscribers
// are notified whenever it transitions to/from null.
export interface DragSession {
    readonly sourceListInstanceId: string;
    readonly resourceType: string;
    readonly fromIndices: readonly number[];
    readonly items: readonly BaseResource[];
    consumedBy?: string;
}

let session: DragSession | null = null;
const subscribers = new Set<(s: DragSession | null) => void>();

const notify = () => {
    subscribers.forEach((cb) => cb(session));
};

export const beginDrag = (info: Omit<DragSession, "consumedBy">) => {
    session = { ...info };
    notify();
};

// Called by the target list inside its drop handler to flag the drag
// as consumed. The source list reads this in its dragend handler to
// decide whether to splice the moved items out of its own cache.
export const completeDrag = (targetListInstanceId: string) => {
    if (session) session.consumedBy = targetListInstanceId;
};

// Returns the session as it was at drop time (with consumedBy set if
// the drop reached a target) and clears the singleton. Always called
// from the source row's dragend handler.
export const endDrag = (): DragSession | null => {
    const completed = session;
    session = null;
    notify();
    return completed;
};

export const getDragSession = (): DragSession | null => session;

export const subscribeDrag = (cb: (s: DragSession | null) => void): (() => void) => {
    subscribers.add(cb);
    return () => {
        subscribers.delete(cb);
    };
};
