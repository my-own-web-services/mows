/** @type {import('tailwindcss').Config} */
export default {
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}", "./lib/**/*.{js,ts,jsx,tsx}"],
    theme: {
        fontFamily: {},
        extend: {
            transitionProperty: {
                height: "height"
            }
        }
    },
    plugins: []
};
