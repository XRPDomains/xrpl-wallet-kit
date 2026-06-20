import DefaultTheme from "vitepress/theme";
import PlaygroundWidget from "./components/PlaygroundWidget.vue";
import "./custom.css";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("PlaygroundWidget", PlaygroundWidget);
  },
};
