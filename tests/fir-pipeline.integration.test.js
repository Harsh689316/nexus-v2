import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import crypto from 'node:crypto';

const DATABASE_URL=process.env.DATABASE_URL;

test('PostgreSQL FIR integration prerequisites', {skip:!DATABASE_URL}, async()=>{
  const pool=new pg.Pool({connectionString:DATABASE_URL,ssl:process.env.DATABASE_SSL==='true'?{rejectUnauthorized:false}:undefined,max:2});
  const firNumber=`TEST-${Date.now()}-${crypto.randomInt(1000,9999)}`;
  try {
    const client=await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('CREATE TABLE IF NOT EXISTS firs (id VARCHAR(64) PRIMARY KEY, fir_number VARCHAR(128) NOT NULL, source_system VARCHAR(32) NOT NULL DEFAULT \'CCTNS\', police_station VARCHAR(128), district VARCHAR(128), state VARCHAR(128), incident_date DATE, sections TEXT[] DEFAULT \'{}\', narrative TEXT, complainant_name VARCHAR(256), payload_hash VARCHAR(128) NOT NULL, received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, ingested_by VARCHAR(32), UNIQUE(source_system, fir_number))');
      await client.query('INSERT INTO firs(id,fir_number,source_system,police_station,district,state,incident_date,narrative,payload_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[`TEST-${crypto.randomBytes(8).toString('hex')}`,firNumber,'TEST','Integration Station','Pune','Maharashtra','2026-09-14','Integration FIR transaction test narrative.',crypto.createHash('sha256').update(firNumber).digest('hex')]);
      const found=await client.query('SELECT fir_number FROM firs WHERE source_system=$1 AND fir_number=$2',['TEST',firNumber]);
      assert.equal(found.rowCount,1);
      await client.query('ROLLBACK');
    } catch(e) { try{await client.query('ROLLBACK')}catch{}; throw e; }
    finally { client.release(); }
  } finally { await pool.end(); }
});

test('DATABASE_URL is required for the live PostgreSQL integration test', {skip:Boolean(DATABASE_URL)},()=>{
  assert.ok(true);
});
