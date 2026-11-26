import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-ui)"],
      },
      colors: {
        brand: "hsl(var(--brand))",
        action: { DEFAULT: "hsl(var(--action))", foreground: "hsl(var(--action-text))" },
        surface: { DEFAULT: "hsl(var(--surface-default))", canvas: "hsl(var(--surface-canvas))", header: "hsl(var(--surface-global-header))", table: "hsl(var(--surface-table-header))", selection: "hsl(var(--surface-selection))", active: "hsl(var(--surface-active))" },
        "border-control": "hsl(var(--border-control))",
        "status-low-grade": "hsl(var(--status-low-grade))",
        "status-low-grade-bg": "hsl(var(--status-low-grade-bg))",
        "status-pending": "hsl(var(--status-pending))",
        "status-pending-bg": "hsl(var(--status-pending-bg))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "var(--radius-field)",
        sm: "var(--radius-cell)",
        button: "var(--radius-button)",
        table: "var(--radius-table)",
        card: "var(--radius-card)",
        modal: "var(--radius-modal)",
        tooltip: "var(--radius-tooltip)",
      },
      boxShadow: {
        sm: "var(--shadow-subtle)",
        surface: "var(--shadow-surface)",
        overlay: "var(--shadow-overlay)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
