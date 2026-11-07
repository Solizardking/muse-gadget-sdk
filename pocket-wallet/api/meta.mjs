import { ApiError } from './providers.mjs';

export const META_PROTOCOLS = ['responses', 'chat/completions', 'messages'];
export const SPARK_MODELS = ['muse-spark-1.3', 'muse-spark-1.2', 'muse-spark-1.1', 'muse-spark-1.3-contributor', 'muse-spark-1.2-contributor'];
const ENDPOINTS = new Set([...META_PROTOCOLS, 'models', 'responses/input_tokens', 'messages/count_tokens']);

export function metaClient(env = process.env, fetcher = fetch) {
  const configured = () => Boolean(env.META_API_KEY || env.MODEL_API_KEY);
  async function request(endpoint, body, { signal } = {}) {
    if (!ENDPOINTS.has(endpoint)) throw new ApiError(400, 'Unsupported Meta endpoint.');
    const key = env.META_API_KEY || env.MODEL_API_KEY;
    if (!key) throw new ApiError(503, 'META_API_KEY is not configured on the server.');
    let result;
    try {
      result = await fetcher(`https://api.meta.ai/v1/${endpoint}`, {
        method: body === undefined ? 'GET' : 'POST', redirect: 'error',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(180000)]) : AbortSignal.timeout(180000),
      });
    } catch { throw new ApiError(502, 'Meta Model API unavailable. Please retry.'); }
    if (!result.ok) {
      await result.body?.cancel();
      if (result.status === 402) throw new ApiError(402, 'Meta inference credits are unavailable. Add credits in the Meta Model API dashboard.');
      const status = result.status === 429 ? 429 : result.status === 400 ? 400 : 502;
      throw new ApiError(status, `Meta Model API returned HTTP ${result.status}. Check the request, model access, or server credentials.`);
    }
    if (body?.stream) {
      if (!result.headers.get('content-type')?.includes('text/event-stream')) throw new ApiError(502, 'Meta did not return an event stream.');
      return result;
    }
    try {
      const data = await result.json();
      if (data.error || data.type === 'error') throw new Error();
      return data;
    } catch { throw new ApiError(502, 'Meta returned an invalid response.'); }
  }
  return { configured, request };
}

export function validateMetaRequest(protocol, input, env = process.env, counting = false) {
  if (!META_PROTOCOLS.includes(protocol)) throw new ApiError(400, 'Choose responses, chat/completions, or messages.');
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ApiError(400, 'Send a JSON request object.');
  const body = { ...input, model: input.model ?? env.META_MODEL ?? 'muse-spark-1.3' };
  if (body.include !== undefined && (!Array.isArray(body.include) || !body.include.every(i => typeof i === 'string'))) throw new ApiError(400, 'include must be an array of strings.');
  // Image and segmentation models only run through Responses; ASR has its own endpoints.
  const allowed = protocol === 'responses' ? [...SPARK_MODELS, 'muse-image-1.0', 'sam-3.1'] : SPARK_MODELS;
  if (!allowed.includes(body.model)) throw new ApiError(400, 'This model is not available on the selected API format.');
  if (protocol === 'responses') {
    if (!(typeof body.input === 'string' && body.input.trim()) && !(Array.isArray(body.input) && body.input.length)) throw new ApiError(400, 'Responses requires non-empty input.');
    if (body.response_format) throw new ApiError(400, 'Use text.format for Responses structured output.');
    if (body.previous_response_id && body.include?.includes('reasoning.encrypted_content')) throw new ApiError(400, 'Choose previous_response_id or encrypted reasoning replay.');
    if (body.conversation) throw new ApiError(400, 'Use previous_response_id or explicit input history.');
    if (body.background) throw new ApiError(400, 'Background execution is not supported by this device proxy. Use streaming.');
    body.store ??= Boolean(body.previous_response_id);
    if (SPARK_MODELS.includes(body.model) && !body.previous_response_id && !body.store) body.include = [...new Set([...(body.include || []), 'reasoning.encrypted_content'])];
  } else {
    if (!Array.isArray(body.messages) || !body.messages.length) throw new ApiError(400, 'This API format requires a non-empty messages array.');
    if (body.text || body.max_output_tokens !== undefined) throw new ApiError(400, 'Use parameters for the selected messages format.');
  }
  const effort = protocol === 'responses' ? body.reasoning?.effort : protocol === 'messages' ? body.output_config?.effort : body.reasoning_effort;
  const efforts = protocol === 'messages' ? ['low','medium','high','xhigh'] : ['minimal','low','medium','high','xhigh','max'];
  if (effort !== undefined && (!efforts.includes(effort) || (effort === 'max' && body.model !== 'muse-spark-1.3'))) throw new ApiError(400, 'Unsupported reasoning effort for this model and format.');
  if (body.thinking?.type === 'disabled') throw new ApiError(400, 'Muse Spark cannot disable reasoning.');
  if (body.stream !== undefined && typeof body.stream !== 'boolean') throw new ApiError(400, 'stream must be a boolean.');
  if (counting) { delete body.stream; return body; }
  const limitField = protocol === 'responses' ? 'max_output_tokens' : protocol === 'messages' ? 'max_tokens' : 'max_completion_tokens';
  if (protocol === 'chat/completions' && body.max_tokens !== undefined && body.max_completion_tokens !== undefined) throw new ApiError(400, 'Send only one output-token limit.');
  const limit = body[limitField] ?? (protocol === 'chat/completions' ? body.max_tokens : undefined) ?? 4096;
  if (!Number.isInteger(limit) || limit < 16 || limit > 16384) throw new ApiError(400, 'Output-token limit must be between 16 and 16384.');
  if (!(protocol === 'chat/completions' && body.max_tokens !== undefined)) body[limitField] = limit;
  return body;
}

export function metaText(protocol, response) {
  if (protocol === 'responses') return (response.output || []).filter(i => i.type === 'message').flatMap(i => i.content || []).filter(i => i.type === 'output_text').map(i => i.text).join('');
  if (protocol === 'messages') return (response.content || []).filter(i => i.type === 'text').map(i => i.text).join('');
  return response.choices?.[0]?.message?.content;
}

export const VOICE_INSTRUCTIONS = 'Parse a Solana swap command into side (buy or sell), symbol, amount (decimal string), and reply_text. Never invent a mint address, quote, or claim execution. If ambiguous set side, symbol, and amount to null and ask for clarification in reply_text. This only prepares a review; it never authorizes trading.';
export const VOICE_SCHEMA = { type: 'object', properties: { side: { enum: ['buy','sell',null] }, symbol: { type: ['string','null'] }, amount: { type: ['string','null'] }, reply_text: { type: 'string' } }, required: ['side','symbol','amount','reply_text'], additionalProperties: false };

export async function metaVoice(client, transcript, options = {}, env = process.env) {
  const protocol = options.protocol ?? env.META_PROTOCOL ?? 'responses';
  const base = { model: options.model ?? env.META_MODEL ?? 'muse-spark-1.3' };
  if (!SPARK_MODELS.includes(base.model)) throw new ApiError(400, 'Voice commands require a Muse Spark model.');
  let payload;
  if (protocol === 'responses') payload = { ...base, instructions: VOICE_INSTRUCTIONS, input: transcript, reasoning: { effort: 'low' }, text: { format: { type: 'json_schema', name: 'swap_command', schema: VOICE_SCHEMA, strict: true } } };
  else if (protocol === 'messages') payload = { ...base, system: VOICE_INSTRUCTIONS, messages: [{ role: 'user', content: transcript }], thinking: { type: 'adaptive' }, output_config: { effort: 'low', format: { type: 'json_schema', schema: VOICE_SCHEMA } } };
  else payload = { ...base, messages: [{ role: 'developer', content: VOICE_INSTRUCTIONS },{ role: 'user', content: transcript }], reasoning_effort: 'low', response_format: { type: 'json_schema', json_schema: { name: 'swap_command', schema: VOICE_SCHEMA, strict: true } } };
  const response = await client.request(protocol, validateMetaRequest(protocol, payload, env));
  if (response.status === 'incomplete' || response.status === 'failed' || response.stop_reason === 'max_tokens' || response.choices?.[0]?.finish_reason === 'length') throw new ApiError(502, 'Meta could not finish parsing. Try a shorter command.');
  let intent;
  try { intent = JSON.parse(metaText(protocol, response)); } catch { throw new ApiError(502, 'Could not understand the command. Try again.'); }
  if (!intent || typeof intent !== 'object' || !['buy','sell',null].includes(intent.side) || ![null,'string'].includes(intent.symbol === null ? null : typeof intent.symbol) || !(intent.amount === null || typeof intent.amount === 'string' && /^\d+(\.\d+)?$/.test(intent.amount) && /[1-9]/.test(intent.amount)) || typeof intent.reply_text !== 'string') throw new ApiError(502, 'Meta returned an invalid command. Please clarify.');
  return { transcript, intent: { side: intent.side, symbol: intent.symbol, amount: intent.amount, reply_text: intent.reply_text.slice(0,1000) }, reply_text: intent.reply_text.slice(0,1000), requires_review: true, provider: 'meta', model: base.model, protocol, usage: response.usage };
}
