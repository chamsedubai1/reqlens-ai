import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ReqLens AI brand blue (from the logo/mockups).
        brand: {
          DEFAULT: "#2b7fff",
          dark: "#1e63d6",
          light: "#e8f1ff",
        },
      },
    },
  },
  plugins: [],
};
export default config;
