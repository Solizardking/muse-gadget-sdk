import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
const secrets=Object.entries(process.env).filter(([k,v])=>/(?:KEY|TOKEN|SECRET|PASSWORD|RPC_URL)$/.test(k)&&v?.length>=8);
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):[join(dir,e.name)]);}
let failed=false;
for(const file of files('dist')) {const content=readFileSync(file);for(const [name,secret] of secrets) if(content.includes(Buffer.from(secret))) {console.error(`${name} found in browser output: ${file}`);failed=true;}}
if(failed)process.exit(1);
console.log(`Browser output checked against ${secrets.length} configured secrets: none found.`);
