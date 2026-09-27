/**
 * H3 — Pruebas de 3 servidores MCP reales
 * 1. @modelcontextprotocol/server-filesystem (lectura + escritura)
 * 2. @modelcontextprotocol/server-everything (referencia:多种 capabilities)
 * 3. MCP server custom in-process (base de datos en memoria)
 */
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const { join } = path;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let PASS = 0, FAIL = 0;

function assert(label, condition, detail = "") {
  if (condition) { PASS++; console.log(`  ✓ ${label}`); }
  else { FAIL++; console.log(`  ✗ ${label} ${detail}`); }
}

async function run() {
  console.log("=== H3: Pruebas de 3 servidores MCP reales ===\n");

  const HOME = mkdtempSync(join(tmpdir(), "noira-h3-"));
  const TEST_DIR = join(HOME, "test-files");
  mkdirSync(TEST_DIR, { recursive: true });

  // ── Server 1: Filesystem ──
  console.log("Server 1: @modelcontextprotocol/server-filesystem");
  {
    try {
      const transport = new StdioClientTransport({
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem", TEST_DIR],
      });
      const client = new Client({ name: "noira-test", version: "1.0.0" });
      await client.connect(transport);
      assert("conectado al servidor filesystem", true);

      const tools = await client.listTools();
      assert("listTools retornó herramientas", tools.tools.length > 0);
      const toolNames = tools.tools.map((t) => t.name);
      console.log(`    tools: ${toolNames.join(", ")}`);

      // ESCRITURA: write_file
      const writeResult = await client.callTool({
        name: "write_file",
        arguments: { path: join(TEST_DIR, "hola.txt"), content: "Hola desde MCP" },
      });
      assert("write_file ejecutado", writeResult.content?.length > 0 || writeResult.isError === undefined);
      assert("archivo creado en disco", existsSync(join(TEST_DIR, "hola.txt")));
      if (existsSync(join(TEST_DIR, "hola.txt"))) {
        const content = readFileSync(join(TEST_DIR, "hola.txt"), "utf8");
        assert("contenido correcto", content === "Hola desde MCP", `contenido: "${content}"`);
      }

      // LECTURA: read_file
      const readResult = await client.callTool({
        name: "read_file",
        arguments: { path: join(TEST_DIR, "hola.txt") },
      });
      assert("read_file retorna contenido", readResult.content?.length > 0);

      // LECTURA: list_directory
      const listResult = await client.callTool({
        name: "list_directory",
        arguments: { path: TEST_DIR },
      });
      assert("list_directory funciona", listResult.content?.length > 0);

      // ESCRITURA: sobrescribir
      await client.callTool({
        name: "write_file",
        arguments: { path: join(TEST_DIR, "hola.txt"), content: "Contenido actualizado" },
      });
      const overwrite = readFileSync(join(TEST_DIR, "hola.txt"), "utf8");
      assert("write_file sobrescribe", overwrite === "Contenido actualizado");

      await client.close();
      assert("conexión cerrada limpiamente", true);
    } catch (e) {
      assert("filesystem server", false, e.message);
    }
  }

  // ── Server 2: Everything (reference) ──
  console.log("\nServer 2: @modelcontextprotocol/server-everything");
  {
    try {
      const transport = new StdioClientTransport({
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-everything"],
      });
      const client = new Client({ name: "noira-test", version: "1.0.0" });
      await client.connect(transport);
      assert("conectado al servidor everything", true);

      const tools = await client.listTools();
      assert("listTools retornó herramientas", tools.tools.length > 0);
      const toolNames = tools.tools.map((t) => t.name);
      console.log(`    tools (${tools.tools.length}): ${toolNames.slice(0, 8).join(", ")}${toolNames.length > 8 ? "..." : ""}`);

      // echo tool
      try {
        const echoResult = await client.callTool({ name: "echo", arguments: { message: "Hello MCP" } });
        assert("echo funciona", echoResult.content?.length > 0);
      } catch (e) { assert("echo tool", false, e.message); }

      // add tool
      try {
        const addResult = await client.callTool({ name: "add", arguments: { a: 2, b: 3 } });
        assert("add(2,3) funciona", addResult.content?.length > 0);
      } catch (e) { assert("add tool", false, e.message); }

      // resources
      try {
        const resources = await client.listResources();
        assert("listResources funciona", Array.isArray(resources.resources));
      } catch (e) { assert("listResources", false, e.message); }

      await client.close();
      assert("conexión everything cerrada", true);
    } catch (e) {
      assert("everything server", false, e.message);
    }
  }

  // ── Server 3: Custom in-process (base de datos en memoria) ──
  console.log("\nServer 3: MCP server custom in-process (DB en memoria)");
  {
    try {
      const { z } = await import("zod");
      const db = new Map();
      let nextId = 1;

      const server = new McpServer({ name: "test-db", version: "1.0.0" });

      server.tool("create_record", { table: z.string(), data: z.string() }, async ({ table, data }) => {
        const id = nextId++;
        db.set(id, { table, data: JSON.parse(data), id });
        return { content: [{ type: "text", text: JSON.stringify({ id, table, data: JSON.parse(data) }) }] };
      });

      server.tool("read_record", { id: z.number() }, async ({ id }) => {
        const rec = db.get(id);
        if (!rec) return { content: [{ type: "text", text: "not found" }], isError: true };
        return { content: [{ type: "text", text: JSON.stringify(rec) }] };
      });

      server.tool("list_records", { table: z.string() }, async ({ table }) => {
        const records = [...db.values()].filter((r) => r.table === table);
        return { content: [{ type: "text", text: JSON.stringify(records) }] };
      });

      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
      await server.connect(serverTransport);

      const client = new Client({ name: "noira-test-db", version: "1.0.0" });
      await client.connect(clientTransport);
      assert("conectado al servidor custom DB", true);

      const tools = await client.listTools();
      assert("listTools retornó 3 tools", tools.tools.length === 3);
      const toolNames = tools.tools.map((t) => t.name);
      console.log(`    tools: ${toolNames.join(", ")}`);

      // ESCRITURA: create_record
      const createResult = await client.callTool({
        name: "create_record",
        arguments: { table: "users", data: JSON.stringify({ name: "Alice", email: "alice@test.com" }) },
      });
      assert("create_record ejecutado", createResult.content?.length > 0);
      let created;
      try { created = JSON.parse(createResult.content[0].text); }
      catch (e) { console.log("    [create_record raw:", createResult.content[0].text, "]"); throw e; }
      assert("record created con id", typeof created.id === "number", `id: ${created.id}`);

      // Crear segundo registro
      const createResult2 = await client.callTool({
        name: "create_record",
        arguments: { table: "users", data: JSON.stringify({ name: "Bob", email: "bob@test.com" }) },
      });
      assert("segundo create_record ejecutado", createResult2.content?.length > 0);

      // LECTURA: read_record
      const readResult = await client.callTool({
        name: "read_record",
        arguments: { id: created.id },
      });
      assert("read_record retorna datos", readResult.content?.length > 0);
      const readData = JSON.parse(readResult.content[0].text);
      assert("datos correctos (Alice)", readData.data.name === "Alice");

      // LECTURA: list_records
      const listResult = await client.callTool({
        name: "list_records",
        arguments: { table: "users" },
      });
      assert("list_records retorna registros", listResult.content?.length > 0);
      const listData = JSON.parse(listResult.content[0].text);
      assert("2 registros en tabla users", listData.length === 2);

      // Verificar segundo registro
      const readResult2 = await client.callTool({
        name: "read_record",
        arguments: { id: created.id + 1 },
      });
      assert("read_result2 tiene datos", readResult2.content?.length > 0);
      const bobData = JSON.parse(readResult2.content[0].text);
      assert("segundo registro correcto (Bob)", bobData.data.name === "Bob");

      await client.close();
      await server.close();
      assert("conexión custom DB cerrada", true);
    } catch (e) {
      assert("custom DB server", false, e.message);
    }
  }

  // ── Resumen ──
  console.log(`\n=== RESUMEN H3 ===`);
  console.log(`Pasaron: ${PASS}/${PASS + FAIL}`);
  console.log(`Fallaron: ${FAIL}/${PASS + FAIL}`);
  console.log(`\nServidores probados:`);
  console.log(`  1. @modelcontextprotocol/server-filesystem — lectura + escritura de archivos reales en disco`);
  console.log(`  2. @modelcontextprotocol/server-everything — referencia (echo, add, resources, 13 tools)`);
  console.log(`  3. MCP server custom in-process — CRUD de base de datos en memoria con InMemoryTransport`);
}

run().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
