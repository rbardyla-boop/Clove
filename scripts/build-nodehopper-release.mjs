// Static allowlist: never uploads the full site, catalog, or unrelated games.
import {readFile,writeFile,mkdir,copyFile,readdir} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=resolve(root,'dist/nodehopper-care');
const files=['game/nodehopper/Node Hopper.html','game/nodehopper/game.js','game/nodehopper/chambers.js',
  'game/nodehopper/traversal.js','game/nodehopper/render-helpers.js','game/nodehopper/audio.js',
  'game/vendor/three/three.min-0.160.0.js','clove-signals.js'];
execFileSync('git',['diff','--exit-code','HEAD','--',...files],{cwd:root,stdio:'pipe'});
execFileSync('git',['ls-files','--error-unmatch',...files],{cwd:root,stdio:'pipe'});
const source=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
await mkdir(output,{recursive:true});
const allowed=new Set([...files,'_headers','game/nodehopper/release-receipt.json']);
async function check(dir) {
  for(const entry of await readdir(dir,{withFileTypes:true})) {
    const path=resolve(dir,entry.name);
    if(entry.isDirectory())await check(path);
    else if(entry.isSymbolicLink()||!allowed.has(relative(output,path)))throw Error(`Unexpected staged file: ${relative(output,path)}`);
  }
}
await check(output);
const artifacts=[];
for(const file of files) {
  const bytes=await readFile(resolve(root,file));
  await mkdir(dirname(resolve(output,file)),{recursive:true});
  await copyFile(resolve(root,file),resolve(output,file));
  artifacts.push({path:file,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const csp="default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob:; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; connect-src 'self'; media-src 'self' blob:; form-action 'self'";
await writeFile(resolve(output,'_headers'),`/*\n  Cache-Control: no-cache\n  X-Nodehopper-Source: ${source}\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: SAMEORIGIN\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()\n  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload\n  Content-Security-Policy: ${csp}\n`);
await writeFile(resolve(output,'game/nodehopper/release-receipt.json'),JSON.stringify({source,artifacts},null,2)+'\n');
console.log(JSON.stringify({source,output,files:files.length}));
