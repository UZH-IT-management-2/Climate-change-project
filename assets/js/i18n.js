const SUPPORTED = ["en", "de", "fr", "it"];

export class I18n {
  constructor(defaultLanguage = "en") {
    this.defaultLanguage = defaultLanguage;
    this.language = defaultLanguage;
    this.messages = {};
  }

  detect() {
    const candidate = (navigator.language || this.defaultLanguage).slice(0, 2).toLowerCase();
    return SUPPORTED.includes(candidate) ? candidate : this.defaultLanguage;
  }

  async setLanguage(language) {
    this.language = SUPPORTED.includes(language) ? language : this.defaultLanguage;
    if (!this.messages[this.language]) {
      const response = await fetch(`locales/${this.language}.json`);
      if (!response.ok) throw new Error(`Unable to load locale ${this.language}`);
      this.messages[this.language] = await response.json();
    }
    document.documentElement.lang = this.language;
    this.apply(document);
    document.dispatchEvent(new CustomEvent("languagechange", { detail: { language: this.language } }));
  }

  t(key, variables = {}) {
    const message = this.messages[this.language]?.[key] ?? this.messages[this.defaultLanguage]?.[key] ?? key;
    return Object.entries(variables).reduce(
      (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
      message,
    );
  }

  apply(root) {
    root.querySelectorAll("[data-i18n]").forEach((element) => {
      element.textContent = this.t(element.dataset.i18n);
    });
    root.querySelectorAll("[data-i18n-aria]").forEach((element) => {
      element.setAttribute("aria-label", this.t(element.dataset.i18nAria));
    });
  }
}

export const supportedLanguages = SUPPORTED;

