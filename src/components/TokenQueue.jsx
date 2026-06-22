/**
 * TokenQueue — reusable queue display used by both dashboards.
 *
 * Props:
 *   tokens         – array of token records (already expanded with patient)
 *   onSelectToken  – (token) => void   (Doctor view)
 *   activeId       – string            (highlight selected token in Doctor view)
 *   showBillButton – bool              (Receptionist view)
 *   onGenerateBill – (tokenId) => void (Receptionist view)
 *   paidTokenIds   - Set of token IDs that have been paid (P0 7.4)
 *   unpaidTokenIds - Set of token IDs that have bills but are unpaid (P0 7.4)
 */
export default function TokenQueue({
  tokens = [],
  onSelectToken,
  activeId,
  showBillButton,
  onGenerateBill,
  paidTokenIds = new Set(),
  unpaidTokenIds = new Set()
}) {
  const statusOrder = { waiting: 0, in_progress: 1, done: 2 };
  const sorted = [...tokens].sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

  const badge = (status) => {
    const map = {
      waiting:     'badge-waiting',
      in_progress: 'badge-in_progress',
      done:        'badge-done',
    };
    const label = { waiting: 'Waiting', in_progress: 'In Progress', done: 'Done' };
    return <span className={map[status] || ''}>{label[status] || status}</span>;
  };

  return (
    <div className="card h-full flex flex-col">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-surface-100">
        <h2 className="text-base font-semibold text-slate-800">Today's Queue</h2>
        <span className="text-xs font-semibold text-slate-500 bg-surface-100 px-2 py-0.5 rounded-full">
          {tokens.length} Patient{tokens.length !== 1 ? 's' : ''}
        </span>
      </div>

      {sorted.length === 0 && (
        <p className="text-slate-400 text-sm text-center py-12 flex-1 flex items-center justify-center">
          No patients in the queue today
        </p>
      )}

      <ul className="space-y-2 overflow-y-auto max-h-[600px] flex-1 pr-1">
        {sorted.map(token => {
          const isPaid = paidTokenIds.has(token.id);
          const isUnpaid = unpaidTokenIds.has(token.id);
          const isSelected = activeId === token.id;

          return (
            <li
              key={token.id}
              onClick={() => onSelectToken?.(token)}
              className={[
                'flex items-center justify-between p-3 rounded-lg border transition-all duration-150',
                onSelectToken && token.status !== 'done' ? 'cursor-pointer hover:border-primary-400 hover:shadow-sm' : '',
                isSelected
                  ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-500/20'
                  : 'border-surface-200 bg-surface-50',
              ].join(' ')}
            >
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 text-sm font-bold flex items-center justify-center flex-shrink-0">
                  {token.token_number}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-slate-800 leading-tight">
                      {token.expand?.patient?.name ?? '—'}
                    </p>
                    {isPaid && (
                      <span className="inline-flex items-center justify-center bg-green-100 text-green-700 w-5 h-5 rounded-full text-xs font-bold shadow-sm" title="Bill Paid">
                        ₹
                      </span>
                    )}
                    {isUnpaid && (
                      <span className="inline-flex items-center justify-center bg-red-100 text-red-700 w-5 h-5 rounded-full text-xs font-bold shadow-sm" title="Bill Unpaid">
                        ₹
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {token.expand?.patient?.phone ?? ''}
                  </p>
                  {token.chief_complaint && (
                    <p className="text-[11px] text-primary-700 font-medium italic mt-0.5 bg-primary-50 px-1.5 py-0.2 rounded inline-block">
                      Complaint: {token.chief_complaint}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {badge(token.status)}
                
                {showBillButton && token.status === 'done' && !isPaid && !isUnpaid && (
                  <button
                    onClick={e => { e.stopPropagation(); onGenerateBill?.(token); }}
                    className="btn-primary text-xs py-1 px-2.5 bg-primary-600 hover:bg-primary-700"
                  >
                    Bill
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
