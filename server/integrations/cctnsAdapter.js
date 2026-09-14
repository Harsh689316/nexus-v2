import crypto from 'node:crypto';

/**
 * Authorized CCTNS/ICJS integration boundary.
 * External data is treated as untrusted until normalized and validated.
 */
export class CCTNSAdapter {
  constructor({baseUrl=process.env.CCTNS_BASE_URL,apiKey=process.env.CCTNS_API_KEY}={}) {
    this.baseUrl=baseUrl;
    this.apiKey=apiKey;
  }
  isConfigured(){ return Boolean(this.baseUrl && this.apiKey); }

  normalizeFIR(input={}) {
    const sections = Array.isArray(input.sections)
      ? input.sections
      : String(input.sections||'').split(',').map(s=>s.trim()).filter(Boolean);
    const firNumber=String(input.firNumber||'').trim().replace(/\s+/g,' ');
    const policeStation=String(input.policeStation||'').trim().replace(/\s+/g,' ');
    const district=String(input.district||'').trim().replace(/\s+/g,' ');
    const state=String(input.state||'Maharashtra').trim().replace(/\s+/g,' ');
    const incidentDate=String(input.incidentDate||'').trim();
    const narrative=String(input.narrative||'').trim();
    const complainantName=String(input.complainantName||'').trim();
    const entities=Array.isArray(input.entities)?input.entities:[];
    const sourceSystem=String(input.sourceSystem||'CCTNS').trim().toUpperCase() || 'CCTNS';
    const normalized={sourceSystem,firNumber,policeStation,district,state,incidentDate,sections:[...new Set(sections.map(s=>String(s).trim()).filter(Boolean))],narrative,complainantName,entities};
    const canonical=JSON.stringify(normalized);
    return {...normalized,receivedAt:new Date().toISOString(),payloadHash:crypto.createHash('sha256').update(canonical).digest('hex')};
  }

  validateFIR(fir) {
    const errors=[];
    if(!/^.{3,128}$/.test(fir.firNumber)) errors.push('FIR number must contain 3–128 characters.');
    if(!/^.{2,128}$/.test(fir.policeStation)) errors.push('Police station is required.');
    if(!/^.{2,128}$/.test(fir.district)) errors.push('District is required.');
    if(!/^.{2,128}$/.test(fir.state)) errors.push('State is required.');
    if(!this.isValidISODate(fir.incidentDate)) errors.push('Incident date must be a valid YYYY-MM-DD date.');
    if(!fir.narrative || fir.narrative.length<10) errors.push('FIR narrative must contain at least 10 characters.');
    if(fir.narrative.length>100000) errors.push('FIR narrative exceeds the 100,000 character limit.');
    if(fir.sections.length>100) errors.push('Too many legal sections supplied.');
    return errors;
  }

  isValidISODate(value) {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||''))) return false;
    const [y,m,d]=String(value).split('-').map(Number);
    const date=new Date(Date.UTC(y,m-1,d));
    return date.getUTCFullYear()===y && date.getUTCMonth()===m-1 && date.getUTCDate()===d;
  }

  async pullLatestFIRs(){
    if(!this.isConfigured()) return {configured:false,records:[]};
    const r=await fetch(`${this.baseUrl.replace(/\/$/,'')}/firs/latest`,{headers:{Authorization:`Bearer ${this.apiKey}`,Accept:'application/json'},signal:AbortSignal.timeout(8000)});
    if(!r.ok) throw new Error(`CCTNS adapter returned HTTP ${r.status}`);
    const records=await r.json();
    if(!Array.isArray(records)) throw new Error('CCTNS adapter returned an invalid FIR collection.');
    return {configured:true,records};
  }
}
