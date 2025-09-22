import "@fontsource/inter/400.css";
import "@fontsource/inter/700.css";
import { FilezProvider } from "filez-components-react";
import { render } from "preact";
import App from "./App";
import "./index.css";

render(
    <FilezProvider>
        <App></App>
    </FilezProvider>,
    document.getElementById("root")!
);
