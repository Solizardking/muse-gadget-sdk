// Clawd voice-trader bridge. Fetches tickets the user handed off from clawd-voice-trader and maps them
// to the firmware review fields (pocket_review). Never signs, never holds keys, never stores the sc_ token.
import { ApiError } from './providers.mjs';
export const CLAWD_DEFAULT_URL='https://clawd-voice-trader-production.up.railway.app';
const clip=(v,n)=>String(v??'').slice(0,n);
const num=v=>Number.isFinite(Number(v))?String(+Number(v).toPrecision(8)):'?';
export function scToken(value) {
  const t=String(value||'').trim();
  if(!/^sc_[A-Za-z0-9_-]{8,200}$/.test(t)) throw new ApiError(400,'A Clawd sc_ access token is required (X-Clawd-Token).');
  return t;
}
export function toReview(t,{mainnet=false}={}) {
  const network=t.network||(mainnet?'solana:mainnet':'solana:devnet');
  return {
    intent_id:clip(t.quoteId,64),
    pay:clip(`${num(t.inAmount)} ${t.inSymbol||''}`.trim(),48),
    receive:clip(`${num(t.outAmount)} ${t.outSymbol||''}`.trim(),48),
    minimum:clip(`${num(t.minOut)} ${t.outSymbol||''}`.trim(),48),
    venue:clip(t.venue||'jupiter',24),
    quote_expires_ms:Number(t.expiresAt||0)*1000,
    network,
    execution:t.execution||'paper',
    // Present only when the voice trader runs with MAINNET_TRADING_ENABLED=true. The user's wallet signs it.
    unsigned_transaction:typeof t.unsignedTransaction==='string'?t.unsignedTransaction:null,
  };
}
export function clawdClient(env=process.env,fetchImpl=fetch) {
  const base=(env.CLAWD_VOICE_TRADER_URL||CLAWD_DEFAULT_URL).replace(/\/$/,'');
  async function call(path,token,method='GET') {
    let r;try { r=await fetchImpl(base+path,{method,headers:{Authorization:'Bearer '+scToken(token)},signal:AbortSignal.timeout(10000)}); }
    catch(e) { if(e instanceof ApiError) throw e; throw new ApiError(502,'Clawd voice trader unreachable.'); }
    if(r.status===401) throw new ApiError(401,'Clawd rejected the sc_ token.');
    if(!r.ok) throw new ApiError(502,`Clawd voice trader error (${r.status}).`);
    return r.json();
  }
  return {
    base,
    async pending(token) {
      const d=await call('/api/orders/pending',token);
      const mainnet=d.mainnetTradingEnabled===true;
      return {mainnet_trading_enabled:mainnet,reviews:(d.tickets||[]).map(t=>toReview(t,{mainnet}))};
    },
    async dismiss(token,quoteId) { return call('/api/orders/pending/'+encodeURIComponent(clip(quoteId,40)),token,'DELETE'); },
  };
}
