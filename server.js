const express = require("express");
const { randomUUID } = require("crypto");
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StreamableHTTPServerTransport } = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const { z } = require("zod");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

const APP_VERSION = "0.7.0";
const WIDGET_URI = "ui://mejlcentral/v7.html";

const STATUS = [
  "reply",
  "done",
  "wait",
  "watch",
  "remind",
  "skip"
];

const AD_STATUS = [
  "delete",
  "keep"
];

const statusSchema = z.enum(STATUS);
const adStatusSchema = z.enum(AD_STATUS);

const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  account: z.string().optional().default(""),
  received: z.string().optional().default(""),
  summary: z.string().optional().default(""),

  statuses: z
    .array(statusSchema)
    .optional()
    .default(STATUS),

  replyDraft: z.string().optional(),

  done: z
    .boolean()
    .optional()
    .default(false)
});

const adSchema = z.object({
  id: z.string(),
  title: z.string(),

  sender: z
    .string()
    .optional()
    .default(""),

  account: z
    .string()
    .optional()
    .default(""),

  received: z
    .string()
    .optional()
    .default(""),

  summary: z
    .string()
    .optional()
    .default(""),

  statuses: z
    .array(adStatusSchema)
    .optional()
    .default(AD_STATUS)
});

function createServer() {
  const server = new McpServer({
    name: "mejlcentral",
    version: APP_VERSION
  });

  server.registerResource(
    "mejlcentral-ui-v7",
    WIDGET_URI,
    {},
    async () => ({
      contents: [
        {
          uri: WIDGET_URI,
          mimeType: "text/html+skybridge",
          text: await fetchWidgetHtml()
        }
      ]
    })
  );

  server.registerTool(
    "show_mail_center",
    {
      title: "Visa Mejlcentralen",

      description:
        "Visar relevanta mejluppgifter och identifierad reklam i ett klickbart gränssnitt. " +
        "Vanliga mejl kan hanteras med Svara, Klar, Vänta, Bevaka, Påminn eller Ingen åtgärd. " +
        "Påminn kräver datum och tid. Reklam och utskick visas separat med Radera eller Behåll. " +
        "Verktyget är endast presentation och initierar inga externa kontoåtgärder själv.",

      inputSchema: {
        tasks: z
          .array(taskSchema)
          .optional()
          .default([]),

        ads: z
          .array(adSchema)
          .optional()
          .default([])
      },

      _meta: {
        "openai/outputTemplate": WIDGET_URI,
        "openai/toolInvocation/invoking":
          "Öppnar Mejlcentralen…",
        "openai/toolInvocation/invoked":
          "Mejlcentralen är klar."
      }
    },

    async ({ tasks = [], ads = [] }) => {
      const normalizedTasks = tasks.map(task => ({
        id: task.id,
        title: task.title,
        account: task.account || "",
        received: task.received || "",
        summary: task.summary || "",

        statuses:
          Array.isArray(task.statuses) &&
          task.statuses.length
            ? task.statuses
            : STATUS,

        replyDraft:
          typeof task.replyDraft === "string"
            ? task.replyDraft
            : "",

        done: Boolean(task.done)
      }));

      const normalizedAds = ads.map(ad => ({
        id: ad.id,
        title: ad.title,
        sender: ad.sender || "",
        account: ad.account || "",
        received: ad.received || "",
        summary: ad.summary || "",

        statuses:
          Array.isArray(ad.statuses) &&
          ad.statuses.length
            ? ad.statuses
            : AD_STATUS
      }));

      return {
        structuredContent: {
          version: 7,
          appVersion: APP_VERSION,
          tasks: normalizedTasks,
          ads: normalizedAds
        },

        content: [
          {
            type: "text",
            text:
              `Mejlcentralen v7: ` +
              `${normalizedTasks.length} relevanta mejl och ` +
              `${normalizedAds.length} reklam/utskick.`
          }
        ],

        _meta: {
          "openai/outputTemplate": WIDGET_URI
        }
      };
    }
  );

  return server;
}

async function fetchWidgetHtml() {
  const fs = require("fs/promises");
  const path = require("path");

  const filePath = path.join(
    process.cwd(),
    "public",
    "mail-center.html"
  );

  return fs.readFile(filePath, "utf8");
}

app.get("/", (req, res) => {
  res.type("text/plain").send(
    [
      "Mejlcentralen v7",
      "",
      "MCP endpoint: /mcp",
      `Widget: ${WIDGET_URI}`,
      `Version: ${APP_VERSION}`,
      "",
      "Vanliga val:",
      "Svara",
      "Klar",
      "Vänta",
      "Bevaka",
      "Påminn",
      "Ingen åtgärd",
      "",
      "Reklam:",
      "Radera",
      "Behåll"
    ].join("\n")
  );
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "mejlcentral",
    version: APP_VERSION,
    widget: WIDGET_URI,
    statuses: STATUS,
    adStatuses: AD_STATUS
  });
});

app.post("/mcp", async (req, res) => {
  const server = createServer();

  const transport =
    new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID()
    });

  res.on("close", () => {
    transport.close();
    server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(
      req,
      res,
      req.body
    );
  } catch (error) {
    console.error("MCP error:", error);

    if (!res.headersSent) {
      res.status(500).json({
        error: "MCP request failed"
      });
    }
  }
});

app.get("/mcp", (req, res) => {
  res.status(405).send(
    "Use POST /mcp"
  );
});

app.delete("/mcp", (req, res) => {
  res.status(405).send(
    "Stateless MCP server"
  );
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(
    `Mejlcentralen v7 running on port ${port}`
  );
});
