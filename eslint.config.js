import {node} from "@zerebos/eslint-config";
import ts from "@zerebos/eslint-config-typescript";
import {defineConfig} from "eslint/config";

/** @type {import("@zerebos/eslint-config-typescript").ConfigArray} */
export default defineConfig(
    ...node,
    ...ts.configs.recommendedWithTypes,
    {
        rules: {
            "no-console": "off",
            "@typescript-eslint/no-misused-promises": ["error", {checksVoidReturn: {arguments: false, returns: false}}],
        }
    },
    {
        ignores: ["**/debug/**", "**/node_modules/**"]
    },
    {
        files: ["**/*.tsx"],
        rules: {
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-argument": "off"
        }
    }
);