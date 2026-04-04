// eslint.config.js
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    ignores: [
      "node_modules/**",
      "browse/dist/**",
      "design/dist/**",
      "supabase/functions/**"
    ]
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: [
      "bin/**/*.ts",
      "browse/**/*.ts",
      "design/**/*.ts",
      "lib/**/*.ts",
      "scripts/**/*.ts",
      "test/**/*.ts"
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "error"
    }
  }
);
