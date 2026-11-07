import { PublicKey } from '@solana/web3.js';
import { metaClient, metaVoice } from './meta.mjs';
export class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }
export const SOL = 'So11111111111111111111111111111111111111112';
export const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export function address(value) { try { return new PublicKey(value).toBase58(); } catch { throw new ApiError(400, 'Enter a valid Solana address.'); } }
export function amount(value) { if (typeof value !== 'string' || !/^[1-9]\d{0,19}$/.test(value) || BigInt(value) > 18446744073709551615n) throw new ApiError(400,'Amount must be a positive integer in token base units.'); return value; }
export function providers(env = process.env, fetcher = fetch) {
  const meta = metaClient(env, fetcher);
  async function request(url, options = {}) {
    let r;
    try { r = await fetcher(url, {...options, signal:AbortSignal.timeout(15000),redirect:'error'}); }
    catch { throw new ApiError(502, 'Provider unavailable. Please retry.'); }
    if (!r.ok) throw new ApiError(502, `Provider returned HTTP ${r.status}. Check server configuration or retry.`);
    const data = await r.json();
    if(data.errorCode===1 && data.error==='Insufficient funds') throw new ApiError(400,'Your wallet needs enough SOL for the swap and network fees.');
    if (data.error || data.success === false) throw new ApiError(502, 'Provider could not complete the request.');
    return data;
  }
  function required(key) { if (!env[key]) throw new ApiError(503, `${key} is not configured on the server.`); return env[key]; }
  async function rpc(method, params) {
    const url = env.RPC_URL || env.HELIUS_RPC_URL || (env.ALCHEMY_API_KEY ? `https://solana-mainnet.g.alchemy.com/v2/${env.ALCHEMY_API_KEY}` : `https://mainnet.helius-rpc.com/?api-key=${required('HELIUS_API_KEY')}`);
    const data = await request(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
    return data.result;
  }
  async function portfolio(wallet) {
    const [balance, ...groups] = await Promise.all([rpc('getBalance',[wallet,{commitment:'confirmed'}]), ...['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'].map(programId => rpc('getTokenAccountsByOwner',[wallet,{programId},{encoding:'jsonParsed',commitment:'confirmed'}]))]);
    const tokens = groups.flatMap(g => g.value || []).map(a => a.account.data.parsed.info).filter(i => BigInt(i.tokenAmount.amount)>0n).map(i => ({mint:i.mint,...i.tokenAmount}));
    return {wallet,sol:balance.value/1e9,tokens,updated_at:new Date().toISOString()};
  }
  async function candles(mint, tf='1h') {
    if (!['1h','4h','1d'].includes(tf)) throw new ApiError(400,'Choose 1h, 4h or 1d.');
    const end = Math.floor(Date.now()/1000), duration = {'1h':3600,'4h':14400,'1d':86400}[tf];
    const query = new URLSearchParams({address:mint,type:tf,time_from:String(end-duration*48),time_to:String(end)});
    const data = await request(`https://public-api.birdeye.so/defi/ohlcv?${query}`,{headers:{'X-API-KEY':required('BIRDEYE_API_KEY'),'x-chain':'solana'}});
    return data.data?.items || [];
  }
  async function order({wallet,input_mint,output_mint,amount:raw,slippage_bps=50,venue='jupiter'}) {
    address(wallet); address(input_mint); address(output_mint); amount(raw);
    if(input_mint===output_mint) throw new ApiError(400,'Choose two different tokens.');
    if(!Number.isInteger(slippage_bps)||slippage_bps<1||slippage_bps>300) throw new ApiError(400,'Slippage must be between 1 and 300 basis points.');
    const params=new URLSearchParams({inputMint:input_mint,outputMint:output_mint,amount:raw,slippageBps:String(slippage_bps)});
    let data;
    if(venue==='jupiter') { params.set('taker',wallet); data=await request(`https://api.jup.ag/swap/v2/order?${params}`,{headers:{'x-api-key':required('JUPITER_API_KEY')}}); }
    else if(venue==='dflow') { params.set('userPublicKey',wallet); data=await request(`https://quote-api.dflow.net/order?${params}`,{headers:{'x-api-key':required('DFLOW_API_KEY')}}); }
    else throw new ApiError(400,'Choose Jupiter or DFlow.');
    if(venue==='dflow'&&data.executionMode&&data.executionMode!=='sync') throw new ApiError(503,'Asynchronous DFlow routes are not supported. Choose Jupiter or another pair.');
    if(!data.transaction||!data.outAmount||!data.otherAmountThreshold) throw new ApiError(502,'Provider did not return a complete executable quote.');
    if(data.inputMint!==input_mint || data.outputMint!==output_mint || String(data.inAmount)!==raw) throw new ApiError(502,'Provider quote does not match your request.');
    return {data,venue,input_mint,output_mint,in_amount:raw,out_amount:String(data.outAmount),minimum_receive:String(data.otherAmountThreshold),slippage_bps,transaction:data.transaction,request_id:data.requestId};
  }
  async function execute(intent, signedTransaction) {
    if(intent.venue==='jupiter') {
      const result=await request('https://api.jup.ag/swap/v2/execute',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':required('JUPITER_API_KEY')},body:JSON.stringify({signedTransaction,requestId:intent.request_id})});
      if(result.status!=='Success'||!result.signature) throw new ApiError(502,'Swap not confirmed. Check your wallet before retrying.');
      return {signature:result.signature,status:'confirmed'};
    }
    const signature=await rpc('sendTransaction',[signedTransaction,{encoding:'base64',skipPreflight:false,maxRetries:2}]);
    return {signature,status:'submitted'};
  }
  async function voice(transcript, options = {}) {
    if(typeof transcript!=='string'||!transcript.trim()||transcript.length>1000) throw new ApiError(400,'Enter a command of up to 1000 characters.');
    const selected = env.VOICE_PROVIDER || (meta.configured() ? 'meta' : 'openrouter');
    if (selected === 'meta') return metaVoice(meta, transcript, options, env);
    if (selected !== 'openrouter') throw new ApiError(503, 'VOICE_PROVIDER must be meta or openrouter.');
    const result=await request('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${required('OPENROUTER_API_KEY')}`,'Content-Type':'application/json'},body:JSON.stringify({model:env.OPENROUTER_MODEL||'openai/gpt-4o-mini',temperature:0,messages:[{role:'system',content:'Parse a Solana swap command. Return JSON only with side (buy or sell), symbol, amount (decimal string), and reply_text. Never invent a mint address, quote, or claim execution. If ambiguous set side to null and ask for clarification in reply_text.'},{role:'user',content:transcript}],response_format:{type:'json_object'}})});
    let intent; try { intent=JSON.parse(result.choices[0].message.content); } catch { throw new ApiError(502,'Could not understand the command. Try again.'); }
    return {transcript,intent,reply_text:String(intent.reply_text||'Review token and amount before requesting a quote.').slice(0,1000),requires_review:true};
  }
  return {rpc,portfolio,candles,order,execute,voice};
}
