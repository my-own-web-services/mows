import "@fontsource/inter/400.css";
import "@fontsource/inter/700.css";
import { FilezProvider } from "filez-components-react";
import { render } from "preact";
import AppNew from "./AppNew";
import "./index.css";
import "./index.less";

render(
    <FilezProvider>
        <AppNew></AppNew>
    </FilezProvider>,
    document.getElementById("root")!
);
