import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Keypair } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { createApp } from '../app.mjs';
import { providers } from '../providers.mjs';
import { metaClient, validateMetaRequest, VOICE_SCHEMA } from '../meta.mjs';

test('Meta auth stays server-side and failures never expose credentials or provider messages', async () => {
  const client = metaClient({ META_API_KEY: 'secret' }, async (url, options) => {
    assert.equal(url,'https://api.meta.ai/v1/models');
    assert.equal(options.headers.Authorization,'Bearer secret');
    return new Response('secret leaked upstream', { status: 401 });
  });
  await assert.rejects(() => client.request('models'), e => e.status === 502 && !e.message.includes('secret'));
  await assert.rejects(() => metaClient({}).request('models'), e => e.status === 503);
  await assert.rejects(() => metaClient({META_API_KEY:'secret'},async()=>new Response('credit error',{status:402})).request('models'),e=>e.status===402 && /credits/.test(e.message));
  await assert.rejects(() => client.request('https://evil.example'), e => e.status === 400);
});

test('format validation enforces reasoning, replay, model availability and output budget', () => {
  assert.throws(() => validateMetaRequest('responses',{input:'hi',reasoning:{effort:'none'}}),/reasoning effort/);
  assert.throws(() => validateMetaRequest('responses',{input:'hi',model:'muse-spark-1.3-contributor',reasoning:{effort:'max'}}),/reasoning effort/);
  assert.throws(() => validateMetaRequest('responses',{input:'hi',previous_response_id:'resp',include:['reasoning.encrypted_content']}),/Choose/);
  assert.throws(() => validateMetaRequest('responses',{input:'hi',response_format:{type:'json_object'}}),/text.format/);
  assert.throws(() => validateMetaRequest('messages',{model:'muse-image-1.0',messages:[{role:'user',content:'hi'}]}),/model/);
  assert.throws(() => validateMetaRequest('messages',{messages:[{role:'user',content:'hi'}],max_tokens:100000}),/Output-token/);
  const body = validateMetaRequest('responses',{input:'hi'});
  assert.equal(body.store,false); assert.deepEqual(body.include,['reasoning.encrypted_content']);
  assert.equal(validateMetaRequest('messages',{messages:[{role:'user',content:'hi'}]}).max_tokens,4096);
});

test('voice uses each protocol schema, validates output and always requires review', async () => {
  for (const protocol of ['responses','chat/completions','messages']) {
    const intent={side:'sell',symbol:'SOL',amount:'0.01',reply_text:'Review your swap.'};
    const p = providers({META_API_KEY:'secret'},async(url,options) => {
      assert.equal(url,'https://api.meta.ai/v1/'+protocol);
      const body=JSON.parse(options.body);
      assert.equal(body.temperature,undefined);
      assert.deepEqual(protocol==='responses'?body.text.format.schema:protocol==='messages'?body.output_config.format.schema:body.response_format.json_schema.schema,VOICE_SCHEMA);
      const text=JSON.stringify(intent);
      return Response.json(protocol==='responses'?{output:[{type:'message',content:[{type:'output_text',text}]}]}:protocol==='messages'?{content:[{type:'text',text}]}:{choices:[{message:{content:text}}]});
    });
    const result=await p.voice('sell 0.01 SOL',{protocol});
    assert.equal(result.requires_review,true); assert.deepEqual(result.intent,intent);
  }
  const invalid=providers({META_API_KEY:'secret'},async()=>Response.json({output:[{type:'message',content:[{type:'output_text',text:'{"side":"sell","symbol":"SOL","amount":"-1","reply_text":"ok"}'}]}]}));
  await assert.rejects(()=>invalid.voice('sell SOL'),/invalid command/);
});

test('authenticated proxy preserves wire format and streams; response history is session isolated', async t => {
  const seen=[];
  const meta={configured:()=>true,request:async(endpoint,body)=>{
    seen.push({endpoint,body});
    if (body?.stream) return new Response('event: response.completed\ndata: {"type":"response.completed","response":{"id":"resp_stream","store":true}}\n\n',{headers:{'Content-Type':'text/event-stream'}});
    return endpoint==='models'?{data:[{id:'muse-spark-1.3'}]}:endpoint.endsWith('tokens')?{input_tokens:20}:{id:'resp_private',store:body.store,output:[{type:'reasoning',encrypted_content:'opaque',summary:[]}],usage:{input_tokens_details:{cached_tokens:2}}};
  }};
  const server=createApp({env:{},meta}).listen(0,'127.0.0.1');
  await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
  const base=`http://127.0.0.1:${server.address().port}/api/gadget/`;
  async function request(path,body,token) {return fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});}
  async function login() {
    const key=Keypair.generate(); const c=await (await request('challenge',{wallet:key.publicKey.toBase58()})).json();
    return (await (await request('device-auth',{nonce:c.nonce,signature:bs58.encode(nacl.sign.detached(Buffer.from(c.message),key.secretKey))})).json()).device_token;
  }
  assert.equal((await request('meta/models')).status,401);
  assert.equal((await request('meta/responses',{input:'hi'})).status,401);
  assert.equal(seen.length,0);
  const a=await login(),b=await login();
  const first=await (await request('meta/responses',{input:'hi',store:true},a)).json();
  assert.equal(first.output[0].encrypted_content,'opaque');assert.equal(first.usage.input_tokens_details.cached_tokens,2);
  assert.equal((await request('meta/responses',{input:'follow-up',previous_response_id:first.id},b)).status,403);
  assert.equal((await request('meta/responses',{input:'follow-up',previous_response_id:first.id},a)).status,200);
  const stream=await request('meta/responses',{input:'stream',store:true,stream:true},a);
  assert.match(await stream.text(),/response.completed/);
  assert.equal((await request('meta/responses',{input:'next',previous_response_id:'resp_stream'},a)).status,200);
  assert.equal((await request('meta/responses/input_tokens',{input:'hi'},a)).status,200);
  assert.equal(seen.at(-1).endpoint,'responses/input_tokens');
  assert.equal((await request('meta/messages/count_tokens',{messages:[{role:'user',content:'hi'}]},a)).status,200);
  assert.equal(seen.at(-1).endpoint,'messages/count_tokens');
  for (const protocol of ['chat/completions','messages']) {
    const payload={messages:[{role:'user',content:'hi'}],tools:[{opaque:'preserved'}]};
    assert.equal((await request('meta/'+protocol,payload,a)).status,200);
    assert.deepEqual(seen.at(-1).body.tools,payload.tools);
  }
  for (let i=0;i<5;i++) await request('meta/responses',{input:'hi'},a);
  assert.equal((await request('meta/responses',{input:'limited'},a)).status,429);
});
