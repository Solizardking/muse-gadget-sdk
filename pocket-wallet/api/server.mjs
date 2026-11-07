import { createApp } from './app.mjs';
const port=Number(process.env.PORT||8787),host=process.env.HOST||'0.0.0.0';
if(!Number.isInteger(port)||port<1||port>65535) throw new Error('PORT must be an integer between 1 and 65535.');
const server=createApp().listen(port,host,()=>console.log(`Pocket Wallet listening on ${host}:${port}`));
let stopping=false;
function shutdown() {
  if(stopping) return;
  stopping=true;
  const timeout=setTimeout(()=>{server.closeAllConnections();process.exit(1);},10000);
  timeout.unref();
  server.close(error=>{clearTimeout(timeout);process.exit(error?1:0);});
}
process.on('SIGTERM',shutdown);
process.on('SIGINT',shutdown);
