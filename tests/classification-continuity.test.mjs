import test from 'node:test';
import assert from 'node:assert/strict';
import {transferClassifications} from '../scripts/transfer-classifications.mjs';

const old={id:'oct-1',month:'2026-10',type:'expense',account:'nubank-pf',last4:'3882',description:'AliExpress - iluminação Janela',originalDescription:'Mp *Aliexpress',category:'Equipamentos de trabalho',purpose:'Profissional',amount:3427,installment:11,installments:12,review:false};
const next={id:'nov-1',month:'2026-11',type:'expense',account:'nubank-pf',last4:'3882',description:'Mp *Aliexpress',category:'A classificar',amount:3427,installment:12,installments:12,review:true};
const transfer=(prior=[old],incoming=[next])=>transferClassifications({transactions:prior},{transactions:incoming});

test('next installment inherits a confirmed label without changing amount or provenance',()=>{
  const result=transfer();
  assert.deepEqual(result.applied,[{currentId:'nov-1',previousId:'oct-1'}]);
  assert.deepEqual(result.needsReview,[]);
  assert.equal(result.data.transactions[0].description,'AliExpress - iluminação Janela');
  assert.equal(result.data.transactions[0].originalDescription,'Mp *Aliexpress');
  assert.equal(result.data.transactions[0].amount,3427);
  assert.equal(result.data.transactions[0].purpose,'Profissional');
});

test('different amounts and provisional identifications require review',()=>{
  const amountMismatch=transfer([old],[{...next,amount:3428}]);
  assert.equal(amountMismatch.applied.length,0);
  assert.equal(amountMismatch.needsReview.length,1);
  const provisional=transfer([{...old,classificationStatus:'provisional'}]);
  assert.equal(provisional.applied.length,0);
  assert.equal(provisional.needsReview.length,1);
});

test('similar purchases are never assigned one label ambiguously',()=>{
  const duplicatePrior=transfer([old,{...old,id:'oct-2',description:'Outra compra'}]);
  assert.equal(duplicatePrior.applied.length,0);
  assert.equal(duplicatePrior.needsReview.length,1);
  const duplicateIncoming=transfer([old],[next,{...next,id:'nov-2'}]);
  assert.equal(duplicateIncoming.applied.length,0);
  assert.equal(duplicateIncoming.needsReview.length,2);
});

test('ended installments, another card, or another month do not match',()=>{
  assert.equal(transfer([{...old,installment:12}]).applied.length,0);
  assert.equal(transfer([old],[{...next,last4:'9067'}]).applied.length,0);
  assert.equal(transfer([old],[{...next,month:'2026-12'}]).applied.length,0);
});
