import express from "express";
import { readFile } from "node:fs/promises";

import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

const APP_VERSION = "0.7.3";
const WIDGET_URI = "ui://mejlcentral/v7.html";

const STATUS = [
  "reply",
  "done",
  "wait",
  "watch",
  "remind",
  "skip",
];

const AD_STATUS = [
  "delete",
  "keep",
];

const statusSchema = z.enum(STATUS);
const adStatusSchema = z.enum(AD_STATUS);

const taskSchema = z.object({
  id: z.string(),
  title: z.string(),

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
    .array(statusSchema)
    .optional()
    .default(STATUS),

  replyDraft: z
    .string()
    .optional(),

  done: z
    .boolean()
    .optional()
    .default(false),
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
    .default(AD_STATUS),
});

const outputSchema = {
  version: z.number(),
  appVersion: z.string(),
  tasks: z.array(taskSchema),
  ads: z.array(adSchema),
};

async function getWidgetHtml() {
  return readFile(
    new URL(
      "./public/mail-center.html",
      import.meta.url
    ),
    "utf8"
  );
}

function createMcpServer() {
  const server = new McpServer({
    name: "mejlcentral",
    version: APP_VERSION,
  });

  registerAppResource(
    server,
    "mejlcentral-ui-v7",
    WIDGET_URI,
    {},
    async () => {
      const html =
        await getWidgetHtml();

      return {
        contents: [
          {
            uri: WIDGET_URI,

            mimeType:
              RESOURCE_MIME_TYPE,

            text: html,

            _meta: {
              ui: {
                prefersBorder: true,
              },

              "openai/ui": {
                availableDisplayModes: [
                  "inline",
                ],
              },
            },
          },
        ],
      };
    }
  );

  registerAppTool(
    server,
    "show_mail_center",
    {
      title:
        "Visa Mejlcentralen",

      description:
        "Visar relevanta mejl och reklam i Mejlcentralens klickbara gränssnitt. " +
        "Vanliga mejl kan hanteras med Svara, Klar, Vänta, Bevaka, Påminn eller Ingen åtgärd. " +
        "Påminn kräver datum och tid. Reklam och utskick kan markeras som Radera eller Behåll. " +
        "Verktyget presenterar valen men utför inte externa mejlåtgärder själv.",

      inputSchema: {
        tasks: z
          .array(taskSchema)
          .optional()
          .default([]),

        ads: z
          .array(adSchema)
          .optional()
          .default([]),
      },

      outputSchema,

      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true,
      },

      _meta: {
        ui: {
          resourceUri:
            WIDGET_URI,
        },

        "openai/outputTemplate":
          WIDGET_URI,

        "openai/toolInvocation/invoking":
          "Öppnar Mejlcentralen…",

        "openai/toolInvocation/invoked":
          "Mejlcentralen är klar.",
      },
    },

    async ({
      tasks = [],
      ads = [],
    }) => {
      const normalizedTasks =
        tasks.map((task) => ({
          id: task.id,

          title: task.title,

          account:
            task.account || "",

          received:
            task.received || "",

          summary:
            task.summary || "",

          statuses:
            Array.isArray(
              task.statuses
            ) &&
            task.statuses.length
              ? task.statuses
              : STATUS,

          replyDraft:
            typeof task.replyDraft ===
            "string"
              ? task.replyDraft
              : "",

          done:
            Boolean(task.done),
        }));

      const normalizedAds =
        ads.map((ad) => ({
          id: ad.id,

          title: ad.title,

          sender:
            ad.sender || "",

          account:
            ad.account || "",

          received:
            ad.received || "",

          summary:
            ad.summary || "",

          statuses:
            Array.isArray(
              ad.statuses
            ) &&
            ad.statuses.length
              ? ad.statuses
              : AD_STATUS,
        }));

      return {
        structuredContent: {
          version: 7,
          appVersion:
            APP_VERSION,
          tasks:
            normalizedTasks,
          ads:
            normalizedAds,
        },

        content: [
          {
            type: "text",

            text:
              `Mejlcentralen v7: ` +
              `${normalizedTasks.length} relevanta mejl och ` +
              `${normalizedAds.length} reklam/utskick.`,
          },
        ],
      };
    }
  );

  return server;
}

/*
 * CORS för MCP.
 * Matchar OpenAI:s rekommenderade
 * Streamable HTTP-upplägg.
 */
app.options(
  "/mcp",
  (req, res) => {
    res.set({
      "Access-Control-Allow-Origin":
        "*",

      "Access-Control-Allow-Methods":
        "POST, GET, DELETE, OPTIONS",

      "Access-Control-Allow-Headers":
        "content-type, mcp-session-id",

      "Access-Control-Expose-Headers":
        "Mcp-Session-Id",
    });

    res.sendStatus(204);
  }
);

app.get("/", (req, res) => {
  res
    .type("text/plain")
    .send(
      [
        "Mejlcentralen v7",
        "",
        "MCP endpoint: /mcp",
        `Widget: ${WIDGET_URI}`,
        `Version: ${APP_VERSION}`,
        "",
        "MCP Apps UI: enabled",
        `MIME: ${RESOURCE_MIME_TYPE}`,
        "",
        "Transport: Streamable HTTP",
        "Mode: stateless",
        "JSON responses: enabled",
      ].join("\n")
    );
});

app.get(
  "/health",
  (req, res) => {
    res.json({
      ok: true,

      service:
        "mejlcentral",

      version:
        APP_VERSION,

      widget:
        WIDGET_URI,

      mimeType:
        RESOURCE_MIME_TYPE,

      mcpApps: true,

      transport:
        "streamable-http",

      stateless: true,

      jsonResponse: true,

      statuses:
        STATUS,

      adStatuses:
        AD_STATUS,
    });
  }
);

/*
 * MCP Streamable HTTP
 *
 * Stateless transport används för varje
 * request. Det följer OpenAI:s aktuella
 * MCP Apps-exempel och fungerar bättre
 * i serverless-miljöer som Vercel.
 */
async function handleMcpRequest(
  req,
  res
) {
  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Access-Control-Expose-Headers",
    "Mcp-Session-Id"
  );

  const server =
    createMcpServer();

  const transport =
    new StreamableHTTPServerTransport({
      sessionIdGenerator:
        undefined,

      enableJsonResponse:
        true,
    });

  res.on(
    "close",
    () => {
      try {
        transport.close();
      } catch {}

      try {
        server.close();
      } catch {}
    }
  );

  try {
    await server.connect(
      transport
    );

    await transport.handleRequest(
      req,
      res,
      req.method === "POST"
        ? req.body
        : undefined
    );
  } catch (error) {
    console.error(
      "MCP error:",
      error
    );

    if (
      !res.headersSent
    ) {
      res
        .status(500)
        .json({
          jsonrpc: "2.0",

          error: {
            code: -32603,
            message:
              "MCP request failed",
          },

          id: null,
        });
    }
  }
}

app.post(
  "/mcp",
  handleMcpRequest
);

app.get(
  "/mcp",
  handleMcpRequest
);

app.delete(
  "/mcp",
  handleMcpRequest
);

const port =
  process.env.PORT ||
  3000;

app.listen(
  port,
  () => {
    console.log(
      `Mejlcentralen ${APP_VERSION} listening on port ${port}/mcp`
    );
  }
);
