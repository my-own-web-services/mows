import { createRoot } from "react-dom/client";
import "../../main.css";

// Baseline scenario — imports nothing from @my-own-web-services/react-components. The
// measured bundle size here is "React + Vite overhead"; every other
// scenario's bundle minus this baseline is the cost of one component.
createRoot(document.getElementById(`root`)!).render(<div>baseline</div>);
