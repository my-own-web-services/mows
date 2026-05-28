import { createRoot } from "react-dom/client";
import { Button } from "@my-own-web-services/react-components";
import "@my-own-web-services/react-components/main.css";
import "../../main.css";

// Imports ONE small primitive from the main entry — the canonical
// consumer pattern. If tree-shaking works the dist must not contain
// Monaco, Shaka, MapLibre, or any other heavy dep that the lib happens
// to bundle elsewhere.
createRoot(document.getElementById(`root`)!).render(<Button>hello</Button>);
