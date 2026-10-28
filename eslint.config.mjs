import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Accessibility rules on top of the Next defaults: interactive elements
  // need labels, images need alt text, and keyboard users must have a clear
  // focus path. The app is a keyboard-and-screen-reader product first — logs
  // are written from a desk, not a swipe — so these are errors, not warnings.
  // The plugin itself is already registered by eslint-config-next; this object
  // applies its recommended rules without redefining the plugin.
  {
    name: "jsx-a11y/recommended-rules",
    languageOptions: jsxA11y.flatConfigs.recommended.languageOptions,
    rules: jsxA11y.flatConfigs.recommended.rules,
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
