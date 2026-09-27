import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE
} from '@modelcontextprotocol/ext-apps/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

const widgetHtml = readFileSync(
  new URL('./public/mail-center.html', import.meta.url),
  'utf8'
);

const APP_VERSION = '0.4.0';
const WIDGET_URI = 'ui://mejlcentral/v4.html';

const STATUS = [
  'reply',
  'done',
  'wait',
  'watch',
  'remind',
  'skip'
];

const taskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  account: z.string().optional(),
  received: z.string().optional(),
  summary: z.string().optional(),
  statuses: z.array(z.enum(STATUS)).optional(),
  replyDraft: z.string().optional(),
  done: z.boolean().optional()
});

const outputSchema = {
  tasks: z.array(taskSchema)
};

const htmlPage = (title, body) =>
  `<!doctype html>
<html lang="sv">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
body{
  font-family:system-ui,-apple-system,sans-serif;
  max-width:760px;
  margin:40px auto;
  padding:0 20px;
  line-height:1.55;
  color:#171717
}
h1{font-size:28px}
a{color:inherit}
small{color:#666}
</style>
</head>
<body>${body}</body>
</html>`;

const privacy = htmlPage(
  'Integritet – Mejlcentralen',
  `
<h1>Integritetspolicy för Mejlcentralen</h1>
<p>
Mejlcentralen är ett presentations- och arbetsflödesgränssnitt för ChatGPT.
Pluginservern loggar inte in i din e-post, läser inte din e-post direkt och
lagrar inte innehållet i de mejluppgifter som visas i komponenten.
</p>
<p>
Valen görs lokalt i komponenten. Först när användaren klickar på Utför
skickas den samlade batchen tillbaka till ChatGPT. Eventuella externa
åtgärder utförs därefter via anslutningar som användaren redan har
auktoriserat i ChatGPT.
</p>
<p>
Applikationen är utformad för att inte logga rå e-posttext, svarstext,
åtkomsttoken eller autentiseringshemligheter.
</p>
<p>
Kontakt:
<a href="mailto:joakim@jbconsulere.com">joakim@jbconsulere.com</a>.
</p>
<p><small>Senast uppdaterad 27 september 2026.</small></p>
`
);

const terms = htmlPage(
  'Villkor – Mejlcentralen',
  `
<h1>Villkor för Mejlcentralen</h1>
<p>
Mejlcentralen strukturerar användarens beslut om mejluppgifter.
Enskilda knappval utför inga externa kontoåtgärder.
Den samlade batchen skickas till ChatGPT först när användaren klickar
på Utför.
</p>
<p>
Ett svar som användaren har granskat och valt Godkänn svar för
betraktas som godkänt för att skickas när användaren därefter
klickar på Utför.
</p>
<p>
Användaren ansvarar för att granska mottagare, innehåll och konsekvenser
innan externa åtgärder godkänns.
</p>
<p>
Kontakt:
<a href="mailto:joakim@jbconsulere.com">joakim@jbconsulere.com</a>.
</p>
`
);

const support = htmlPage(
  'Support – Mejlcentralen',
  `
<h1>Support för Mejlcentralen</h1>
<p>
För support:
<a href="mailto:joakim@jbconsulere.com">joakim@jbconsulere.com</a>.
</p>
`
);

const landing = htmlPage(
  'Mejlcentralen',
  `
<h1>Mejlcentralen</h1>
<p>
Version ${APP_VERSION}. Ett batchbaserat arbetsflöde för mejluppgifter
i ChatGPT: Svara, Klar, Vänta, Bevaka, Påminn och Ingen åtgärd.
</p>
<p>
<a href="/privacy">Integritet</a> ·
<a href="/terms">Villkor</a> ·
<a href="/support">Support</a>
</p>
`
);

function makeServer(origin) {
  const server = new McpServer({
    name: 'mejlcentral',
    version: APP_VERSION
  });

  registerAppResource(
    server,
    'mejlcentral-ui-v4',
    WIDGET_URI,
    {},
    async () => ({
      contents: [
        {
          uri: WIDGET_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: widgetHtml,
          _meta: {
            ui: {
              prefersBorder: true,
              domain: origin,
              csp: {
                connectDomains: [],
                resourceDomains: []
              }
            },
            'openai/ui': {
              availableDisplayModes: [
                'inline',
                'fullscreen'
              ]
            },
            'openai/widgetDescription':
              'Mejlcentralen v4. Alla beslut samlas lokalt och skickas till ChatGPT först när användaren klickar Utför. Godkända svar får skickas när batchen utförs.'
          }
        }
      ]
    })
  );

  registerAppTool(
    server,
    'show_mail_center',
    {
      title: 'Visa Mejlcentralen',
      description:
        'Visar mejluppgifter i ett batchbaserat gränssnitt. Enskilda knapptryck skickar inget till ChatGPT. När alla uppgifter har ett beslut kan användaren klicka Utför och skicka hela batchen. Ett svar med approved=true har uttryckligen godkänts av användaren för att skickas.',
      inputSchema: {
        tasks: z.array(taskSchema).max(100)
      },
      outputSchema,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false
      },
      _meta: {
        ui: {
          resourceUri: WIDGET_URI
        },
        'openai/outputTemplate': WIDGET_URI
      }
    },
    async ({ tasks }) => ({
      content: [
        {
          type: 'text',
          text:
            `Visar ${tasks.length} mejluppgifter i Mejlcentralen v4.`
        }
      ],
      structuredContent: {
        tasks
      }
    })
  );

  return server;
}

const port = Number(process.env.PORT ?? 8787);
const MCP_PATH = '/mcp';

const httpServer = createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400).end('Missing URL');
    return;
  }

  const proto =
    req.headers['x-forwarded-proto'] || 'http';

  const host =
    req.headers['x-forwarded-host'] ||
    req.headers.host ||
    'localhost';

  const origin = `${proto}://${host}`;
  const url = new URL(req.url, origin);

  if (
    req.method === 'GET' &&
    url.pathname === '/'
  ) {
    res.writeHead(200, {
      'content-type':
        'text/html; charset=utf-8'
    }).end(landing);
    return;
  }

  if (
    req.method === 'GET' &&
    url.pathname === '/privacy'
  ) {
    res.writeHead(200, {
      'content-type':
        'text/html; charset=utf-8'
    }).end(privacy);
    return;
  }

  if (
    req.method === 'GET' &&
    url.pathname === '/terms'
  ) {
    res.writeHead(200, {
      'content-type':
        'text/html; charset=utf-8'
    }).end(terms);
    return;
  }

  if (
    req.method === 'GET' &&
    url.pathname === '/support'
  ) {
    res.writeHead(200, {
      'content-type':
        'text/html; charset=utf-8'
    }).end(support);
    return;
  }

  if (
    req.method === 'GET' &&
    url.pathname === '/health'
  ) {
    res.writeHead(200, {
      'content-type':'application/json'
    }).end(
      JSON.stringify({
        ok:true,
        service:'mejlcentral',
        version:APP_VERSION,
        widget:WIDGET_URI
      })
    );
    return;
  }

  if (
    req.method === 'GET' &&
    url.pathname ===
      '/.well-known/openai-apps-challenge'
  ) {
    const token =
      process.env.OPENAI_APPS_CHALLENGE || '';

    if (!token) {
      res.writeHead(404, {
        'content-type':
          'text/plain; charset=utf-8'
      }).end('');
      return;
    }

    res.writeHead(200, {
      'content-type':
        'text/plain; charset=utf-8',
      'cache-control':'no-store'
    }).end(token);

    return;
  }

  if (
    req.method === 'OPTIONS' &&
    url.pathname === MCP_PATH
  ) {
    res.writeHead(204, {
      'Access-Control-Allow-Origin':'*',
      'Access-Control-Allow-Methods':
        'POST, GET, DELETE, OPTIONS',
      'Access-Control-Allow-Headers':
        'content-type, mcp-session-id',
      'Access-Control-Expose-Headers':
        'Mcp-Session-Id'
    });

    res.end();
    return;
  }

  if (
    url.pathname === MCP_PATH &&
    ['POST','GET','DELETE']
      .includes(req.method || '')
  ) {
    res.setHeader(
      'Access-Control-Allow-Origin',
      '*'
    );

    res.setHeader(
      'Access-Control-Expose-Headers',
      'Mcp-Session-Id'
    );

    const server = makeServer(origin);

    const transport =
      new StreamableHTTPServerTransport({
        sessionIdGenerator:undefined,
        enableJsonResponse:true
      });

    res.on('close',()=>{
      transport.close();
      server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req,res);
    } catch(err) {
      console.error(
        'MCP request failed',
        err?.message || err
      );

      if(!res.headersSent) {
        res
          .writeHead(500)
          .end('Internal server error');
      }
    }

    return;
  }

  res.writeHead(404, {
    'content-type':
      'text/plain; charset=utf-8'
  }).end('Not Found');
});

httpServer.listen(port,()=>{
  console.log(
    `Mejlcentralen ${APP_VERSION}: http://localhost:${port}${MCP_PATH}`
  );
});
