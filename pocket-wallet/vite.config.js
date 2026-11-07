import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root:'web',
  envDir:fileURLToPath(new URL('.',import.meta.url)),
  build:{outDir:'../dist',emptyOutDir:true,rollupOptions:{input:{
    wallet:fileURLToPath(new URL('web/index.html',import.meta.url)),
    pair:fileURLToPath(new URL('web/pair/index.html',import.meta.url)),
  }}},
  server:{proxy:{'/api':'http://127.0.0.1:8787'}},
});
