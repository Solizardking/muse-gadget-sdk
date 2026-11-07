import {providers} from '../api/providers.mjs';
const env=process.env;
const rpc=Boolean(env.RPC_URL||env.ALCHEMY_API_KEY||env.HELIUS_RPC_URL||env.HELIUS_API_KEY);
for(const [service,configured] of [['Solana RPC',rpc],['Birdeye charts',!!env.BIRDEYE_API_KEY],['Jupiter',!!env.JUPITER_API_KEY],['DFlow',!!env.DFLOW_API_KEY],['OpenRouter',!!env.OPENROUTER_API_KEY],['Meta',!!env.META_API_KEY],['Muse SDK',!!(env.SDK_TOKEN||env.GADGET_API_KEY)]])console.log(`${service}: ${configured?'configured':'missing'}`);
if(rpc){try{const p=await providers().portfolio('Vote111111111111111111111111111111111111111');console.log(`Live RPC: passed (${p.tokens.length} token accounts)`);}catch(e){console.error(e.message);process.exitCode=1;}}
