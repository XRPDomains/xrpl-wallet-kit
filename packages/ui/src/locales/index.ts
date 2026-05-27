import { enUSMessages } from "./en-US";
import { viVNMessages } from "./vi-VN";
import type { WalletUiLocale, WalletUiMessages, WalletUiMessagesInput } from "./types";

export type { WalletUiLocale, WalletUiMessages, WalletUiMessagesInput } from "./types";
export { enUSMessages } from "./en-US";
export { viVNMessages } from "./vi-VN";

const localeAliases: Record<string, string> = {
  en: "en-US",
  vi: "vi-VN",
  ja: "ja-JP",
  ko: "ko-KR",
  // default to Simplified; use "zh-TW" for Traditional
  zh: "zh-CN"
};

const builtInMessages: Record<string, WalletUiMessages> = {
  "en-US": enUSMessages,
  "vi-VN": viVNMessages
};

export function resolveWalletUiMessages(locale: WalletUiLocale = "en-US", overrides: WalletUiMessagesInput = {}): WalletUiMessages {
  const normalizedLocale = normalizeWalletUiLocale(locale);
  return {
    ...(builtInMessages[normalizedLocale] ?? enUSMessages),
    ...overrides
  };
}

export function normalizeWalletUiLocale(locale: WalletUiLocale = "en-US"): string {
  return localeAliases[locale] ?? locale;
}
