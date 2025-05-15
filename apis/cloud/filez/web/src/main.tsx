import { render } from "preact";
import App from "./App.tsx";
import "./index.css";
//@ts-ignore
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";

render(<App />, document.getElementById("root")!);
