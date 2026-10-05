# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Linting

Linting uses [oxlint](https://oxc.rs/docs/guide/usage/linter) (configured in `.oxlintrc.json`): the ESLint and typescript-eslint recommended rules, the React Hooks rules (including the React Compiler checks such as `set-state-in-effect`, `refs` and `purity`) and fast-refresh `only-export-components`. `src/components/ui` (vendored shadcn/ui) is exempt from the React-specific rules.

```sh
npm run lint       # check
npm run lint:fix   # apply the safe automatic fixes
```

Suppress a finding on one line with `// oxlint-disable-next-line <rule>` and say why. In VS Code, install the **Oxc** extension (`oxc.oxc-vscode`) for inline results.
