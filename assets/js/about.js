import { I18n } from "./i18n.js";

const languageSelect = document.querySelector("#language-select");
const i18n = new I18n("en");
await i18n.setLanguage(i18n.detect());
languageSelect.value = i18n.language;
languageSelect.addEventListener("change", () => i18n.setLanguage(languageSelect.value));

