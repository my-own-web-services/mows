/** @type {import('tailwindcss').Config} */
export default {
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
        colors: {
            background: "#00040c",
            primary: "#ffffff",
            primaryDim: "#d5d5d5",
            accent1: "#ff3a16",
            accent1Opaque: "#ff39165e",
            accent1Opaque2: "#ff391627",
            accent2: "#0199ff",
            accent2Opaque: "#0199ff5e",
            accent2Opaque2: "#0199ff27",
            accent3: "#ffb627"
        },
        extend: {
            transitionProperty: {
                height: "height"
            }
        }
    },
    plugins: []
};
