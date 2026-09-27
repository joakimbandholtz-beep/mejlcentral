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

const APP_VERSION = "0.6.0";
const WIDGET_URI = "ui://mejlcentral/v6.html";

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

const statusSchema = z.enum([
  "reply",
  "done",
  "wait",
  "watch",
  "remind",
  "skip"
]);

const adStatusSchema = z.enum([
  "delete",
  "keep"
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
    .default([
      "delete",
      "keep"
    ])
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
          <title>Mejlcentralen v6</title>
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
   * Ny widget-URI för v6.
   *
   * En ny URI används för att undvika att
   * ChatGPT återanvänder en cachad v5-widget.
   */
  server.registerResource(
    "mejlcentral-ui-v6",
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
              "Mejlcentralen v6. Klickbart gränssnitt för mejluppgifter samt reklam och utskick. Vanliga mejl hanteras med Svara, Klar, Vänta, Bevaka, Påminn eller Ingen åtgärd. Reklam hanteras separat med Radera eller Behåll.",

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
   * tasks = vanliga relevanta mejl
   * ads = identifierad reklam / utskick
   *
   * Verktyget utför inga kontoåtgärder.
   * Alla val skickas tillbaka till ChatGPT
   * först när användaren klickar Utför åtgärder.
   */
  server.registerTool(
    "show_mail_center",

    {
      title: "Visa Mejlcentralen",

      description:
        "Visar relevanta mejluppgifter och identifierad reklam i ett klickbart gränssnitt. Vanliga mejl kan hanteras med Svara, Klar, Vänta, Bevaka, Påminn eller Ingen åtgärd. Reklam och utskick visas i en separat sektion där användaren väljer Radera eller Behåll för varje mejl. Verktyget är endast presentation och initierar inga externa kontoåtgärder själv. När användaren klickar Utför åtgärder skickas hela batchen tillbaka till ChatGPT för faktisk hantering med användarens auktoriserade mejlverktyg.",

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
        "openai/outputTemplate":
          WIDGET_URI,

        "openai/toolInvocation/invoking":
          "Öppnar Mejlcentralen…",

        "openai/toolInvocation/invoked":
          "Mejlcentralen är klar."
      }
    },

    async ({ tasks, ads }) => {
      /*
       * Säkerställ att Ingen åtgärd alltid
       * finns för vanliga mejl.
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

      /*
       * Säkerställ att reklam alltid får
       * alternativen Radera och Behåll.
       */
      const normalizedAds = ads.map(
        ad => {
          const statuses = Array.isArray(
            ad.statuses
          )
            ? [...ad.statuses]
            : [];

          if (
            !statuses.includes("delete")
          ) {
            statuses.push("delete");
          }

          if (
            !statuses.includes("keep")
          ) {
            statuses.push("keep");
          }

          return {
            ...ad,
            statuses
          };
        }
      );

      return {
        structuredContent: {
          version: 6,
          tasks: normalizedTasks,
          ads: normalizedAds
        },

        content: [
          {
            type: "text",
            text:
              `Mejlcentralen v6 visar ${normalizedTasks.length} relevanta mejl och ${normalizedAds.length} reklam-/utskicksmejl.`
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
 */
app.get(
  "/health",
  (req, res) => {
    res.json({
      ok: true,
      service: "mejlcentral",
      version: APP_VERSION,
      widget: WIDGET_URI,
      statuses: STATUS,
      adStatuses: AD_STATUS
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
            <h1>Mejlcentralen v6</h1>

            <p>
              Mejlcentralen hjälper dig att
              hantera relevanta mejl med:
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
              Reklam och utskick hanteras
              separat med:
            </p>

            <ul>
              <li>Radera</li>
              <li>Behåll</li>
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
