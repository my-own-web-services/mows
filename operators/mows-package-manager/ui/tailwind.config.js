/** @type {import('tailwindcss').Config} */
export default {
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
        colors: {
            nightSky10: "#00040c",
            nightSky9: "#1A1D24",
            nightSky8: "#33363D",
            paper10: "#ffffff",
            paper9: "#d5d5d5",
            bavarianBlue10: "#0199FF",
            bavarianBlue9: "#1AA3FF",
            bavarianBlue8: "#34ADFF",
            bavarianBlue7: "#4DB8FF"
        },
        fontFamily: {
            sans: ["Inter Variable", "sans-serif"],
            mono: ["monospace"]
        },
        extend: {
            transitionProperty: {
                height: "height"
            }
        }
    },
    plugins: []
};
