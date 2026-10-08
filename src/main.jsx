import React from "react";
import { createRoot } from "react-dom/client";
import { Agentation } from "agentation";
import { App } from "./App.jsx";
import {migratePrototypeUrl} from "./journey.js";
import { LanguageProvider } from "./i18n.jsx";
import "./styles.css";
import "./home.css";
import "./results.css";
import "./flow.css";
import "./contact-flow.css";
import "./v2.css";
import "./home-evolution.css";
import "./home-motion.css";
import "./search-flow.css";
import "./search-transition.css";
import "./mini-listing.css";
import "./search-map.css";
import "./compare-favorites.css";
import "./favorite-folders.css";
import "./account.css";
import "./mobile-polish.css";

const finalUrl = migratePrototypeUrl(location.href);
if (finalUrl) history.replaceState(history.state,"",finalUrl);

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LanguageProvider>
      <App />
      {import.meta.env.DEV ? <Agentation /> : null}
    </LanguageProvider>
  </React.StrictMode>,
);
