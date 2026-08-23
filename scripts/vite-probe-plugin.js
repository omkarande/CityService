import { inferHubs, pipelineState, recordCheck } from './lib/pipeline.mjs';

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

/** Dev-only Vite middleware so /probe can write JSON without hand-editing. */
export function probeApiPlugin() {
  return {
    name: 'cityservice-probe-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0];
        if (!url?.startsWith('/api/probe')) {
          next();
          return;
        }

        try {
          if (req.method === 'GET' && url === '/api/probe/state') {
            const count = Number(new URL(req.url, 'http://local').searchParams.get('count') || 8);
            send(res, 200, pipelineState(count));
            return;
          }

          if (req.method === 'POST' && url === '/api/probe/record') {
            const body = await readBody(req);
            send(res, 200, recordCheck(body));
            return;
          }

          if (req.method === 'POST' && url === '/api/probe/infer') {
            send(res, 200, inferHubs({ dryRun: false }));
            return;
          }

          send(res, 404, { error: 'unknown probe route' });
        } catch (err) {
          send(res, 400, { error: err.message || String(err) });
        }
      });
    },
  };
}
