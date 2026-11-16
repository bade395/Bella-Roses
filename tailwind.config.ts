import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        rose: {
          50: "#fff5f6",
          100: "#ffe8ec",
          500: "#c45b72",
          700: "#8f354c",
          900: "#4b1f2d"
        },
        cream: "#fbf8f3",
        ink: "#292326"
      },
      fontFamily: {
        sans: ["Arial", "Tahoma", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
