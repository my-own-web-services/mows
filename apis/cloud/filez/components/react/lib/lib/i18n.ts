import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import Backend from "i18next-http-backend";
import { initReactI18next } from "react-i18next";

i18n.use(Backend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        fallbackLng: "en-US",
        debug: true,
        backend: {
            loadPath: "/locales/{{lng}}/default.json"
        }
    });

export default i18n;

export interface Language {
    code: string;
    originalName: string;
    englishName: string;
    emoji: string;
}

export const languages: Language[] = [
    {
        code: "de",
        originalName: "Deutsch",
        englishName: "German",
        emoji: "🇩🇪"
    },
    {
        code: "en-US",
        originalName: "English (US)",
        englishName: "English (US)",
        emoji: "🇺🇸"
    }
];
