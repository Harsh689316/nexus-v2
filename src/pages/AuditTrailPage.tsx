import React, { useState } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle, 
  Link2, 
  Search, 
  Filter, 
  Lock, 
  Activity,
  Zap,
  Info
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { dataSourceService } from '../services/dataSourceService';
import { AuditRecord } from '../types';

export const AuditTrailPage: React.FC = () => {
  const { theme } = useTheme();
  const [records, setRecords] = useState<AuditRecord[]>(dataSourceService.getAuditTrail());
  const [verificationResult, setVerificationResult] = useState<{
    verified: boolean;
    validCount: number;
    failedIndex: number | null;
    message: string;
  }>(() => dataSourceService.verifyAuditIntegrity());

  const [searchTerm, setSearchTerm] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Handle Verify Integrity
  const handleVerify = () => {
    setIsVerifying(true);
    setTimeout(() => {
      const res = dataSourceService.verifyAuditIntegrity();
      setVerificationResult(res);
      setRecords([...dataSourceService.getAuditTrail()]);
      setIsVerifying(false);
    }, 350);
  };


  // Handle Reset Chain
  const handleResetChain = () => {
    dataSourceService.resetAuditChain();
    setRecords([...dataSourceService.getAuditTrail()]);
    const res = dataSourceService.verifyAuditIntegrity();
    setVerificationResult(res);
  };

  const filteredRecords = records.filter((r) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.id.toLowerCase().includes(term) ||
      r.officerId.toLowerCase().includes(term) ||
      r.action.toLowerCase().includes(term) ||
      r.resource.toLowerCase().includes(term) ||
      r.currentHash.toLowerCase().includes(term)
    );
  });

  return (
    <div id="nexus-audit-trail-page" className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl lg:text-2xl font-black tracking-tight text-[var(--text-primary)]">
              Cryptographic Audit Trail Ledger
            </h1>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#0b1b11]/10 dark:bg-white/10 text-[var(--text-primary)]">
              {records.length} Blocks
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Blockchain-inspired sequential hash chain guaranteeing tamper-evident chain of custody
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            id="audit-verify-integrity-btn"
            onClick={handleVerify}
            disabled={isVerifying}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0b1b11] text-white hover:bg-[#10291a] dark:bg-[#0d2115] dark:text-[#D8E0E7] text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#37ff85]" />
            <span>{isVerifying ? 'Verifying Chain...' : 'Verify Cryptographic Integrity'}</span>
          </button>

          <button
            id="audit-refresh-btn"
            onClick={handleVerify}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border hover:bg-[#37ff85]/10 text-xs font-semibold text-[#37ff85] transition-colors cursor-pointer"
            style={{ borderColor: 'var(--border-main)' }}
            title="Refresh and verify the current audit chain"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Refresh Verification</span>
          </button>

          <button
            id="audit-reset-chain-btn"
            onClick={handleResetChain}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border hover:bg-black/5 dark:hover:bg-white/5 text-xs font-semibold text-[var(--text-secondary)] transition-colors cursor-pointer"
            style={{ borderColor: 'var(--border-main)' }}
            title="Reset hash chain back to pristine verified state"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Chain</span>
          </button>
        </div>
      </div>

      {/* Verification Status Banner (Section 27) */}
      <div 
        className={`rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
          verificationResult.verified
            ? 'border-[#37ff85]/40 bg-[#37ff85]/10 dark:bg-[#37ff85]/15'
            : 'border-[#C62828]/40 bg-[#C62828]/10 dark:bg-[#C62828]/15'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            verificationResult.verified 
              ? 'bg-[#37ff85] text-white' 
              : 'bg-[#C62828] text-white'
          }`}>
            {verificationResult.verified ? (
              <CheckCircle2 className="w-6 h-6" />
            ) : (
              <ShieldAlert className="w-6 h-6" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-black uppercase tracking-wider ${
                verificationResult.verified ? 'text-[#37ff85] dark:text-[#37ff85]' : 'text-[#C62828] dark:text-[#D86C6C]'
              }`}>
                {verificationResult.verified ? 'Chain Integrity: 100% VALID' : 'CRITICAL INTEGRITY VIOLATION DETECTED'}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold text-[var(--text-primary)]">
                SHA-256 INTEGRITY CHECK
              </span>
            </div>
            <p className="text-xs text-[var(--text-primary)] mt-0.5">
              {verificationResult.message}
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-xs font-mono font-bold text-[var(--text-primary)]">
            {verificationResult.validCount} of {records.length} Valid
          </div>
          <div className="text-[10px] text-[var(--text-muted)]">
            Immutable Proof of Custody
          </div>
        </div>
      </div>

      {/* Search Filter */}
      <div 
        className="rounded-xl border p-3 flex items-center justify-between gap-3"
        style={{
          backgroundColor: theme === 'dark' ? 'var(--bg-card)' : '#FFFFFF',
          borderColor: 'var(--border-main)',
        }}
      >
        <div 
          className="relative flex-1 flex items-center rounded-lg border max-w-md"
          style={{
            backgroundColor: theme === 'dark' ? 'var(--bg-main)' : 'var(--bg-card-elevated)',
            borderColor: 'var(--border-main)',
          }}
        >
          <Search className="w-3.5 h-3.5 ml-3 text-[var(--text-secondary)] shrink-0" />
          <input
            id="audit-search-input"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by action, officer ID, resource or hash..."
            className="w-full px-3 py-1.5 text-xs bg-transparent outline-none text-[var(--text-primary)]"
          />
        </div>

        <div className="text-xs text-[var(--text-muted)]">
          Showing {filteredRecords.length} records
        </div>
      </div>

      {/* Audit Blocks Table */}
      <div 
        className="rounded-2xl border overflow-hidden shadow-xs"
        style={{
          backgroundColor: theme === 'dark' ? 'var(--bg-card)' : '#FFFFFF',
          borderColor: 'var(--border-main)',
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead 
              className="border-b uppercase font-bold text-[10px] text-[var(--text-muted)] tracking-wider"
              style={{
                backgroundColor: theme === 'dark' ? 'var(--bg-card-elevated)' : 'var(--bg-card-elevated)',
                borderColor: 'var(--border-main)',
              }}
            >
              <tr>
                <th className="py-3 px-4">Index</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Officer ID</th>
                <th className="py-3 px-4">Action Event</th>
                <th className="py-3 px-4">Resource Target</th>
                <th className="py-3 px-4">Previous Hash</th>
                <th className="py-3 px-4">Current Block Hash</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
              {filteredRecords.slice(0, 40).map((r) => {
                const isTamperedRow = verificationResult.failedIndex === r.blockIndex;

                return (
                  <tr 
                    key={r.id}
                    className={`hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
                      isTamperedRow ? 'bg-[#C62828]/15 dark:bg-[#C62828]/25' : ''
                    }`}
                  >
                    <td className="py-2.5 px-4 font-mono font-bold text-[var(--text-primary)]">
                      #{r.blockIndex}
                    </td>
                    <td className="py-2.5 px-4 text-[11px] text-[var(--text-secondary)] whitespace-nowrap">
                      {r.timestamp}
                    </td>
                    <td className="py-2.5 px-4 font-mono font-semibold text-[var(--text-primary)]">
                      {r.officerId}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-[var(--text-primary)]">
                      {r.action}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-[var(--text-secondary)]">
                      {r.resource}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[10px] text-[var(--text-muted)] truncate max-w-[120px]" title={r.previousHash}>
                      {r.previousHash.substring(0, 14)}...
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[10px] text-[#37ff85] dark:text-[#37ff85] truncate max-w-[140px]" title={r.currentHash}>
                      {r.currentHash.substring(0, 16)}...
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                        isTamperedRow
                          ? 'bg-[#C62828] text-white animate-pulse'
                          : 'bg-[#37ff85]/15 text-[#37ff85] dark:text-[#37ff85]'
                      }`}>
                        {isTamperedRow ? 'TAMPERED' : 'VALID'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
