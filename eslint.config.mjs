import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Nested git worktrees (e.g. .claude/worktrees/<name>/) contain a full
    // copy of the project, including their own node_modules — without this,
    // running lint from the main checkout sweeps through them too.
    ".claude/**",
  ]),
]);

export default eslintConfig;
