import ReactDOM from "react-dom/client";
import App from "./App";
import { ToastProvider } from "./contexts/ToastContext";
import "./index.css";
import "./styles.css";

window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled rejection:', event.reason);
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <ToastProvider>
    <App />
  </ToastProvider>
);
