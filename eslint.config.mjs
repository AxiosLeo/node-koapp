import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default [...compat.extends("eslint:recommended"), {
    languageOptions: {
        globals: {
            ...globals.node,
            ...globals.browser,
            describe: true,
            it: true,
            before: true,
            after: true,
            beforeEach: true,
        },

        ecmaVersion: 2018,
        sourceType: "commonjs",

        parserOptions: {
            ecmaFeatures: {},
        },
    },

    rules: {
        indent: [2, 2, {
            SwitchCase: 1,
        }],

        quotes: [2, "single"],
        "linebreak-style": [2, "unix"],
        semi: [2, "always"],
        curly: 2,
        eqeqeq: 2,
        "no-eval": 2,
        "guard-for-in": 2,
        "no-caller": 2,
        "no-else-return": 2,
        "no-eq-null": 2,
        "no-extend-native": 2,
        "no-extra-bind": 2,
        "no-floating-decimal": 2,
        "no-implied-eval": 2,
        "no-labels": 2,
        "no-with": 2,
        "no-loop-func": 2,
        "no-native-reassign": 2,

        "no-redeclare": [2, {
            builtinGlobals: true,
        }],

        "no-delete-var": 2,
        "no-shadow-restricted-names": 2,
        "no-undef-init": 2,
        "no-use-before-define": 2,

        "no-unused-vars": [2, {
            args: "none",
        }],

        "no-undefined": 2,
        "no-undef": 2,
        "global-require": 0,
        "no-console": 2,

        "key-spacing": [2, {
            beforeColon: false,
            afterColon: true,
        }],

        "eol-last": [2, "always"],
        "no-inner-declarations": [1],
        "no-case-declarations": [1],

        "no-multiple-empty-lines": [2, {
            max: 1,
            maxBOF: 1,
        }],

        "space-in-parens": [2, "never"],

        "no-multi-spaces": [2, {
            ignoreEOLComments: true,
        }],
    },
}];