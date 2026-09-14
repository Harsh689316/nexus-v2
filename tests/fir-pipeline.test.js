import test from 'node:test';
import assert from 'node:assert/strict';
import { CCTNSAdapter } from '../server/integrations/cctnsAdapter.js';

const validInput={
  firNumber:' FIR-2026-001 ',
  policeStation:' Shivajinagar PS ',
  district:'Pune',
  state:'Maharashtra',
  incidentDate:'2026-09-14',
  sections:['BNS 318','BNS 318','BNS 61'],
  narrative:'Authorized FIR integration test narrative.',
  complainantName:'Test'
};

test('FIR normalization is deterministic and removes duplicate sections',()=>{
  const adapter=new CCTNSAdapter();
  const a=adapter.normalizeFIR(validInput);
  const b=adapter.normalizeFIR({...validInput,sections:['BNS 318','BNS 61','BNS 318']});
  assert.deepEqual(a.sections,['BNS 318','BNS 61']);
  assert.equal(a.payloadHash,b.payloadHash);
  assert.equal(adapter.validateFIR(a).length,0);
  assert.equal(a.sourceSystem,'CCTNS');
});

test('source system is normalized into the integrity payload',()=>{
  const adapter=new CCTNSAdapter();
  const cctns=adapter.normalizeFIR({...validInput,sourceSystem:'cctns'});
  const icjs=adapter.normalizeFIR({...validInput,sourceSystem:'icjs'});
  assert.equal(cctns.sourceSystem,'CCTNS');
  assert.equal(icjs.sourceSystem,'ICJS');
  assert.notEqual(cctns.payloadHash,icjs.payloadHash);
});

test('invalid FIRs fail closed at validation',()=>{
  const adapter=new CCTNSAdapter();
  const fir=adapter.normalizeFIR({firNumber:'',policeStation:'',district:'',state:'',incidentDate:'bad',narrative:'x'});
  const errors=adapter.validateFIR(fir);
  assert.ok(errors.length>=5);
});

test('calendar validation rejects impossible dates',()=>{
  const adapter=new CCTNSAdapter();
  assert.equal(adapter.isValidISODate('2026-02-28'),true);
  assert.equal(adapter.isValidISODate('2026-02-29'),false);
  assert.equal(adapter.isValidISODate('2026-02-31'),false);
  assert.equal(adapter.isValidISODate('2026-13-01'),false);
});

test('narrative and section limits are enforced',()=>{
  const adapter=new CCTNSAdapter();
  const tooLong=adapter.normalizeFIR({...validInput,narrative:'x'.repeat(100001)});
  assert.ok(adapter.validateFIR(tooLong).some(e=>e.includes('100,000')));
  const tooMany=adapter.normalizeFIR({...validInput,sections:Array.from({length:101},(_,i)=>`BNS ${i}`)});
  assert.ok(adapter.validateFIR(tooMany).some(e=>e.includes('Too many')));
});

test('CCTNS HTTP response must be an array',async()=>{
  const adapter=new CCTNSAdapter({baseUrl:'https://cctns.example.test',apiKey:'test-key'});
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>new Response(JSON.stringify({not:'an array'}),{status:200,headers:{'content-type':'application/json'}});
  try { await assert.rejects(()=>adapter.pullLatestFIRs(),/invalid FIR collection/); }
  finally { globalThis.fetch=originalFetch; }
});
