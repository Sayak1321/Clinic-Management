/**
 * TokenQueue — reusable queue display used by both dashboards.
 * Modernized with CSS variable tokens, status accent stripes,
 * slide-in action buttons, and empty state illustration.
 */
export default function TokenQueue({
  tokens = [],
  onSelectToken,
  activeId,
  showBillButton,
  onGenerateBill,
  paidTokenIds = new Set(),
  unpaidTokenIds = new Set(),
  doctors = [],
  onAssignDoctor
}) {
  const statusOrder = { waiting: 0, in_progress: 1, done: 2 };
  const sorted = [...tokens].sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

  const getStatusStyle = (status, isPaid, isUnpaid) => {
    if (status === 'done' && isPaid)   return { stripe: '#10b981', badge: { bg: 'rgba(16,185,129,0.1)', color: '#10b981', border: 'rgba(16,185,129,0.2)' }, label: 'Paid ✓' };
    if (status === 'done' && isUnpaid) return { stripe: '#ef4444', badge: { bg: 'rgba(239,68,68,0.1)',  color: '#f87171', border: 'rgba(239,68,68,0.2)' },  label: 'Billing' };
    if (status === 'done')             return { stripe: '#10b981', badge: { bg: 'rgba(16,185,129,0.1)', color: '#10b981', border: 'rgba(16,185,129,0.2)' }, label: 'Done' };
    if (status === 'in_progress')      return { stripe: 'var(--color-accent)', badge: { bg: 'rgba(56,189,248,0.1)', color: 'var(--color-accent)', border: 'rgba(56,189,248,0.2)' }, label: 'In Consult' };
    return { stripe: '#f59e0b', badge: { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: 'rgba(245,158,11,0.2)' }, label: 'Waiting' };
  };

  const getWaitTime = (createdAt) => {
    if (!createdAt) return '';
    const diffMins = Math.floor((new Date() - new Date(createdAt)) / 60000);
    if (diffMins < 1)  return 'Just arrived';
    if (diffMins < 60) return `${diffMins}m ago`;
    return `${Math.floor(diffMins / 60)}h ${diffMins % 60}m ago`;
  };

  return (
    <div className="flex flex-col h-full rounded-2xl shadow-lg overflow-hidden"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--color-border)', transition: 'background-color 0.3s' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div className="section-title">Today's Queue</div>
        <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full"
          style={{ backgroundColor: 'rgba(56,189,248,0.08)', color: 'var(--color-accent)', border: '1px solid rgba(56,189,248,0.15)' }}>
          {tokens.filter(t => t.status !== 'done').length} Active · {tokens.length} Total
        </span>
      </div>

      {/* Empty State */}
      {sorted.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center"
          style={{ color: 'var(--color-text-muted)' }}>
          <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24" style={{ opacity: 0.3 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          <div>
            <p className="text-xs font-semibold">Queue is empty</p>
            <p className="text-[10px] mt-1" style={{ maxWidth: '160px', lineHeight: 1.6 }}>Register a walk-in patient using the form on the left.</p>
          </div>
        </div>
      )}

      {/* Token List */}
      <ul className="flex-1 overflow-y-auto divide-y scrollbar-thin"
        style={{ borderColor: 'rgba(30,41,59,0.3)' }}>
        {sorted.map(token => {
          const isPaid   = paidTokenIds.has(token.id);
          const isUnpaid = unpaidTokenIds.has(token.id);
          const isSelected = activeId === token.id;
          const { stripe, badge, label } = getStatusStyle(token.status, isPaid, isUnpaid);
          const waitText = getWaitTime(token.created_at);
          const isDone = token.status === 'done';
          const showBill = showBillButton && isDone && !isPaid && !isUnpaid;

          return (
            <li
              key={token.id}
              onClick={() => onSelectToken?.(token)}
              className="relative group flex gap-3 px-4 py-3.5 transition-all duration-150"
              style={{
                borderLeft: `3px solid ${stripe}`,
                cursor: onSelectToken && !isDone ? 'pointer' : 'default',
                backgroundColor: isSelected ? 'rgba(56,189,248,0.04)' : 'transparent',
                opacity: isDone && !showBill ? 0.72 : 1,
              }}
              onMouseEnter={e => { if (!isDone) e.currentTarget.style.backgroundColor = 'rgba(56,189,248,0.025)'; }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              {/* Token number bubble */}
              <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-black text-sm mt-0.5"
                style={{
                  backgroundColor: isSelected ? 'rgba(56,189,248,0.15)' : 'var(--bg-canvas)',
                  border: `1px solid ${isSelected ? 'rgba(56,189,248,0.4)' : 'var(--color-border)'}`,
                  color: isSelected ? 'var(--color-accent)' : 'var(--color-text-high)'
                }}>
                {token.token_number}
              </div>

              {/* Patient info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-bold text-sm truncate" style={{ color: 'var(--color-text-high)' }}>
                    {token.expand?.patient?.name ?? '—'}
                  </p>
                  {/* Bill payment indicators */}
                  {isPaid && (
                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider"
                      style={{ backgroundColor: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
                      ₹ Paid
                    </span>
                  )}
                  {isUnpaid && (
                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider"
                      style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                      ₹ Due
                    </span>
                  )}
                </div>

                {/* Phone · wait time */}
                <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                  <span>{token.expand?.patient?.phone ?? ''}</span>
                  {waitText && (
                    <>
                      <span style={{ color: 'var(--color-border)' }}>·</span>
                      <span className="font-mono" style={{ color: 'var(--color-accent)', opacity: 0.8 }}>{waitText}</span>
                    </>
                  )}
                </div>

                {/* Chief Complaint */}
                {token.chief_complaint && (
                  <p className="text-[10px] italic mt-1 line-clamp-1" style={{ color: 'var(--color-text-muted)' }}>
                    {token.chief_complaint}
                  </p>
                )}

                {/* Assigned doctor */}
                {token.expand?.doctor?.name && (
                  <p className="text-[10px] font-semibold mt-0.5 flex items-center gap-1" style={{ color: '#10b981' }}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Dr. {token.expand.doctor.name}
                  </p>
                )}

                {/* Doctor assign dropdown — receptionist only */}
                {showBillButton && onAssignDoctor && !isDone && (
                  <div className="mt-1.5 flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                    <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Assign Dr.:</span>
                    <select
                      value={token.doctor || ''}
                      onChange={e => onAssignDoctor(token.id, e.target.value || '')}
                      className="text-[10px] rounded px-1.5 py-0.5 focus:outline-none font-medium cursor-pointer"
                      style={{ backgroundColor: 'var(--bg-canvas)', border: '1px solid var(--color-border)', color: 'var(--color-text-high)' }}
                    >
                      <option value="">Unassigned</option>
                      {doctors.map(doc => (
                        <option key={doc.id} value={doc.id}>Dr. {doc.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Right side: badge + bill button */}
              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className="text-[8px] font-bold px-2 py-0.5 rounded uppercase tracking-wider"
                  style={{ backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                  {label}
                </span>

                {/* Generate Bill button */}
                {showBill && (
                  <button
                    onClick={e => { e.stopPropagation(); onGenerateBill?.(token); }}
                    className="text-[9px] font-extrabold px-2.5 py-1 rounded-lg uppercase tracking-wider transition-all"
                    style={{ backgroundColor: 'var(--color-accent)', color: '#020617', boxShadow: '0 2px 8px rgba(56,189,248,0.3)' }}
                  >
                    Bill Now
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
