#!/usr/bin/env node
// Launcher for MCP clients: plain `node`, no package-manager banners on stdout
// (stdout is the MCP protocol channel). Loads the TypeScript sources via tsx.
import { fileURLToPath } from "node:url";
import { register } from "tsx/esm/api";

// MCP clients start servers from arbitrary working directories; anchor brand
// storage to this repo unless GUIDELINES_DIR says otherwise.
process.env.GUIDELINES_DIR ??= fileURLToPath(new URL("../../../brands", import.meta.url));

register();
await import("../src/index.ts");
