import { createRoot } from "react-dom/client";
import Home from "../app/page";
import "../app/globals.css";

// Keep old game access on its original origin, where browser sessions exist.
const originalGameUrl="https://sushi-showdown.turtlecap.chatgpt.site/";
if(window.location.pathname==="/recover")window.location.replace(`${originalGameUrl}recover`);
else createRoot(document.getElementById("root")!).render(<Home originalGameUrl={originalGameUrl}/>);
