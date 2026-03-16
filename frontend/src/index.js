import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Agregar animación CSS para skeleton screens
const style = document.createElement("style");
style.textContent = `
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
`;
document.head.appendChild(style);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);