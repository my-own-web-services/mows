import ReactDOM from "react-dom/client";
import { FilezProvider } from "../lib/FilezContext.tsx";
import "../lib/index.css";
import App from "./App.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <FilezProvider>
        <App />
    </FilezProvider>
);
