import {test} from 'node:test';
import assert from 'node:assert/strict';
import {clawdClient,toReview,scToken} from '../clawd.mjs';
import {createApp} from '../app.mjs';
const ticket={quoteId:'q_abc',inSymbol:'SOL',outSymbol:'BONK',inAmount:0.1,outAmount:123456.789,minOut:120000,venue:'jupiter',expiresAt:2000000000,execution:'paper',unsignedTransaction:null,network:'solana:devnet'};
test('maps a voice-trader ticket to firmware review fields within pocket_review limits',()=>{
  const r=toReview(ticket);
  assert.equal(r.intent_id,'q_abc');assert.equal(r.pay,'0.1 SOL');assert.equal(r.receive,'123456.79 BONK');
  assert.equal(r.network,'solana:devnet');assert.equal(r.unsigned_transaction,null);assert.equal(r.quote_expires_ms,2e12);
  for(const k of ['pay','receive','minimum']) assert.ok(r[k].length<=48);assert.ok(r.venue.length<=24);
});
test('sc_ token is required and sent only as a bearer to the configured voice trader',async()=>{
  assert.throws(()=>scToken('nope'),/sc_/);
  let seen;const c=clawdClient({CLAWD_VOICE_TRADER_URL:'https://vt.example/'},async(url,o)=>{seen={url,o};return {ok:true,status:200,json:async()=>({tickets:[ticket],mainnetTradingEnabled:false})};});
  const d=await c.pending('sc_testtoken123');
  assert.equal(seen.url,'https://vt.example/api/orders/pending');assert.equal(seen.o.headers.Authorization,'Bearer sc_testtoken123');
  assert.equal(d.mainnet_trading_enabled,false);assert.equal(d.reviews[0].intent_id,'q_abc');
  const bad=clawdClient({},async()=>({ok:false,status:401}));
  await assert.rejects(bad.pending('sc_testtoken123'),e=>e.status===401);
});
test('clawd routes require a Pocket Wallet session',async t=>{
  const server=createApp({env:{APP_ORIGIN:'http://localhost:5173'},provider:{},clawd:{pending:async()=>({reviews:[]})}}).listen(0,'127.0.0.1');
  await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
  const r=await fetch(`http://127.0.0.1:${server.address().port}/api/gadget/clawd/pending`,{headers:{'X-Clawd-Token':'sc_testtoken123'}});
  assert.equal(r.status,401);
});
