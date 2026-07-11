import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ReqLens AI brand palette (from the logo/mockups).
        brand: {
          DEFAULT: "#2563eb", // blue-600
          dark: "#1d4ed8", // blue-700
          light: "#eff6ff", // blue-50
          50: "#eff6ff",
          100: "#dbeafe",
          600: "#2563eb",
          700: "#1d4ed8",
        },
        // Teal-green accent (the "AI" wordmark + "encrypted & secure").
        accent: {
          DEFAULT: "#10b981", // emerald-500
          dark: "#059669",
          light: "#d1fae5",
        },
        ink: "#0f172a", // slate-900 headings
      },
      boxShadow: {
        card: "0 10px 40px -12px rgba(37, 99, 235, 0.18)",
      },
      backgroundImage: {
        "brand-mesh":
          "radial-gradient(1200px 600px at -10% -20%, #dbeafe 0%, transparent 55%), radial-gradient(900px 500px at 110% 120%, #dbeafe 0%, transparent 55%)",
      },
    },
  },
  plugins: [],
};
export default config;
