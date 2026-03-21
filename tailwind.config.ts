import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#081420",
        cream: "#f7f4ea",
        turf: "#1c7c54",
        amber: "#ee964b",
        rose: "#c44536",
      },
      boxShadow: {
        panel: "0 24px 80px rgba(8, 20, 32, 0.15)",
      },
    },
  },
  plugins: [],
};

export default config;
