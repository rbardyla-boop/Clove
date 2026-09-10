// Explicit static allowlist: never uploads the checkout or replaces the site catalog.
import {readFile,writeFile,mkdir,copyFile,readdir} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=resolve(root,'dist/arcade-care');
const files=[
  'game/Arcade/index.html','game/Arcade/mind-route.js','game/Arcade/mind-machine.js',
  'game/Arcade/mind-machine.css','game/Arcade/deck-care.js','game/Arcade/deck-care.css',
  'game/theincrediblemindmachine/index.html',
  'game/vendor/three/three.min-0.160.0.js','game/vendor/three/three.module-0.152.2.js',
  'game/vendor/cannon-es/cannon-es-0.20.0.js','clove-signals.js',
];
execFileSync('git',['diff','--exit-code','HEAD','--',...files],{cwd:root,stdio:'pipe'});
execFileSync('git',['ls-files','--error-unmatch',...files],{cwd:root,stdio:'pipe'});
const source=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
await mkdir(output,{recursive:true});
const allowed=new Set([...files,'_headers','arcade-care-receipt.json']);
async function checkDirectory(directory) {
  for(const entry of await readdir(directory,{withFileTypes:true})) {
    const path=resolve(directory,entry.name);
    if(entry.isDirectory())await checkDirectory(path);
    else if(entry.isSymbolicLink()||!allowed.has(relative(output,path)))throw Error(`Unexpected staged file: ${relative(output,path)}`);
  }
}
await checkDirectory(output);
const artifacts=[];
for(const file of files) {
  const bytes=await readFile(resolve(root,file));
  await mkdir(dirname(resolve(output,file)),{recursive:true});
  await copyFile(resolve(root,file),resolve(output,file));
  artifacts.push({path:file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const csp="default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net https://static.cloudflareinsights.com; connect-src 'self' https://cdn.jsdelivr.net blob:; worker-src 'self' blob:; media-src 'self' blob:; manifest-src data: blob:; form-action 'self'";
await writeFile(resolve(output,'_headers'),`/*\n  Cache-Control: no-cache\n  X-Arcade-Care-Source: ${source}\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: SAMEORIGIN\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()\n  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload\n  Cross-Origin-Opener-Policy: same-origin\n  Cross-Origin-Embedder-Policy: credentialless\n  Content-Security-Policy: ${csp}\n`);
await writeFile(resolve(output,'arcade-care-receipt.json'),JSON.stringify({source,artifacts},null,2)+'\n');
console.log(JSON.stringify({source,output,files:artifacts.length,bytes:artifacts.reduce((sum,a)=>sum+a.bytes,0)},null,2));
