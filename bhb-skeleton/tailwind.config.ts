import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-sora)", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        bbb: {
          primary: "#33CB2B",
          strong: "#079516",
          dark: "#15803D",
          soft: "#EAFBE8",
          charcoal: "#1D1D1F",
          slate: "#737375",
          border: "#E6E7E8",
          bg: "#F6F8F6",
        },
      },
      boxShadow: {
        soft: "0 10px 30px rgba(29,29,31,0.06)",
        panel: "0 18px 50px rgba(29,29,31,0.08)",
      },
      maxWidth: { container: "1180px" },
    },
  },
  plugins: [],
};
export default config;
