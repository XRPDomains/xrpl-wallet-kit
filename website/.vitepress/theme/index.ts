import DefaultTheme from "vitepress/theme";
import PlaygroundWidget from "./components/PlaygroundWidget.vue";
import "./custom.css";
import "./theme-xrpdomains.css";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("PlaygroundWidget", PlaygroundWidget);

    // Inject XRPDomains theme class so .xd-theme rules activate.
    // custom.css (amber) remains the base; this layer overrides tokens on top.
    if (typeof document !== "undefined") {
      document.documentElement.classList.add("xd-theme");
    }
  },
};
