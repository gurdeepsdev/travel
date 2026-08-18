import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: [
      "node_modules/**",
      "coverage/**",
      "reports/**",
      "logs/**",
      "*.log",
      "*.logtail",
      "*.zip",
      "src/modules/users/users.service.old.js",
      "**/*.backup",
    ],
  },

  js.configs.recommended,

  {
    files: ["src/**/*.js"],

    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",

      globals: {
        ...globals.node,
      },
    },

    rules: {
      "no-console": "warn",

      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],

      "no-constant-condition": [
        "error",
        {
          checkLoops: false,
        },
      ],

      "no-useless-catch": "error",
      "no-duplicate-imports": "error",
      "prefer-const": "error",
      "no-var": "error",
      eqeqeq: ["error", "always"],
      curly: ["error", "all"],
    },
  },

  {
    files: ["tests/**/*.js", "jest.config.js", "jest.config.cjs"],

    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",

      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },

    rules: {
      "no-console": "off",
    },
  },
];
