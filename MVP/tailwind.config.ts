import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        "page-bg": "var(--page-bg)",
        "card-bg": "var(--card-bg)",
        "card-border": "var(--card-border)",
        "primary-btn": "var(--primary-button)",
        "primary-btn-hover": "var(--primary-button-hover)",
        "info-bg": "var(--info-bg)",
        "info-border": "var(--info-border)",
        "warning-bg": "var(--warning-bg)",
        "warning-border": "var(--warning-border)",
        "status-normal": "var(--status-normal-bg)",
        "status-restricted": "var(--status-restricted-bg)",
      },
      borderRadius: {
        "card": "var(--radius-lg)",
        "btn": "var(--radius-lg)",
        "input": "var(--radius-md)",
      },
      boxShadow: {
        "card": "var(--shadow-card)",
      },
    },
  },
  plugins: [],
};
export default config;
