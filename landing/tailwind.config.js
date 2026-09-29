/** @type {import('tailwindcss').Config} */
// ПрактикаПлюс design tokens (shared by the mini app, the cabinet and the
// landing): an electric "MAX blue" primary scale with a violet accent for
// gradients. `blue` is overridden on purpose so every `blue-*` utility in
// the codebase follows the brand.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        blue: {
          50: "#EEF4FF", 100: "#DCE8FF", 200: "#BDD4FF", 300: "#8FB6FF", 400: "#5A91FF",
          500: "#2F72FF", 600: "#1664FF", 700: "#0B55F0", 800: "#0B45C4", 900: "#0F3A9A", 950: "#0D2560",
        },
        violet: {
          50: "#F4F0FF", 100: "#EAE2FF", 200: "#D6C8FF", 300: "#B9A0FF", 400: "#9A73FB",
          500: "#7E4DF6", 600: "#6E3CF5", 700: "#5B2BD9", 800: "#4B25B0", 900: "#3E228C", 950: "#261357",
        },
        ink: { DEFAULT: "#0B1220", soft: "#475467", mute: "#98A2B3" },
      },
      fontFamily: {
        sans: ["'Inter Variable'", "Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,.04), 0 8px 24px -12px rgba(16,24,40,.12)",
        lift: "0 12px 32px -12px rgba(11,85,240,.35)",
      },
      backgroundImage: {
        brand: "linear-gradient(135deg, #2F8BFF 0%, #1664FF 45%, #6E3CF5 100%)",
      },
      keyframes: {
        "sheet-up": { "0%": { transform: "translateY(100%)" }, "100%": { transform: "translateY(0)" } },
        "fade-in": { "0%": { opacity: 0 }, "100%": { opacity: 1 } },
        "toast-in": { "0%": { opacity: 0, transform: "translateY(-8px) scale(.98)" }, "100%": { opacity: 1, transform: "translateY(0) scale(1)" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        "fade-up": { "0%": { opacity: 0, transform: "translateY(16px)" }, "100%": { opacity: 1, transform: "translateY(0)" } },
      },
      animation: {
        "sheet-up": "sheet-up .28s cubic-bezier(.16,1,.3,1)",
        "fade-in": "fade-in .2s ease-out",
        "toast-in": "toast-in .22s cubic-bezier(.16,1,.3,1)",
        shimmer: "shimmer 1.4s infinite",
        "fade-up": "fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) both",
      },
    },
  },
  plugins: [],
};
