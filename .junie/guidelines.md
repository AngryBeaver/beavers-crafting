### Project Guidelines: Beaver's Crafting

This document provides project-specific information for developers working on Beaver's Crafting.

#### 1. Build and Configuration

The project uses **pnpm** and an **esbuild** script (`build.mjs`) for building and packaging.

- **Standard Build**: Run `pnpm build` to bundle the sources into `dist/src/main.js` and generate the `dist/` folder.
- **Development Watch**: Run `pnpm devwatch` to automatically rebuild and copy files to your Foundry VTT modules folder.
  - **Important**: You must configure the `devDir` in `package.json` to point to your Foundry data directory (e.g., `C:\\Users\\Name\\AppData\\Local\\FoundryVTT\\Data\\modules`).
- **Typecheck**: Run `pnpm typecheck`; esbuild does not check types.
- **Release Packaging**: Run `pnpm release` to create a production-ready ZIP file in the `package/` directory.

#### 2. Testing Information

Automated testing is currently not supported for this project. Testing must be performed manually within Foundry VTT.

#### 3. Development and Code Style

- **Language**: Use TypeScript for all logic (`src/` folder). esbuild bundles everything into a single ES module.
- **Foundry Integration**:
  - Main entry point is `src/main.js`.
  - `module.json` is a template; `{{name}}`, `{{title}}`, `{{version}}`, `{{description}}` are filled from `package.json` at build time.
  - Use the wrappers in `src/helpers/Compat.js` instead of globals Foundry has namespaced (`renderTemplate`, `getTemplate`, `DragDrop`, `TextEditor`).
  - Global access is provided via `game["beavers-crafting"]`.
  - Inter-module communication heavily relies on `beavers-system-interface`.
- **Handlebars**:
  - Custom helpers like `beavers-isEmpty` and `beavers-objectLen` are registered in `src/main.js`.
  - Partials are loaded and registered at the end of the `beavers-system-interface.ready` hook.
- **Migration**: Increment the `MAJOR_VERSION` in `Settings.ts` when introducing breaking changes that require data migration; update `migrate()` in `src/main.js` accordingly.
