// Cloudflare Pages defense in depth. Never trust the Access header without verification.
// Local development is served separately and does not run this middleware.
const decode=value=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
let keyCache={issuer:'',expires:0,keys:[]};
async function keysFor(issuer,kid){
  if(keyCache.issuer!==issuer||keyCache.expires<Date.now()||!keyCache.keys.some(k=>k.kid===kid)){
    const response=await fetch(`${issuer}/cdn-cgi/access/certs`,{signal:AbortSignal.timeout(5000)});
    if(!response.ok)throw Error('Key fetch failed');
    const jwks=await response.json();
    if(!Array.isArray(jwks.keys))throw Error('Invalid JWKS');
    keyCache={issuer,expires:Date.now()+300000,keys:jwks.keys};
  }
  return keyCache.keys.find(k=>k.kid===kid&&k.kty==='RSA'&&(!k.alg||k.alg==='RS256'));
}
export async function verifyAccessToken(token,issuer,audience){
  if(!token||token.length>16384)throw Error('Missing token');
  const parts=token.split('.');if(parts.length!==3)throw Error('Invalid token');
  const header=JSON.parse(new TextDecoder().decode(decode(parts[0])));
  const payload=JSON.parse(new TextDecoder().decode(decode(parts[1])));
  if(header.alg!=='RS256'||typeof header.kid!=='string'||header.crit)throw Error('Invalid algorithm');
  const now=Math.floor(Date.now()/1000);
  if(payload.iss!==issuer||!Array.isArray(payload.aud)||!payload.aud.includes(audience)||typeof payload.exp!=='number'||payload.exp<=now||typeof payload.iat!=='number'||payload.iat>now+30||(payload.nbf!=null&&(typeof payload.nbf!=='number'||payload.nbf>now+30)))throw Error('Invalid claims');
  const jwk=await keysFor(issuer,header.kid);if(!jwk)throw Error('Unknown key');
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  const valid=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(parts[2]),new TextEncoder().encode(parts.slice(0,2).join('.')));
  if(!valid)throw Error('Invalid signature');
  return payload;
}
const secureHeaders={
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'private, no-store','X-Frame-Options':'DENY'
};
const deny=(message,status)=>new Response(message,{status,headers:{...secureHeaders,'Content-Type':'text/plain; charset=utf-8'}});
export async function onRequest(context){
  const issuer=context.env.ACCESS_TEAM_DOMAIN?.replace(/\/$/,'');
  const audience=context.env.ACCESS_AUD;
  if(!issuer||!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer)||!audience)return deny('Zuvori privado. Configure o Cloudflare Access antes de publicar.',503);
  try{await verifyAccessToken(context.request.headers.get('Cf-Access-Jwt-Assertion'),issuer,audience);}catch{return deny('Acesso privado. Entre pelo endereço protegido do Zuvori.',403);}
  const result=await context.next();
  const response=new Response(result.body,result);
  for(const [key,value] of Object.entries(secureHeaders))response.headers.set(key,value);
  return response;
}
