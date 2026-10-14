import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest,verifyAccessToken} from '../functions/_middleware.js';
test('hosting fails closed without configuration',async()=>{const result=await onRequest({env:{},request:new Request('https://example.com'),next:()=>{throw Error('Must not serve assets');}});assert.equal(result.status,503);});
test('hosting rejects requests without Access JWT',async()=>{const result=await onRequest({env:{ACCESS_TEAM_DOMAIN:'https://test.cloudflareaccess.com',ACCESS_AUD:'test'},request:new Request('https://example.com'),next:()=>{throw Error('Must not serve assets');}});assert.equal(result.status,403);});
test('JWT verifies signature, audience and expiration',async()=>{
  const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
  const jwk=await crypto.subtle.exportKey('jwk',pair.publicKey);jwk.kid='test-key';jwk.alg='RS256';
  const originalFetch=globalThis.fetch;globalThis.fetch=async()=>Response.json({keys:[jwk]});
  const issuer='https://test.cloudflareaccess.com',now=Math.floor(Date.now()/1000);
  const b64=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  async function token(extra={}){const unsigned=b64({alg:'RS256',kid:'test-key'})+'.'+b64({iss:issuer,aud:['test'],iat:now,exp:now+300,...extra});const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(unsigned));return unsigned+'.'+Buffer.from(signature).toString('base64url');}
  try{
    const valid=await token();assert.equal((await verifyAccessToken(valid,issuer,'test')).iss,issuer);
    await assert.rejects(verifyAccessToken(await token({exp:now-1}),issuer,'test'));
    await assert.rejects(verifyAccessToken(valid,issuer,'another-audience'));
    await assert.rejects(verifyAccessToken(await token({iss:'https://other.cloudflareaccess.com'}),issuer,'test'));
    await assert.rejects(verifyAccessToken(valid.slice(0,valid.lastIndexOf('.')+1)+'dGFtcGVyZWQ',issuer,'test'));
    const served=await onRequest({env:{ACCESS_TEAM_DOMAIN:issuer,ACCESS_AUD:'test'},request:new Request('https://example.com',{headers:{'Cf-Access-Jwt-Assertion':valid}}),next:async()=>new Response('private app')});assert.equal(served.status,200);assert.equal(served.headers.get('Cache-Control'),'private, no-store');
  }finally{globalThis.fetch=originalFetch;}
});
