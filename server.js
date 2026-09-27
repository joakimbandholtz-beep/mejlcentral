import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

const widgetHtml = readFileSync(new URL('./public/mail-center.html', import.meta.url), 'utf8');

const STATUS = ['reply', 'done', 'wait', 'watch', 'remind'];
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
const outputSchema = { tasks: z.array(taskSchema) };

const htmlPage = (title, body) => `<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font-family:system-ui,-apple-system,sans-serif;max-width:760px;margin:40px auto;padding:0 20px;line-height:1.55;color:#171717}h1{font-size:28px}a{color:inherit}small{color:#666}</style></head><body>${body}</body></html>`;

const privacy = htmlPage('Integritet – Mejlcentralen', `
<h1>Integritetspolicy för Mejlcentralen</h1>
<p>Mejlcentralen är ett presentations- och arbetsflödesgränssnitt för ChatGPT. Pluginservern loggar inte in i din e-post, läser inte din e-post direkt och lagrar inte innehållet i de mejluppgifter som visas i komponenten.</p>
<p>Uppgifter som visas i komponenten kommer från den ChatGPT-konversation där användaren redan har valt att arbeta med dem. När användaren klickar på en åtgärd skickar komponenten en uppföljning tillbaka till ChatGPT. Eventuella åtgärder i externa tjänster utförs av de anslutningar användaren redan har auktoriserat i ChatGPT och omfattas av respektive tjänsts villkor.</p>
<p>Servern kan behandla teknisk standardinformation som krävs för HTTP-trafik och drift, till exempel tidsstämplar och felstatus. Applikationen är utformad för att inte logga rå e-posttext, svarstext, åtkomsttoken eller autentiseringshemligheter.</p>
<p>Mejlcentralen säljer inte personuppgifter och använder inte mejlinnehåll för annonsering.</p>
<p>Frågor om integritet eller begäran om radering av eventuella driftdata: <a href="mailto:joakim@jbconsulere.com">joakim@jbconsulere.com</a>.</p>
<p><small>Senast uppdaterad 27 september 2026.</small></p>`);

const terms = htmlPage('Villkor – Mejlcentralen', `
<h1>Villkor för Mejlcentralen</h1>
<p>Mejlcentralen tillhandahålls som ett gränssnitt för att strukturera och initiera arbetsflöden i ChatGPT. Tjänsten skickar inte själv e-post och har ingen egen åtkomst till Gmail, Outlook, Todoist eller andra externa konton.</p>
<p>Användaren ansvarar för att granska mottagare, innehåll och konsekvenser innan externa åtgärder godkänns. Funktionalitet kan påverkas av tillgängligheten hos ChatGPT och användarens anslutna tjänster.</p>
<p>Tjänsten tillhandahålls utan garanti om oavbruten tillgänglighet. Otillåten användning, försök att kringgå åtkomstkontroller eller missbruk av tjänsten är förbjudet.</p>
<p>Kontakt: <a href="mailto:joakim@jbconsulere.com">joakim@jbconsulere.com</a>.</p>
<p><small>Senast uppdaterad 27 september 2026.</small></p>`);

const support = htmlPage('Support – Mejlcentralen', `
<h1>Support för Mejlcentralen</h1>
<p>För support, felrapporter eller frågor: <a href="mailto:joakim@jbconsulere.com">joakim@jbconsulere.com</a>.</p>
<p>Beskriv gärna vilken knapp eller vy som användes och vad som hände. Skicka inte lösenord eller åtkomsttoken.</p>`);

const landing = htmlPage('Mejlcentralen', `
<h1>Mejlcentralen</h1>
<p>Ett klickbart arbetsflöde för att hantera mejluppgifter i ChatGPT med tydliga åtgärder: Svara, Klar, Vänta, Bevaka och Påminn.</p>
<p>Pluginet fungerar som presentations- och interaktionslager. Det får inte egen åtkomst till användarens e-postkonton.</p>
<p><a href="/privacy">Integritet</a> · <a href="/terms">Villkor</a> · <a href="/support">Support</a></p>`);

function makeServer(origin) {
  const server = new McpServer({ name: 'mejlcentral', version: '0.2.0' });

  registerAppResource(
    server,
    'mejlcentral-ui',
    'ui://mejlcentral/v2.html',
    {},
    async () => ({
      contents: [{
        uri: 'ui://mejlcentral/v2.html',
        mimeType: RESOURCE_MIME_TYPE,
        text: widgetHtml,
        _meta: {
          ui: {
            prefersBorder: true,
            domain: origin,
            csp: { connectDomains: [], resourceDomains: [] }
          },
          'openai/ui': { availableDisplayModes: ['inline', 'fullscreen'] },
          'openai/widgetDescription': 'Klickbar mejlcentral med åtgärderna Svara, Klar, Vänta, Bevaka och Påminn.'
        }
      }]
    })
  );

  registerAppTool(
    server,
    'show_mail_center',
    {
      title: 'Visa Mejlcentralen',
      description: 'Visar en lista med mejluppgifter i ett klickbart gränssnitt. Verktyget är endast presentation och initierar inga externa kontoåtgärder själv. Knapparna skickar användarens val tillbaka till ChatGPT för fortsatt hantering med de verktyg användaren redan har auktoriserat.',
      inputSchema: { tasks: z.array(taskSchema).max(100) },
      outputSchema,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false
      },
      _meta: {
        ui: { resourceUri: 'ui://mejlcentral/v2.html' },
        'openai/outputTemplate': 'ui://mejlcentral/v2.html'
      }
    },
    async ({ tasks }) => ({
      content: [{ type: 'text', text: `Visar ${tasks.length} mejluppgifter i Mejlcentralen.` }],
      structuredContent: { tasks }
    })
  );

  return server;
}

const port = Number(process.env.PORT ?? 8787);
const MCP_PATH = '/mcp';

const httpServer = createServer(async (req, res) => {
  if (!req.url) { res.writeHead(400).end('Missing URL'); return; }
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const origin = `${proto}://${host}`;
  const url = new URL(req.url, origin);

  if (req.method === 'GET' && url.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(landing); return; }
  if (req.method === 'GET' && url.pathname === '/privacy') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(privacy); return; }
  if (req.method === 'GET' && url.pathname === '/terms') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(terms); return; }
  if (req.method === 'GET' && url.pathname === '/support') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(support); return; }
  if (req.method === 'GET' && url.pathname === '/health') { res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: true, service: 'mejlcentral', version: '0.2.0' })); return; }
  if (req.method === 'GET' && url.pathname === '/.well-known/openai-apps-challenge') {
    const token = process.env.OPENAI_APPS_CHALLENGE || '';
    if (!token) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end(''); return; }
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }).end(token);
    return;
  }

  if (req.method === 'OPTIONS' && url.pathname === MCP_PATH) {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type, mcp-session-id',
      'Access-Control-Expose-Headers': 'Mcp-Session-Id'
    });
    res.end();
    return;
  }

  if (url.pathname === MCP_PATH && ['POST', 'GET', 'DELETE'].includes(req.method || '')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
    const server = makeServer(origin);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { transport.close(); server.close(); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (err) {
      console.error('MCP request failed', err?.message || err);
      if (!res.headersSent) res.writeHead(500).end('Internal server error');
    }
    return;
  }

  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not Found');
});

httpServer.listen(port, () => console.log(`Mejlcentralen: http://localhost:${port}${MCP_PATH}`));
