/** @type {import('tailwindcss').Config} */
export default {
  // The app switches themes via a [data-theme] attribute on <html> (see
  // index.css), not the OS prefers-color-scheme media query. Point Tailwind's
  // `dark:` variant at that attribute so it tracks the in-app theme toggle.
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Derived from the committed palette; consumed as CSS variables so the
        // archive theme has a single source of truth in index.css.
        ground: "rgb(var(--ground) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        elevated: "rgb(var(--elevated) / <alpha-value>)",
        rule: "rgb(var(--rule) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        retrieval: "rgb(var(--retrieval) / <alpha-value>)",
        brass: "rgb(var(--brass) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
      },
      fontFamily: {
        display: ['"Fraunces"', "serif"],
        body: ['"Inter"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      screens: {
        sm_tablet: "600px",
        lg_tablet: "992px",
        sm_desktop: "1206px",
      },
    },
  },
  plugins: [],
};
