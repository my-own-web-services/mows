import * as React from "react";
import { cn } from "@/lib/utils";
import type { NodeEditorProps } from "./types";

// `@xyflow/react` plus its base CSS is heavy and only used by callers that
// actually mount a node editor. Splitting the real implementation behind
// `React.lazy` keeps the rest of `@mows/react-components` out of paying for
// that bundle on initial load.
const LazyNodeEditorImpl = React.lazy(() => import(`./NodeEditorImpl`));

const Fallback: React.FC<{ className?: string; style?: React.CSSProperties }> = ({
    className,
    style
}) => (
    <div
        className={cn(`bg-muted/30 h-full min-h-[400px] w-full animate-pulse rounded-md`, className)}
        style={style}
        aria-hidden
    />
);

/**
 * Visual graph editor backed by React Flow (xyflow).
 *
 * Supports custom node renderers (embed any React component), drag-to-
 * connect from any handle, and strict-equality port-type checking via
 * `<TypedHandle portType="...">`. The implementation is loaded lazily —
 * consumers that import `NodeEditor` but never mount it don't ship the
 * `@xyflow/react` bundle.
 */
const NodeEditor: React.FC<NodeEditorProps> = (props) => (
    <React.Suspense fallback={<Fallback className={props.className} style={props.style} />}>
        <LazyNodeEditorImpl {...props} />
    </React.Suspense>
);

export default NodeEditor;
