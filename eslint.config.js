import {node} from "@zerebos/eslint-config";
import ts from "@zerebos/eslint-config-typescript";
import {defineConfig} from "eslint/config";

/** @type {import("@zerebos/eslint-config-typescript").ConfigArray} */
export default defineConfig(
    ...node,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- this file is not in the TS program, so the imported config array types resolve to `error`
    ...ts.configs.recommendedWithTypes,
    {
        rules: {
            "no-console": "off",
            "@typescript-eslint/no-misused-promises": ["error", {checksVoidReturn: {arguments: false, returns: false}}],
        }
    },
    {
        ignores: ["**/debug/**", "**/node_modules/**"]
    }
);