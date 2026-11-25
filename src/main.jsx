import React, {useState} from "react";
import { createRoot } from "react-dom/client";
import { Agentation } from "agentation";
import { App } from "./App.jsx";
import {migratePrototypeUrl} from "./journey.js";
import { LanguageProvider } from "./i18n.jsx";
import { PrototypeGate } from "./PrototypeGate.jsx";
import {passwordSource, readPrototypeUnlock, writePrototypeUnlock} from "./prototypeAccess.js";
import "./styles.css";
import "./home.css";
import "./results.css";
import "./flow.css";
import "./contact-flow.css";
import "./v2.css";
import "./home-evolution.css";
import "./home-motion.css";
import "./search-flow.css";
import "./price-insights.css";
import "./search-transition.css";
import "./mini-listing.css";
import "./favorite-folders.css";
import "./account.css";
import "./saved-searches.css";
import "./catalog-footer.css";
import "./mobile-polish.css";
import "./listing-panel.css";
import "./mora-voice.css";
import "./glass.css";
import "./prototype-gate.css";
import "./icon-button.css";
import "./project-guide.css";
import "./version-switcher.css";
import "./results-map.css";
import "./location-field.css";
import "./card-highlights.css";

const finalUrl = migratePrototypeUrl(location.href);
if (finalUrl) history.replaceState(history.state,"",finalUrl);

function GateOrApp() {
  const [unlocked, setUnlocked] = useState(() => readPrototypeUnlock(sessionStorage));
  if (!unlocked) return <PrototypeGate expected={passwordSource()} onUnlock={() => {writePrototypeUnlock(sessionStorage); setUnlocked(true);}}/>;
  return <App/>;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LanguageProvider>
      <GateOrApp />
      {import.meta.env.DEV ? <Agentation /> : null}
    </LanguageProvider>
  </React.StrictMode>,
);
