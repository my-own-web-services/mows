import { createRoot } from "react-dom/client";
import { CodeViewer } from "@my-own-web-services/react-components";
import "@my-own-web-services/react-components/main.css";
import "../../main.css";

// CodeViewer is deliberately heavy (Monaco). It's also the canonical
// "code-split heavy component" — the wrapper is small and ships in
// the eager bundle; Monaco itself hides behind a React.lazy(import())
// so the consumer only downloads it once the editor mounts.
//
// Two things this scenario validates:
//   1. CodeViewer (the wrapper) lands in the consumer's eager bundle
//      when imported via the main barrel.
//   2. Monaco does NOT land in the eager bundle — it must reach the
//      consumer's dist as a separate lazy chunk that index.html does
//      not directly reference.
createRoot(document.getElementById(`root`)!).render(
    <CodeViewer code={`const x = 1;`} language="javascript" />
);
