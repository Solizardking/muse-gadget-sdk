import express from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { fileURLToPath } from 'node:url';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { VersionedTransaction, PublicKey } from '@solana/web3.js';
import sharp from 'sharp';
import { ApiError,address,providers } from './providers.mjs';
import { metaClient, META_PROTOCOLS, SPARK_MODELS } from './meta.mjs';
import { installMetaRoutes } from './meta-routes.mjs';
import { clawdClient } from './clawd.mjs';
const id=()=>randomBytes(24).toString('base64url');
export function createApp({env=process.env, provider=providers(env), meta=metaClient(env), clawd=clawdClient(env), now=()=>Date.now()}={}) {
  const app=express(), challenges=new Map(),sessions=new Map(),quotes=new Map(),intents=new Map(),limits=new Map();
  // Enable only behind Railway's edge, which supplies the client X-Real-IP.
  const trustProxy=env.TRUST_PROXY==='1';
  if(trustProxy) app.set('trust proxy',1);
  app.disable('x-powered-by'); app.use(express.json({limit:'128kb'}));
  app.get('/healthz',(req,res)=>res.set('Cache-Control','no-store').json({ok:true,service:'pocket-wallet'}));
  const origin=env.APP_ORIGIN||'http://localhost:5173';
  app.use('/api',(req,res,next)=>{
    res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    if(req.headers.origin && req.headers.origin!==origin) return next(new ApiError(403,'This browser origin is not allowed.'));
    const realIP=req.get('X-Real-IP'),edgeIP=req.get('X-Pocket-Client-IP'),edgeToken=req.get('X-Pocket-Edge-Token');
    let authenticatedEdge=false;
    if(env.EDGE_PROXY_SECRET&&edgeToken) {
      const expected=Buffer.from(env.EDGE_PROXY_SECRET),actual=Buffer.from(edgeToken);
      authenticatedEdge=expected.length===actual.length&&timingSafeEqual(expected,actual);
    }
    const key=authenticatedEdge&&isIP(edgeIP||'')?edgeIP:trustProxy&&isIP(realIP||'')?realIP:req.ip, time=now(), state=limits.get(key);
    if(!state||time-state.start>60000) limits.set(key,{start:time,count:1});
    else if(++state.count>120) return next(new ApiError(429,'Too many requests. Wait a minute.'));
    for(const map of [challenges,sessions,quotes,intents]) for(const [key,v] of map) if(v.expires<time) map.delete(key);
    for(const [key,v] of limits) if(time-v.start>60000) limits.delete(key);
    if(sessions.size+quotes.size+intents.size+challenges.size>1000) return next(new ApiError(503,'Server busy. Retry shortly.'));
    next();
  });
  app.get('/api/gadget/status',(req,res)=>res.json({ok:true,mode:'sign-in',network:'solana:mainnet',providers:Object.fromEntries(['RPC_URL','ALCHEMY_API_KEY','HELIUS_RPC_URL','HELIUS_API_KEY','BIRDEYE_API_KEY','JUPITER_API_KEY','DFLOW_API_KEY','OPENROUTER_API_KEY','META_API_KEY','SDK_TOKEN','GADGET_API_KEY'].map(k=>[k,k==='META_API_KEY'?meta.configured():Boolean(env[k])])),gadget_sdk:{configured:Boolean(env.SDK_TOKEN||env.GADGET_API_KEY),credential_variable:env.SDK_TOKEN?'SDK_TOKEN':env.GADGET_API_KEY?'GADGET_API_KEY':null},meta:{configured:meta.configured(),model:env.META_MODEL||'muse-spark-1.3',protocol:env.META_PROTOCOL||'responses',protocols:META_PROTOCOLS,voice_models:SPARK_MODELS},capabilities:{wallet_mode:false,voice_audio:false,voice_text:true},backend:'pocket-wallet'}));
  app.post('/api/gadget/challenge',(req,res)=>{
    const wallet=address(req.body.wallet),nonce=id(),expires=now()+300000;
    const message=`${new URL(origin).host} wants you to sign in with your Solana account:\n${wallet}\n\nLink Pocket Wallet for read-only data and transaction preparation.\n\nURI: ${origin}\nVersion: 1\nChain ID: mainnet\nNonce: ${nonce}\nIssued At: ${new Date(now()).toISOString()}\nExpiration Time: ${new Date(expires).toISOString()}`;
    challenges.set(nonce,{wallet,message,expires});res.json({nonce,message,expires_at:new Date(expires).toISOString()});
  });
  app.post('/api/gadget/device-auth',(req,res)=>{
    const challenge=challenges.get(req.body.nonce); if(!challenge||challenge.expires<=now()) throw new ApiError(401,'Sign-in request expired. Connect again.');
    let signature;try { signature=bs58.decode(req.body.signature); } catch { throw new ApiError(401,'Invalid signature.'); }
    if(signature.length!==64||!nacl.sign.detached.verify(Buffer.from(challenge.message),signature,new PublicKey(challenge.wallet).toBytes())) throw new ApiError(401,'Signature did not match this wallet.');
    challenges.delete(req.body.nonce);const token=id(),expires=now()+3600000;
    sessions.set(token,{wallet:challenge.wallet,expires,can_submit:true});res.json({device_token:token,wallet:challenge.wallet,expires_at:new Date(expires).toISOString(),scopes:['portfolio','chart','quote','intent','voice','user-signed-submit']});
  });
  app.use('/api/gadget',(req,res,next)=>{
    const token=req.headers.authorization?.replace(/^Bearer /,'');const session=sessions.get(token);
    if(!session||session.expires<=now()) return next(new ApiError(401,'Session expired. Connect your wallet again.'));
    req.session=session;req.token=token;next();
  });
  app.delete('/api/gadget/session',(req,res)=>{sessions.delete(req.token);res.json({ok:true});});
  app.post('/api/gadget/device-token',(req,res)=>{
    const device_token=id(),expires=now()+3600000; sessions.set(device_token,{wallet:req.session.wallet,expires,can_submit:false});
    res.json({device_token,wallet:req.session.wallet,expires_at:new Date(expires).toISOString()});
  });
  installMetaRoutes(app,meta,env,now);
  app.get('/api/gadget/portfolio',async(req,res)=>res.json(await provider.portfolio(req.session.wallet)));
  app.post('/api/gadget/quote',async(req,res)=>{
    const quote=await provider.order({...req.body,wallet:req.session.wallet});
    let tx;try{tx=VersionedTransaction.deserialize(Buffer.from(quote.transaction,'base64'));}catch{throw new ApiError(502,'Provider returned an invalid transaction.');}
    if(tx.message.staticAccountKeys[0]?.toBase58()!==req.session.wallet) throw new ApiError(502,'Transaction payer does not match your wallet.');
    const upstreamExpiry=Date.parse(quote.data?.expireAt);const quote_id=id(),expires=Number.isFinite(upstreamExpiry)?Math.min(now()+30000,upstreamExpiry):now()+30000;
    if(expires<=now()) throw new ApiError(409,'Provider quote expired. Request a fresh quote.');
    quotes.set(quote_id,{...quote,wallet:req.session.wallet,expires});res.json({quote_id,...terms(quote),expires_at:new Date(expires).toISOString()});
  });
  function owned(map,key,wallet) { const item=map.get(key); if(!item||item.expires<=now()||item.wallet!==wallet) throw new ApiError(409,'Review expired or unavailable. Request a fresh quote.');return item; }
  app.post('/api/gadget/intent',(req,res)=>{
    const quote=owned(quotes,req.body.quote_id,req.session.wallet),intent_id=id();
    quotes.delete(req.body.quote_id);intents.set(intent_id,{...quote,used:false});res.json({intent_id,unsigned_tx:quote.transaction,exact_terms:terms(quote),expires_at:new Date(quote.expires).toISOString()});
  });
  app.post('/api/gadget/submit',async(req,res)=>{
    if(!req.session.can_submit) throw new ApiError(403,'Device tokens cannot submit transactions. Approve in the browser wallet.');
    const intent=owned(intents,req.body.intent_id,req.session.wallet);if(intent.used) throw new ApiError(409,'This transaction was already submitted. Check the receipt before retrying.');
    if(typeof req.body.signed_tx!=='string'||req.body.signed_tx.length>20000) throw new ApiError(400,'Invalid signed transaction.');
    let original,signed;try {original=VersionedTransaction.deserialize(Buffer.from(intent.transaction,'base64'));signed=VersionedTransaction.deserialize(Buffer.from(req.body.signed_tx,'base64'));} catch {throw new ApiError(400,'Invalid transaction encoding.');}
    const before=Buffer.from(original.message.serialize()),after=Buffer.from(signed.message.serialize());
    if(before.length!==after.length||!timingSafeEqual(before,after)) throw new ApiError(400,'Signed transaction differs from reviewed transaction.');
    const signers=signed.message.staticAccountKeys.slice(0,signed.message.header.numRequiredSignatures),idx=signers.findIndex(k=>k.toBase58()===req.session.wallet);
    if(idx<0||!nacl.sign.detached.verify(after,signed.signatures[idx],signers[idx].toBytes())) throw new ApiError(401,'Your wallet must sign the reviewed transaction.');
    intent.used=true;
    // Retain the lock on ambiguous provider failures; prevent duplicate economic actions.
    const result=await provider.execute(intent,req.body.signed_tx);res.json(result);
  });
  // Clawd voice-trader tickets for on-device review. The sc_ token is per-request, never stored here.
  app.get('/api/gadget/clawd/pending',async(req,res)=>res.json(await clawd.pending(req.get('X-Clawd-Token'))));
  app.delete('/api/gadget/clawd/pending/:id',async(req,res)=>res.json(await clawd.dismiss(req.get('X-Clawd-Token'),req.params.id)));
  app.post('/api/gadget/voice',async(req,res)=>res.json(await provider.voice(req.body.transcript,{model:req.body.model,protocol:req.body.protocol})));
  app.post('/api/gadget/rpc',async(req,res)=>{
    const {method,params}=req.body;
    const allowed=['getLatestBlockhash','getBlockHeight','getSignatureStatuses'];
    if(!allowed.includes(method)||!Array.isArray(params)) throw new ApiError(400,'RPC method unavailable.');
    if(method==='getSignatureStatuses'&&(!Array.isArray(params[0])||params[0].length>5)) throw new ApiError(400,'At most five signatures per request.');
    res.json({jsonrpc:'2.0',id:req.body.id??1,result:await provider.rpc(method,params)});
  });
  app.get('/api/gadget/chart',async(req,res)=>{
    const tf=req.query.tf||'1h';if(!['1h','4h','1d'].includes(tf)) throw new ApiError(400,'Choose 1h, 4h or 1d.');
    if(req.query.format&&!['jpeg','png','rgb565'].includes(req.query.format)) throw new ApiError(400,'Choose jpeg, png or rgb565.');
    const mint=address(req.query.mint),items=await provider.candles(mint,tf);
    const closes=items.map(i=>Number(i.c)).filter(Number.isFinite);if(closes.length<2) throw new ApiError(404,'No chart data available for this token.');
    const low=Math.min(...closes),range=Math.max(...closes)-low||1;
    const points=closes.map((v,i)=>`${Math.round(20+i/(closes.length-1)*200)},${Math.round(195-(v-low)/range*145)}`).join(' ');
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="240" height="240" fill="#10201d"/><text x="120" y="28" text-anchor="middle" fill="#a5f6b4" font-family="sans-serif" font-size="13">Pocket Wallet · ${req.query.tf||'1h'}</text><polyline points="${points}" fill="none" stroke="#a5f6b4" stroke-width="3"/><text x="120" y="225" text-anchor="middle" fill="white" font-family="sans-serif" font-size="12">${closes.at(-1).toPrecision(5)} USD</text></svg>`;
    const image=sharp(Buffer.from(svg));
    if(req.query.format==='rgb565') {
      const raw=await image.removeAlpha().raw().toBuffer(),out=Buffer.alloc(240*240*2);
      for(let i=0;i<240*240;i++) out.writeUInt16BE(((raw[i*3]>>3)<<11)|((raw[i*3+1]>>2)<<5)|(raw[i*3+2]>>3),i*2);
      res.type('application/octet-stream').send(out);
    } else res.type(req.query.format==='png'?'png':'jpeg').send(await (req.query.format==='png'?image.png():image.jpeg({progressive:false})).toBuffer());
  });
  app.get(['/pair','/pair/'],(req,res)=>res.set('Cache-Control','no-store').sendFile(fileURLToPath(new URL('../dist/pair/index.html',import.meta.url))));
  for(const name of ['PAIRING.md','MUSE_SDK.md','MOBILE.md','SECURITY.md']) {
    app.get(`/docs/${name}`,(req,res)=>res.type('text/markdown').set('Cache-Control','no-store').sendFile(fileURLToPath(new URL(`../docs/${name}`,import.meta.url))));
  }
  app.use(express.static('dist'));
  app.use((error,req,res,next)=>{const status=error.status||500;res.status(status).json({error:status===500?'Something went wrong. Please retry.':error.message});});
  return app;
}
function terms(q) {return {venue:q.venue,input_mint:q.input_mint,output_mint:q.output_mint,in_amount:q.in_amount,out_amount:q.out_amount,minimum_receive:q.minimum_receive,slippage_bps:q.slippage_bps,units:'base units',fees:{signature_lamports:q.data.signatureFeeLamports??null,priority_lamports:q.data.prioritizationFeeLamports??null,rent_lamports:q.data.rentFeeLamports??null,platform_bps:q.data.feeBps??q.data.platformFee?.feeBps??0}};}
