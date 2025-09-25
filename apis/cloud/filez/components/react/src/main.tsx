import ReactDOM from "react-dom/client";
import { FilezProvider } from "../lib/lib/FilezContext.tsx";
import "../lib/main.css";
import App from "./App.tsx";
import "./main.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <FilezProvider>
        <App />
    </FilezProvider>
);
