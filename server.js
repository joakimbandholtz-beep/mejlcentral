import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json({ limit: "1mb" }));

const APP_VERSION = "0.5.0";
const WIDGET_URI = "ui://mejlcentral/v5.html";

const STATUS = [
  "reply",
  "done",
  "wait",
  "watch",
  "remind",
  "skip"
];

const statusSchema = z.enum([
  "reply",
  "done",
  "wait",
  "watch",
  "remind",
  "skip"
]);

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
    .default([
      "reply",
      "done",
      "wait",
      "watch",
      "remind",
      "skip"
    ]),

  replyDraft: z
    .string()
    .optional(),

  done: z
    .boolean()
    .optional()
    .default(false)
});

function loadWidgetHtml() {
  const widgetPath = path.join(
    __dirname,
    "public",
    "mail-center.html"
  );

  try {
    return fs.readFileSync(
      widgetPath,
      "utf8"
    );
  } catch (error) {
    console.error(
      "Could not load widget HTML:",
      error
    );

    return `
      <!doctype html>
      <html lang="sv">
        <head>
          <meta charset="utf-8">
          <title>Mejlcentralen v5</title>
        </head>

        <body>
          <h1>Mejlcentralen</h1>
          <p>
            Widgeten kunde inte laddas.
          </p>
        </body>
      </html>
    `;
  }
}

function createMcpServer() {
  const server = new McpServer({
    name: "mejlcentral",
    version: APP_VERSION
  });

  /*
   * Ny widget-URI för v5.
   *
   * Det här är avsiktligt en NY URI jämfört
   * med v4 så att ChatGPT inte ska återanvända
   * den gamla widgetresursen.
   */
  server.registerResource(
    "mejlcentral-ui-v5",
    WIDGET_URI,
    {},
    async () => ({
      contents: [
        {
          uri: WIDGET_URI,
          mimeType: "text/html+skybridge",
          text: loadWidgetHtml(),

          _meta: {
            "openai/widgetDescription":
              "Mejlcentralen v5. Ett klickbart gränssnitt för att hantera mejluppgifter med Svara, Klar, Vänta, Bevaka, Påminn eller Ingen åtgärd.",

            "openai/widgetPrefersBorder":
              true
          }
        }
      ]
    })
  );

  /*
   * Verktyget som ChatGPT använder för att
   * visa Mejlcentralen.
   *
   * VIKTIGT:
   * skip finns nu i själva input-schemat.
   */
  server.registerTool(
    "show_mail_center",

    {
      title: "Visa Mejlcentralen",

      description:
        "Visar en lista med mejluppgifter i ett klickbart gränssnitt. Användaren kan välja Svara, Klar, Vänta, Bevaka, Påminn eller Ingen åtgärd. Verktyget är presentation och initierar inga externa kontoåtgärder själv. När användaren klickar Utför skickas hela batchen tillbaka till ChatGPT för fortsatt hantering med användarens auktoriserade verktyg.",

      inputSchema: {
        tasks: z.array(taskSchema)
      },

      _meta: {
        "openai/outputTemplate":
          WIDGET_URI,

        "openai/toolInvocation/invoking":
          "Öppnar Mejlcentralen…",

        "openai/toolInvocation/invoked":
          "Mejlcentralen är klar."
      }
    },

    async ({ tasks }) => {
      /*
       * Säkerställ att skip alltid finns som
       * möjligt val även om ChatGPT skickar en
       * äldre statuslista.
       */
      const normalizedTasks = tasks.map(
        task => {
          const statuses = Array.isArray(
            task.statuses
          )
            ? [...task.statuses]
            : [];

          if (
            !statuses.includes("skip")
          ) {
            statuses.push("skip");
          }

          return {
            ...task,
            statuses
          };
        }
      );

      return {
        structuredContent: {
          version: 5,
          tasks: normalizedTasks
        },

        content: [
          {
            type: "text",
            text:
              `Mejlcentralen v5 visar ${normalizedTasks.length} mejluppgifter.`
          }
        ],

        _meta: {
          version: APP_VERSION,
          widget: WIDGET_URI
        }
      };
    }
  );

  return server;
}

/*
 * Hälsokontroll.
 *
 * Efter deployment ska denna visa:
 *
 * version: 0.5.0
 * widget: ui://mejlcentral/v5.html
 */
app.get(
  "/health",
  (req, res) => {
    res.json({
      ok: true,
      service: "mejlcentral",
      version: APP_VERSION,
      widget: WIDGET_URI,
      statuses: STATUS
    });
  }
);

/*
 * Enkel startsida.
 */
app.get(
  "/",
  (req, res) => {
    res
      .status(200)
      .type("html")
      .send(`
        <!doctype html>
        <html lang="sv">
          <head>
            <meta charset="utf-8">
            <meta
              name="viewport"
              content="width=device-width,initial-scale=1"
            >
            <title>Mejlcentralen</title>
          </head>

          <body
            style="
              font-family:
                system-ui,
                -apple-system,
                sans-serif;
              max-width:720px;
              margin:60px auto;
              padding:20px;
            "
          >
            <h1>Mejlcentralen v5</h1>

            <p>
              Mejlcentralen hjälper dig att
              hantera mejluppgifter med:
            </p>

            <ul>
              <li>Svara</li>
              <li>Klar</li>
              <li>Vänta</li>
              <li>Bevaka</li>
              <li>Påminn</li>
              <li>
                <strong>
                  Ingen åtgärd
                </strong>
              </li>
            </ul>

            <p>
              Status: aktiv
            </p>
          </body>
        </html>
      `);
  }
);

/*
 * Informationssidor för appen.
 */
app.get(
  "/privacy",
  (req, res) => {
    res
      .type("text/plain")
      .send(
        "Mejlcentralen lagrar inte e-postinnehåll på denna server. Verktyget presenterar uppgifter som skickas till det från ChatGPT."
      );
  }
);

app.get(
  "/terms",
  (req, res) => {
    res
      .type("text/plain")
      .send(
        "Mejlcentralen är ett personligt verktyg för hantering av mejluppgifter."
      );
  }
);

app.get(
  "/support",
  (req, res) => {
    res
      .type("text/plain")
      .send(
        "Mejlcentralen support."
      );
  }
);

/*
 * MCP-endpoint.
 */
app.all(
  "/mcp",
  async (req, res) => {
    const server =
      createMcpServer();

    const transport =
      new StreamableHTTPServerTransport({
        sessionIdGenerator:
          undefined
      });

    res.on(
      "close",
      () => {
        transport.close();
        server.close();
      }
    );

    try {
      await server.connect(
        transport
      );

      await transport.handleRequest(
        req,
        res,
        req.body
      );
    } catch (error) {
      console.error(
        "MCP request failed:",
        error
      );

      if (!res.headersSent) {
        res
          .status(500)
          .json({
            error:
              "MCP request failed"
          });
      }
    }
  }
);

const PORT =
  process.env.PORT || 3000;

app.listen(
  PORT,
  () => {
    console.log(
      `Mejlcentralen ${APP_VERSION} running on port ${PORT}`
    );

    console.log(
      `Widget: ${WIDGET_URI}`
    );
  }
);
