import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { brandsDir } from "@guidelines/core/store";
import { closeBrowser } from "./render";
import { createServer } from "./server";

const server = createServer();
await server.connect(new StdioServerTransport());
// stdout is the protocol channel — log to stderr only.
console.error(`[guidelines] MCP server ready · brands dir: ${brandsDir()}`);

const shutdown = async () => {
  await closeBrowser();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
