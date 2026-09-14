import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CCTNSAdapter } from './integrations/cctnsAdapter.js';
import { generateDemoDataset } from './demoData.js';
let pool=null, pgAvailable=false;
try { const {Pool}=await import('pg'); if(process.env.DATABASE_URL){pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_SSL==='true'?{rejectUnauthorized:false}:undefined,max:10,idleTimeoutMillis:30000});pgAvailable=true;} } catch {}
export const dbState=()=>({postgres:pgAvailable&&!!pool,cctns:new CCTNSAdapter().isConfigured()});
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export async function ensureFIRSchema(){ if(!pool) return {configured:false}; const sql=`CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE TABLE IF NOT EXISTS firs (id VARCHAR(64) PRIMARY KEY, fir_number VARCHAR(128) NOT NULL, source_system VARCHAR(32) NOT NULL DEFAULT 'CCTNS', police_station VARCHAR(128), district VARCHAR(128), state VARCHAR(128), incident_date DATE, sections TEXT[] DEFAULT '{}', narrative TEXT, complainant_name VARCHAR(256), payload_hash VARCHAR(128) NOT NULL, received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, ingested_by VARCHAR(32) REFERENCES officers(id), UNIQUE(source_system, fir_number)); ALTER TABLE cases ADD COLUMN IF NOT EXISTS jurisdiction_area VARCHAR(128); ALTER TABLE cases ADD COLUMN IF NOT EXISTS jurisdiction_city VARCHAR(128); ALTER TABLE cases ADD COLUMN IF NOT EXISTS jurisdiction_division VARCHAR(128); ALTER TABLE cases ADD COLUMN IF NOT EXISTS cctns_fir_number VARCHAR(128); ALTER TABLE cases ADD COLUMN IF NOT EXISTS source_system VARCHAR(32); CREATE INDEX IF NOT EXISTS idx_firs_number ON firs(fir_number); CREATE INDEX IF NOT EXISTS idx_firs_received_at ON firs(received_at DESC); CREATE INDEX IF NOT EXISTS idx_firs_hash ON firs(payload_hash); CREATE INDEX IF NOT EXISTS idx_cases_cctns_fir ON cases(cctns_fir_number);
CREATE TABLE IF NOT EXISTS fir_analysis_findings (
  id VARCHAR(64) PRIMARY KEY,
  case_id VARCHAR(32) NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  fir_number VARCHAR(128) NOT NULL,
  finding_type VARCHAR(64) NOT NULL,
  title VARCHAR(256) NOT NULL,
  description TEXT NOT NULL,
  confidence INT NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  supporting_records JSONB NOT NULL DEFAULT '[]'::jsonb,
  involved_entities JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_action TEXT NOT NULL,
  reasoning TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_fir_analysis_case ON fir_analysis_findings(case_id);
CREATE INDEX IF NOT EXISTS idx_fir_analysis_fir ON fir_analysis_findings(fir_number);
CREATE INDEX IF NOT EXISTS idx_fir_analysis_created ON fir_analysis_findings(created_at DESC);`; await pool.query(sql); return {configured:true}; }
const mapPerson=r=>({id:r.id,fullName:r.full_name,alias:r.alias||'',age:r.age||0,dob:r.dob||'',gender:r.gender||'',occupation:r.occupation||'',status:r.status,riskAssessment:r.risk_assessment||'For Investigation Review',phoneNumbers:r.phone_numbers||[],emails:r.emails||[],knownLocations:r.known_locations||[],primaryCity:r.primary_city||'',jurisdictionArea:r.jurisdiction_area,jurisdictionCity:r.jurisdiction_city,jurisdictionDivision:r.jurisdiction_division,vehicles:r.vehicles||[],cases:r.cases||[],networkGroup:r.network_group||'Network A',tags:r.tags||[],summary:r.summary||'',criminalHistory:[],clearanceRequired:r.clearance_required,profileCreated:r.created_at,lastActive:r.updated_at});
const mapCase=r=>({id:r.id,title:r.title,category:r.category,status:r.status,openedDate:r.opened_date,investigatingOfficer:r.investigating_officer||'Unassigned',officerBadge:r.officer_badge||'',description:r.description||'',primaryJurisdiction:r.primary_jurisdiction||'',jurisdictionArea:r.jurisdiction_area,jurisdictionCity:r.jurisdiction_city,jurisdictionDivision:r.jurisdiction_division,associatedPersons:r.associated_persons||[],associatedLocations:r.associated_locations||[],evidenceCount:r.evidence_count||0,linkedTips:[],clearanceRequired:r.clearance_required,financialVolumeINR:Number(r.financial_volume_inr||0),cctnsFirNumber:r.cctns_fir_number,sourceSystem:r.source_system||'PostgreSQL'});
const mapRel=r=>({id:r.id,sourceId:r.source_id,targetId:r.target_id,sourceType:r.source_type,targetType:r.target_type,type:r.relationship_type,label:r.label||'',confidence:r.confidence||0,verificationStatus:r.verification_status||'Under Investigation',supportingRecords:[],firstObserved:r.first_observed||'',notes:r.notes||''});
const mapTxn=r=>({id:r.id,date:r.date,amount:Number(r.amount),currency:r.currency,sender:r.sender_name,senderId:r.sender_person_id,receiver:r.receiver_name,receiverId:r.receiver_person_id,category:r.category||'',flag:r.flag||'Normal',bankReference:r.bank_reference||'',channel:r.channel||''});
const officerIds=['INS-1042','SI-2087','ACP-4022','SP-5027','DCP-6033','DIG-7044'];
export async function ensureDemoData(){ if(!pool)return{seeded:false,reason:'PostgreSQL not configured'}; const d=generateDemoDataset(); await pool.query('BEGIN'); try { const demoOfficers=[['NEXUS-ADMIN-01','NEXUS Security Administrator','NEXUS-ADMIN-01','system_admin','L2_SECRET','NEXUS Security Operations','NEXUS Control Center'],['INS-1042','Insp. Vikram Deshmukh','MH-INV-1042','investigator','L1_RESTRICTED','Crime Branch Unit IV','Shivajinagar Police Station, Pune'],['SI-2087','SI Ananya Roy','MH-SI-2087','senior_investigator','L2_SECRET','Special Organized Crime Cell','Central Investigation HQ, Mumbai'],['ACP-4022','ACP Arvind Rao','MH-ACP-4022','senior_investigator','L2_SECRET','Crime Branch','Pune City Police Commissionerate'],['SP-5027','SP Neha Kulkarni','MH-SP-5027','senior_investigator','L2_SECRET','District Crime Branch','Pune District Headquarters'],['DCP-6033','DCP Sameer Patil','MH-DCP-6033','senior_investigator','L2_SECRET','Urban Crime Division','Mumbai Police Headquarters'],['DIG-7044','DIG Rohan Mehta, IPS','MH-DIG-7044','division_command','L3_TOP_SECRET','State Intelligence Directorate','Maharashtra Police Headquarters']]; for(const o of demoOfficers) await pool.query(`INSERT INTO officers(id,name,badge_number,role,clearance_level,department,station,password_hash) VALUES($1,$2,$3,$4::role_type,$5::clearance_level,$6,$7,$8) ON CONFLICT(id) DO NOTHING`,[...o,'DEMO_ONLY_DISABLED_PASSWORD']); for(const p of d.persons) await pool.query(`INSERT INTO persons(id,full_name,alias,age,dob,gender,occupation,status,risk_assessment,primary_city,network_group,summary,clearance_required) VALUES($1,$2,$3,$4,$5,$6,$7,$8::person_status,$9,$10,$11,$12,$13::clearance_level) ON CONFLICT(id) DO NOTHING`,[p.id,p.fullName,p.alias,p.age,p.dob,p.gender,p.occupation,p.status,p.riskAssessment,p.primaryCity,p.networkGroup,p.summary,p.clearanceRequired]); for(const c of d.cases){await pool.query(`INSERT INTO cases(id,title,category,status,opened_date,investigating_officer_id,description,primary_jurisdiction,clearance_required,financial_volume_inr) VALUES($1,$2,$3,$4::case_status,$5,$6,$7,$8,$9::clearance_level,$10) ON CONFLICT(id) DO NOTHING`,[c.id,c.title,c.category,c.status,c.openedDate,officerIds[d.cases.indexOf(c)%officerIds.length],c.description,c.primaryJurisdiction,c.clearanceRequired,c.financialVolumeINR]); for(const pid of c.associatedPersons) await pool.query(`INSERT INTO case_persons(case_id,person_id,role_in_case) VALUES($1,$2,'Subject') ON CONFLICT DO NOTHING`,[c.id,pid]);} for(const r of d.relationships) await pool.query(`INSERT INTO relationships(id,source_id,target_id,source_type,target_type,relationship_type,label,confidence,verification_status,notes,first_observed) VALUES($1,$2,$3,$4,$5,$6::relationship_type,$7,$8,$9,$10,$11) ON CONFLICT(id) DO NOTHING`,[r.id,r.sourceId,r.targetId,r.sourceType,r.targetType,r.relationshipType,r.label,r.confidence,r.verificationStatus,r.notes,r.firstObserved]); for(const t of d.transactions) await pool.query(`INSERT INTO transactions(id,date,amount,currency,sender_name,sender_person_id,receiver_name,receiver_person_id,category,flag,bank_reference,channel) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(id) DO NOTHING`,[t.id,t.date,t.amount,t.currency,t.sender,t.senderId,t.receiver,t.receiverId,t.category,t.flag,t.bankReference,t.channel]); await pool.query('COMMIT'); return{seeded:true,persons:d.persons.length,cases:d.cases.length,relationships:d.relationships.length,transactions:d.transactions.length}; }catch(e){await pool.query('ROLLBACK');throw e;} }
export async function getAllData(){
  if(!pool) return generateDemoDataset();
  await ensureFIRSchema();
  const [p,c,r,t,f,a]=await Promise.all([
    pool.query(`SELECT p.*,ARRAY(SELECT pp.phone_number FROM person_phone_numbers pp WHERE pp.person_id=p.id) phone_numbers,ARRAY(SELECT pe.email FROM person_emails pe WHERE pe.person_id=p.id) emails,ARRAY(SELECT pv.vehicle_plate FROM person_vehicles pv WHERE pv.person_id=p.id) vehicles,ARRAY(SELECT cp.case_id FROM case_persons cp WHERE cp.person_id=p.id) cases,ARRAY[p.primary_city] known_locations FROM persons p ORDER BY p.id`),
    pool.query(`SELECT c.*,o.name investigating_officer,o.badge_number officer_badge,ARRAY(SELECT cp.person_id FROM case_persons cp WHERE cp.case_id=c.id) associated_persons,ARRAY[]::text[] associated_locations,0 evidence_count,CASE WHEN c.id LIKE 'CASE-CCTNS-%' THEN 'CCTNS' ELSE 'PostgreSQL' END source_system FROM cases c LEFT JOIN officers o ON o.id=c.investigating_officer_id ORDER BY c.id`),
    pool.query(`SELECT * FROM relationships ORDER BY id`),
    pool.query(`SELECT * FROM transactions ORDER BY id LIMIT 5000`),
    pool.query(`SELECT id,fir_number,source_system,police_station,district,state,incident_date,sections,narrative,complainant_name,payload_hash,received_at,ingested_by FROM firs ORDER BY received_at DESC`),
      pool.query(`SELECT id,case_id,fir_number,finding_type,title,description,confidence,supporting_records,involved_entities,recommended_action,reasoning,created_at FROM fir_analysis_findings ORDER BY created_at DESC LIMIT 5000`)
  ]);
  return {
    persons:p.rows.map(mapPerson),
    cases:c.rows.map(mapCase),
    relationships:r.rows.map(mapRel),
    transactions:t.rows.map(mapTxn),
    firs:f.rows.map(r=>({id:r.id,firNumber:r.fir_number,sourceSystem:r.source_system,policeStation:r.police_station,district:r.district,state:r.state,incidentDate:r.incident_date,sections:r.sections||[],narrative:r.narrative||'',complainantName:r.complainant_name||'',payloadHash:r.payload_hash,receivedAt:r.received_at,ingestedBy:r.ingested_by})),
      aiFindings:a.rows.map(r=>({
        id:r.id,
        caseId:r.case_id,
        firNumber:r.fir_number,
        findingType:r.finding_type,
        title:r.title,
        description:r.description,
        confidence:r.confidence,
        supportingRecords:r.supporting_records||[],
        involvedEntities:r.involved_entities||[],
        recommendedAction:r.recommended_action||'',
        reasoning:r.reasoning||'',
        createdAt:r.created_at
      })),
    tips:[]
  };
}
async function analyzeFIRTransaction(client, fir, caseId) {
  const corpus = [
    fir.complainantName,
    fir.narrative,
    ...(Array.isArray(fir.sections) ? fir.sections : []),
    fir.policeStation,
    fir.district,
    fir.state
  ].filter(Boolean).join(" ").toLowerCase();

  const normalize = value =>
    String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9@._+\-\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const corpusNormalized = normalize(corpus);

  const personsResult = await client.query(
    "SELECT p.id,p.full_name,p.alias,p.primary_city,p.occupation,p.risk_assessment," +
    "ARRAY(SELECT pp.phone_number FROM person_phone_numbers pp WHERE pp.person_id=p.id) AS phone_numbers," +
    "ARRAY(SELECT pe.email FROM person_emails pe WHERE pe.person_id=p.id) AS emails," +
    "ARRAY(SELECT pv.vehicle_plate FROM person_vehicles pv WHERE pv.person_id=p.id) AS vehicles," +
    "ARRAY(SELECT cp.case_id FROM case_persons cp WHERE cp.person_id=p.id) AS cases " +
    "FROM persons p"
  );

  const matches = [];

  for (const person of personsResult.rows) {
    const evidence = [];
    let score = 0;

    const fullName = normalize(person.full_name);
    const alias = normalize(person.alias);

    if (fullName && corpusNormalized.includes(fullName)) {
      evidence.push({
        type: "name_match",
        value: person.full_name,
        weight: 95
      });
      score = Math.max(score, 95);
    }

    if (alias && alias.length >= 3 && corpusNormalized.includes(alias)) {
      evidence.push({
        type: "alias_match",
        value: person.alias,
        weight: 90
      });
      score = Math.max(score, 90);
    }

    for (const phone of person.phone_numbers || []) {
      const normalizedPhone = normalize(phone);

      if (normalizedPhone && corpusNormalized.includes(normalizedPhone)) {
        evidence.push({
          type: "phone_match",
          value: phone,
          weight: 100
        });
        score = Math.max(score, 100);
      }
    }

    for (const email of person.emails || []) {
      const normalizedEmail = normalize(email);

      if (normalizedEmail && corpusNormalized.includes(normalizedEmail)) {
        evidence.push({
          type: "email_match",
          value: email,
          weight: 100
        });
        score = Math.max(score, 100);
      }
    }

    for (const vehicle of person.vehicles || []) {
      const normalizedVehicle = normalize(vehicle);

      if (normalizedVehicle && corpusNormalized.includes(normalizedVehicle)) {
        evidence.push({
          type: "vehicle_match",
          value: vehicle,
          weight: 92
        });
        score = Math.max(score, 92);
      }
    }

    const primaryCity = normalize(person.primary_city);

    if (primaryCity && corpusNormalized.includes(primaryCity)) {
      evidence.push({
        type: "location_match",
        value: person.primary_city,
        weight: 35
      });
    }

    if (score >= 70) {
      matches.push({
        person,
        score,
        evidence
      });
    }
  }

  const linkedPersons = [];
  const findings = [];
  const relationshipsCreated = [];

  for (const match of matches) {
    await client.query(
      "INSERT INTO case_persons(case_id,person_id,role_in_case) VALUES($1,$2,'FIR Mention / Subject') ON CONFLICT(case_id,person_id) DO NOTHING",
      [caseId, match.person.id]
    );

    linkedPersons.push({
      id: match.person.id,
      name: match.person.full_name,
      confidence: match.score,
      evidence: match.evidence
    });

    const strongEvidence = match.evidence.filter(e =>
      ["name_match","alias_match","phone_match","email_match","vehicle_match"].includes(e.type)
    );

    if (!strongEvidence.length) continue;

    const findingId =
      "FINDING-" +
      caseId.replace(/[^A-Z0-9]/gi, "") +
      "-" +
      match.person.id.replace(/[^A-Z0-9]/gi, "");

    await client.query(
      "INSERT INTO fir_analysis_findings(" +
      "id,case_id,fir_number,finding_type,title,description,confidence," +
      "supporting_records,involved_entities,recommended_action,reasoning) " +
      "VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11) " +
      "ON CONFLICT(id) DO NOTHING",
      [
        findingId,
        caseId,
        fir.firNumber,
        "ENTITY_MATCH",
        "Known NEXUS Entity Matched to FIR",
        "The FIR contains identifiers matching " + match.person.full_name + ".",
        match.score,
        JSON.stringify(match.evidence),
        JSON.stringify([{
          id: match.person.id,
          type: "person",
          name: match.person.full_name,
          alias: match.person.alias || ""
        }]),
        "Review the matched person profile, prior cases, and associated relationships.",
        "Deterministic correlation matched FIR text against authorized NEXUS records using identity evidence. Highest evidence score: " + match.score + "."
      ]
    );

    findings.push({
      type: "ENTITY_MATCH",
      id: findingId,
      title: "Known NEXUS Entity Matched to FIR",
      confidence: match.score,
      personId: match.person.id
    });
  }

  const strongMatches = matches.filter(m =>
    m.evidence.some(e =>
      ["name_match","alias_match","phone_match","email_match","vehicle_match"].includes(e.type)
    )
  );

  for (let i = 0; i < strongMatches.length; i++) {
    for (let j = i + 1; j < strongMatches.length; j++) {
      const a = strongMatches[i];
      const b = strongMatches[j];

      const sourceId = String(a.person.id);
      const targetId = String(b.person.id);

      const existing = await client.query(
        "SELECT id FROM relationships WHERE " +
        "(source_id=$1 AND target_id=$2) OR " +
        "(source_id=$2 AND target_id=$1) LIMIT 1",
        [sourceId, targetId]
      );

      let relationshipId;

      if (!existing.rowCount) {
        relationshipId =
          "REL-FIR-" +
          crypto
            .createHash("sha256")
            .update(caseId + ":" + [sourceId,targetId].sort().join(":"))
            .digest("hex")
            .slice(0,24)
            .toUpperCase();

        await client.query(
          "INSERT INTO relationships(" +
          "id,source_id,target_id,source_type,target_type,relationship_type," +
          "label,confidence,verification_status,notes,first_observed) " +
          "VALUES($1,$2,$3,'person','person','Case Association',$4,$5,$6,$7,$8) " +
          "ON CONFLICT(id) DO NOTHING",
          [
            relationshipId,
            sourceId,
            targetId,
            "FIR " + fir.firNumber + " - reported co-occurrence",
            Math.min(a.score,b.score),
            "Under Investigation",
            "Generated from explicit entity co-occurrence within one FIR. This is an investigative lead, not a confirmed criminal association.",
            fir.incidentDate
          ]
        );

        relationshipsCreated.push({
          id: relationshipId,
          sourceId,
          targetId,
          confidence: Math.min(a.score,b.score)
        });
      } else {
        relationshipId = existing.rows[0].id;
      }

      const pairFindingId =
        "FINDING-PAIR-" +
        crypto
          .createHash("sha256")
          .update(caseId + ":" + [sourceId,targetId].sort().join(":"))
          .digest("hex")
          .slice(0,24)
          .toUpperCase();

      await client.query(
        "INSERT INTO fir_analysis_findings(" +
        "id,case_id,fir_number,finding_type,title,description,confidence," +
        "supporting_records,involved_entities,recommended_action,reasoning) " +
        "VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11) " +
        "ON CONFLICT(id) DO NOTHING",
        [
          pairFindingId,
          caseId,
          fir.firNumber,
          "GRAPH_CORRELATION",
          "FIR Entity Co-occurrence Detected",
          a.person.full_name + " and " + b.person.full_name +
            " are both explicitly matched in the same FIR.",
          Math.min(a.score,b.score),
          JSON.stringify([
            {type:"case",id:caseId},
            {type:"fir",firNumber:fir.firNumber},
            {type:"relationship",id:relationshipId}
          ]),
          JSON.stringify([
            {id:sourceId,type:"person",name:a.person.full_name},
            {id:targetId,type:"person",name:b.person.full_name}
          ]),
          "Review the two profiles, prior cases, communications, financial links, and shared vehicles/locations.",
          "The graph edge denotes reported FIR co-occurrence and remains under investigation; no criminal relationship is inferred solely from co-occurrence."
        ]
      );

      findings.push({
        type:"GRAPH_CORRELATION",
        id:pairFindingId,
        title:"FIR Entity Co-occurrence Detected",
        confidence:Math.min(a.score,b.score),
        relationshipId
      });
    }
  }

  for (const match of strongMatches) {
    const previousCases = await client.query(
      "SELECT c.id,c.title,c.category,c.opened_date " +
      "FROM cases c JOIN case_persons cp ON cp.case_id=c.id " +
      "WHERE cp.person_id=$1 AND c.id<>$2 " +
      "ORDER BY c.opened_date DESC LIMIT 20",
      [match.person.id,caseId]
    );

    if (!previousCases.rowCount) continue;

    const findingId =
      "FINDING-XCASE-" +
      crypto
        .createHash("sha256")
        .update(caseId + ":" + match.person.id)
        .digest("hex")
        .slice(0,24)
        .toUpperCase();

    await client.query(
      "INSERT INTO fir_analysis_findings(" +
      "id,case_id,fir_number,finding_type,title,description,confidence," +
      "supporting_records,involved_entities,recommended_action,reasoning) " +
      "VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11) " +
      "ON CONFLICT(id) DO NOTHING",
      [
        findingId,
        caseId,
        fir.firNumber,
        "CROSS_CASE_CORRELATION",
        "Entity Appears in Previous NEXUS Cases",
        match.person.full_name +
          " is already associated with " +
          previousCases.rowCount +
          " previous case record(s).",
        Math.min(98,match.score),
        JSON.stringify(previousCases.rows),
        JSON.stringify([{
          id:match.person.id,
          type:"person",
          name:match.person.full_name
        }]),
        "Review the previous cases for recurring patterns, locations, associates, and evidence.",
        "The same authorized person entity was matched to this FIR and is already linked to prior case records in NEXUS."
      ]
    );

    findings.push({
      type:"CROSS_CASE_CORRELATION",
      id:findingId,
      title:"Entity Appears in Previous NEXUS Cases",
      confidence:Math.min(98,match.score),
      personId:match.person.id,
      previousCaseCount:previousCases.rowCount
    });
  }

  return {
    matchedPersons: linkedPersons,
    findings,
    relationshipsCreated
  };
}
export async function createFIR(input,officerId,{sourceSystem='CCTNS'}={}){
  const adapter=new CCTNSAdapter();
  const fir=adapter.normalizeFIR({...input,sourceSystem});
  const validationErrors=adapter.validateFIR(fir);
  if(validationErrors.length) throw new Error(validationErrors.join(' '));
  if(!pool) throw new Error('PostgreSQL is unavailable. FIR ingestion is fail-closed and no record was accepted.');

  await ensureFIRSchema();
  const source=String(sourceSystem||'CCTNS').trim().toUpperCase();
  const caseId=`CASE-${source}-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    // Serialize concurrent submissions for the same source/FIR number.
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',[`${source}:${fir.firNumber}`]);
    await client.query('SELECT pg_advisory_xact_lock(9223372036854775000)');
    const existing=await client.query(`SELECT id,payload_hash FROM firs WHERE source_system=$1 AND fir_number=$2`,[source,fir.firNumber]);
    if(existing.rowCount){
      await client.query('ROLLBACK');
      return {fir,caseId:existing.rows[0].id,persisted:true,duplicate:true,created:false,rawHash:existing.rows[0].payload_hash,message:'FIR already exists in PostgreSQL.'};
    }

    await client.query(`INSERT INTO firs(id,fir_number,source_system,police_station,district,state,incident_date,sections,narrative,complainant_name,payload_hash,received_at,ingested_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),$12)`,
      [caseId,fir.firNumber,source,fir.policeStation,fir.district,fir.state,fir.incidentDate,fir.sections,fir.narrative,fir.complainantName,fir.payloadHash,officerId]);

    const jurisdiction=[fir.policeStation,fir.district,fir.state].filter(Boolean).join(', ');
    await client.query(`INSERT INTO cases(id,title,category,status,opened_date,investigating_officer_id,description,primary_jurisdiction,clearance_required,jurisdiction_area,jurisdiction_city,jurisdiction_division,cctns_fir_number,source_system)
      VALUES($1,$2,$3,'Active',$4,$5,$6,$7,'L1_RESTRICTED',$8,$9,$10,$11,$12)`,
      [caseId,`${source} FIR ${fir.firNumber}`,`${source} FIR`,fir.incidentDate,officerId,fir.narrative,jurisdiction,fir.policeStation,fir.district,`${fir.district} Division`,fir.firNumber,source]);    await client.query(`INSERT INTO audit_logs(block_index,action_id,officer_id,officer_name,action,resource,details,previous_hash,current_hash)
      SELECT
        COALESCE(MAX(block_index),0)+1,
        'ACTION-' || (10000 + COALESCE(MAX(block_index),0)+1),
        CAST($1 AS VARCHAR),
        CAST($2 AS VARCHAR),
        'FIR Ingested',
        CAST($3 AS VARCHAR),
        CAST($4 AS TEXT),
        COALESCE(
          (SELECT current_hash
           FROM audit_logs
           ORDER BY block_index DESC
           LIMIT 1),
          '0x00000000000000000000000000000000GENESIS'
        ),
        encode(
          digest(
            (COALESCE(MAX(block_index),0)+1)::text
            || ':FIR Ingested:'
            || CAST($1 AS TEXT)
            || ':'
            || CAST($4 AS TEXT)
            || ':'
            || COALESCE(
                 (SELECT current_hash
                  FROM audit_logs
                  ORDER BY block_index DESC
                  LIMIT 1),
                 '0x00000000000000000000000000000000GENESIS'
               ),
            'sha256'
          ),
          'hex'
        )
      FROM audit_logs`,
      [officerId,officerId,`FIR:${caseId}`,`Accepted ${source} FIR ${fir.firNumber}; payload SHA-256 ${fir.payloadHash}`]);

    const analysis = await analyzeFIRTransaction(client, fir, caseId);


    await client.query('COMMIT');
      return {fir,caseId,persisted:true,duplicate:false,created:true,rawHash:fir.payloadHash,analysis,message:'FIR accepted, persisted, analyzed, graph-correlated, and audit logged.'};
  } catch(e) {
    try{ await client.query('ROLLBACK'); }catch{}
    if(e?.code==='23505') {
      const race=await pool.query(`SELECT id,payload_hash FROM firs WHERE source_system=$1 AND fir_number=$2`,[source,fir.firNumber]);
      if(race.rowCount) return {fir,caseId:race.rows[0].id,persisted:true,duplicate:true,created:false,rawHash:race.rows[0].payload_hash,message:'FIR already exists in PostgreSQL.'};
    }
    throw e;
  } finally { client.release(); }
}

export async function ingestCCTNSSync(records,officerId){
  const results=[];
  for(const record of records){
    try { results.push(await createFIR(record,officerId,{sourceSystem:'CCTNS'})); }
    catch(error){ results.push({created:false,persisted:false,firNumber:String(record?.firNumber||''),error:error.message}); }
  }
  return {received:records.length,accepted:results.filter(r=>r.created).length,duplicates:results.filter(r=>r.duplicate).length,failed:results.filter(r=>r.error).length,results};
}

export async function health(){return{...dbState(),timestamp:new Date().toISOString()};}




