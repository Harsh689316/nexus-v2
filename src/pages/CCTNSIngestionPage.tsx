import React, { useEffect, useState } from 'react';
import { DatabaseZap, ShieldCheck, RefreshCw, UploadCloud, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dataSourceService } from '../services/dataSourceService';

export const CCTNSIngestionPage: React.FC = () => {
  const { hasClearance } = useAuth();
  const token = sessionStorage.getItem('nexus_auth_session') || '';
  const [status,setStatus]=useState<any>(null);
  const [firs,setFirs]=useState<any[]>([]);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [form,setForm]=useState({firNumber:'',policeStation:'',district:'Pune',state:'Maharashtra',incidentDate:new Date().toISOString().slice(0,10),sections:'',complainantName:'',narrative:''});

  const load=async()=>{
    const headers={Authorization:`Bearer ${token}`};
    const statusResponse=await fetch('/api/cctns/status',{headers});
    if(statusResponse.ok) setStatus(await statusResponse.json());
    const dataResponse=await fetch('/api/data/all',{headers});
    if(dataResponse.ok){ const data=await dataResponse.json(); setFirs(Array.isArray(data.firs)?data.firs:[]); }
  };

  useEffect(()=>{
    load();
    const controller=new AbortController();
    let buffer='';
    const connect=async()=>{
      try{
        const response=await fetch('/api/cctns/stream',{headers:{Authorization:`Bearer ${token}`},signal:controller.signal});
        if(!response.ok || !response.body) return;
        const reader=response.body.getReader();
        const decoder=new TextDecoder();
        while(true){
          const {value,done}=await reader.read();
          if(done) break;
          buffer+=decoder.decode(value,{stream:true});
          const events=buffer.split('\n\n'); buffer=events.pop()||'';
          for(const event of events){
            if(event.includes('event: fir')){
              const line=event.split('\n').find(x=>x.startsWith('data: '));
              if(line){
                const payload=JSON.parse(line.slice(6));
                setFirs(prev=>[payload.fir,...prev.filter(x=>x.id!==payload.fir.id)].slice(0,100));

                // Refresh PostgreSQL-backed investigation data immediately.
                await dataSourceService.hydrateFromApi(token);
                setMessage(`LIVE: FIR ${payload.fir.firNumber} ingested â€¢ Case ${payload.caseId}`);
              }
            }
          }
        }
      }catch(err){ if((err as Error)?.name!=='AbortError') console.warn('FIR live stream disconnected'); }
    };
    connect();
    return ()=>controller.abort();
  },[token]);

  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try{
      const result=await dataSourceService.ingestCCTNSFIR(token,{...form,sections:form.sections.split(',').map(s=>s.trim()).filter(Boolean)});
      setMessage(`${result.duplicate?'FIR already existed':'FIR accepted'}: ${result.fir?.firNumber || 'record'} â€¢ Case ${result.caseId} â€¢ PostgreSQL transaction committed`);
      setForm({...form,firNumber:'',narrative:''});
      await load();
    }catch(err){setMessage(err instanceof Error?err.message:'FIR ingestion failed.');}
    finally{setBusy(false);}
  };

  const sync=async()=>{
    setBusy(true); setMessage('');
    try{const r=await fetch('/api/cctns/sync',{method:'POST',headers:{Authorization:`Bearer ${token}`}});const d=await r.json();if(!r.ok)throw new Error(d.error);setMessage(`CCTNS sync completed: ${d.received ?? 0} received â€¢ ${d.accepted ?? 0} created â€¢ ${d.duplicates ?? 0} duplicates â€¢ ${d.failed ?? 0} failed.`);await load();}
    catch(err){setMessage(err instanceof Error?err.message:'CCTNS sync failed.');}
    finally{setBusy(false);}
  };

  return <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-6">
    <div className="flex items-center justify-between gap-4"><div><div className="flex items-center gap-2"><DatabaseZap className="w-5 h-5 text-[#37ff85]"/><h1 className="text-xl lg:text-2xl font-black text-[var(--text-primary)]">CCTNS / e-FIR Ingestion</h1></div><p className="text-xs text-[var(--text-secondary)] mt-1">Transactional FIR intake with validation, duplicate protection, SHA-256 integrity proof, audit logging, and live updates.</p></div><button onClick={sync} disabled={busy || !status?.configured} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0b1b11] text-white text-xs font-semibold disabled:opacity-40"><RefreshCw className={`w-3.5 h-3.5 ${busy?'animate-spin':''}`}/> Sync latest</button></div>
    <div className="grid md:grid-cols-3 gap-4"><div className="p-4 rounded-xl border bg-[var(--bg-card)]"><div className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Connector</div><div className="font-bold text-sm mt-1">CCTNS / ICJS adapter</div><div className="text-xs mt-2">{status?.configured?'Authorized CCTNS connector configured':'Manual authorized intake â€” PostgreSQL required'}</div></div><div className="p-4 rounded-xl border bg-[var(--bg-card)]"><div className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Evidence integrity</div><div className="font-bold text-sm mt-1">SHA-256 payload proof</div><div className="text-xs mt-2">Every accepted FIR receives a SHA-256 payload proof and audit event.</div></div><div className="p-4 rounded-xl border bg-[var(--bg-card)]"><div className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Authorization</div><div className="font-bold text-sm mt-1">Clearance-gated</div><div className="text-xs mt-2 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-[#37ff85]"/> Server-side session + jurisdiction filter</div></div></div>
    {message && <div className="p-3 rounded-xl border text-xs flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#37ff85]"/>{message}</div>}
    <form onSubmit={submit} className="p-5 rounded-xl border bg-[var(--bg-card)] space-y-4"><div className="flex items-center gap-2"><UploadCloud className="w-4 h-4"/><h2 className="font-bold text-sm">Add latest FIR</h2></div><div className="grid md:grid-cols-2 gap-3">{[['firNumber','FIR number'],['policeStation','Police station'],['district','District'],['state','State'],['incidentDate','Incident date'],['sections','Sections (comma separated)'],['complainantName','Complainant name']].map(([key,label])=><label key={key} className="text-xs font-semibold text-[var(--text-secondary)]">{label}<input value={(form as any)[key]} onChange={e=>setForm({...form,[key]:e.target.value})} className="mt-1 w-full rounded-lg border bg-transparent px-3 py-2 text-sm font-normal" required={key==='firNumber'||key==='policeStation'}/></label>)}</div><label className="text-xs font-semibold text-[var(--text-secondary)]">FIR narrative<textarea value={form.narrative} onChange={e=>setForm({...form,narrative:e.target.value})} required className="mt-1 w-full rounded-lg border bg-transparent px-3 py-2 text-sm font-normal min-h-32" placeholder="Paste the authorized FIR narrative or normalized CCTNS payload textâ€¦"/></label><div className="flex items-center justify-between gap-3"><div className="text-[10px] text-[var(--text-muted)] flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Automated findings are investigative leads and require human verification.</div><button disabled={busy || !hasClearance('L1_RESTRICTED')} className="px-4 py-2 rounded-lg bg-[#0b1b11] text-white text-xs font-bold disabled:opacity-40">{busy?'Ingestingâ€¦':'Ingest FIR'}</button></div></form>
    <section className="p-5 rounded-xl border bg-[var(--bg-card)] space-y-3"><div className="flex items-center justify-between"><div><h2 className="font-bold text-sm">Recently ingested FIRs</h2><p className="text-[10px] text-[var(--text-muted)]">Records returned directly from PostgreSQL.</p></div><span className="text-xs font-bold">{firs.length}</span></div>{firs.length===0?<div className="text-xs text-[var(--text-muted)]">No FIR records found.</div>:<div className="space-y-2">{firs.slice(0,10).map(f=><div key={f.id} className="p-3 rounded-lg border text-xs grid md:grid-cols-4 gap-2"><div><div className="text-[10px] text-[var(--text-muted)]">FIR</div><div className="font-bold">{f.firNumber}</div></div><div><div className="text-[10px] text-[var(--text-muted)]">Station</div><div>{f.policeStation||'â€”'}</div></div><div><div className="text-[10px] text-[var(--text-muted)]">Incident</div><div>{String(f.incidentDate||'').slice(0,10)||'â€”'}</div></div><div><div className="text-[10px] text-[var(--text-muted)]">Hash</div><div className="font-mono truncate" title={f.payloadHash}>{f.payloadHash||'â€”'}</div></div></div>)}</div>}</section>
  </div>;
};

