import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ApiError } from './providers.mjs';
import { META_PROTOCOLS, validateMetaRequest } from './meta.mjs';

export function installMetaRoutes(app, client, env, now) {
  const history = new Map(), activity = new Map();
  app.get('/api/gadget/meta/models', async (req,res) => res.json(await client.request('models')));
  function owner(req, body) {
    for (const [key,v] of history) if (v.expires <= now()) history.delete(key);
    if (body.previous_response_id && history.get(body.previous_response_id)?.token !== req.token) throw new ApiError(403, 'Response history is unavailable in this device session.');
  }
  function remember(req, data) {
    if (data?.id && data.store !== false) {
      if (history.size >= 10000) history.delete(history.keys().next().value);
      history.set(data.id, { token: req.token, expires: req.session.expires });
    }
  }
  async function generate(req, res, protocol, counting = false) {
    const body = validateMetaRequest(protocol, req.body, env, counting);
    owner(req, body);
    for (const [key,v] of activity) if (!v.active && v.expires <= now()) activity.delete(key);
    let state = activity.get(req.token);
    if (!state) { state = { active: 0, count: 0, start: now(), expires: req.session.expires }; activity.set(req.token,state); }
    if (now() - state.start >= 60000) { state.start = now(); state.count = 0; }
    if (state.active >= 2 || state.count >= 12) throw new ApiError(429, 'Meta request limit reached. Retry shortly.');
    state.active++; state.count++;
    const abort = new AbortController();
    const disconnect = () => { if (!res.writableEnded) abort.abort(); };
    res.on('close', disconnect);
    try {
      const endpoint = counting ? protocol === 'responses' ? 'responses/input_tokens' : 'messages/count_tokens' : protocol;
      const result = await client.request(endpoint, body, { signal: abort.signal });
      if (!body.stream) { if (protocol === 'responses' && !counting) remember(req,result); res.json(result); return; }
      res.set({ 'Content-Type': 'text/event-stream', 'X-Accel-Buffering': 'no' });
      res.flushHeaders();
      const decoder = new TextDecoder();
      let pending = '';
      const observe = new Transform({ transform(chunk, encoding, done) {
        if (protocol === 'responses') {
          pending += decoder.decode(chunk, { stream: true });
          let newline;
          while ((newline = pending.indexOf('\n')) !== -1) {
            const line = pending.slice(0,newline); pending = pending.slice(newline+1);
            if (line.startsWith('data:')) { try { const event = JSON.parse(line.slice(5)); if (event.response) remember(req,event.response); } catch {} }
          }
          if (pending.length > 1024 * 1024) pending = '';
        }
        done(null,chunk);
      } });
      await pipeline(Readable.fromWeb(result.body), observe, res);
    } catch (error) {
      if (res.headersSent) { res.destroy(); return; }
      throw error;
    } finally { state.active--; res.off('close',disconnect); }
  }
  for (const protocol of META_PROTOCOLS) app.post(`/api/gadget/meta/${protocol}`, (req,res) => generate(req,res,protocol));
  app.post('/api/gadget/meta/responses/input_tokens', (req,res) => generate(req,res,'responses',true));
  app.post('/api/gadget/meta/messages/count_tokens', (req,res) => generate(req,res,'messages',true));
}
