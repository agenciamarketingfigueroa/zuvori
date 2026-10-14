import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../public/',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.json':'application/json; charset=utf-8'};
const port=Number(process.argv[2]||4173);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Porta inválida.');
http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://127.0.0.1');
    if (req.headers.host !== `127.0.0.1:${port}` && req.headers.host !== `localhost:${port}`) {res.writeHead(403).end();return;}
    const privateRequest=url.pathname==='/__local-data';
    const file=privateRequest ? fileURLToPath(new URL('../private/finances.json',import.meta.url)) : path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
    if(!privateRequest && !file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    const data=await readFile(file);
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(data);
  }catch{res.writeHead(404).end('Não encontrado');}
}).listen(port,'127.0.0.1',()=>console.log(`Zuvori local: http://127.0.0.1:${port}`));
