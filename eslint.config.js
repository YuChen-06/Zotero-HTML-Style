import zotero from "@zotero-plugin/eslint-config";
import globals from "globals";

export default [
  ...zotero(),
  {
    files: ["**/*.mjs", "scripts/**/*.js"],
    languageOptions: {
      globals: globals.node,
    },
  },
];
