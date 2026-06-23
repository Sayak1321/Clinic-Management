import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/* ── Role cards config ──────────────────────────────────────────── */
const ROLES = [
  {
    id: 'receptionist',
    label: 'Receptionist',
    desc: 'Register walk-in patients, manage the token queue, and handle billing.',
    color: '#0f766e',
    bg: '#f0fdfa',
    border: '#99f6e4',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 28, height: 28 }}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )
  },
  {
    id: 'doctor',
    label: 'Doctor',
    desc: 'View your patient queue, write prescriptions, and manage consultations.',
    color: '#1d4ed8',
    bg: '#eff6ff',
    border: '#bfdbfe',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 28, height: 28 }}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    )
  }
];

/* ── Stepper Steps ──────────────────────────────────────────────── */
const STEPS = ['Choose Role', 'Your Details', 'Set Password'];

export default function Register() {
  const { register, getDashboardPath } = useAuth();
  const navigate = useNavigate();

  const [step, setStep]           = useState(0);
  const [role, setRole]           = useState('');
  const [name, setName]           = useState('');
  const [email, setEmail]         = useState('');
  const [phone, setPhone]         = useState('');
  const [specialization, setSpec] = useState('');
  const [password, setPassword]   = useState('');
  const [confirmPwd, setConfirm]  = useState('');
  const [showPwd, setShowPwd]     = useState(false);
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);

  const selectedRole = ROLES.find(r => r.id === role);

  /* ── Navigation ────────────────────────────────────────────── */
  const canNextStep0 = role !== '';
  const canNextStep1 = name.trim() !== '' && email.trim() !== '';
  const canSubmit    = password.length >= 8 && password === confirmPwd;

  const nextStep = () => {
    setError('');
    setStep(s => s + 1);
  };

  const prevStep = () => {
    setError('');
    setStep(s => s - 1);
  };

  /* ── Submit ─────────────────────────────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    setLoading(true);
    // PocketBase role values are lowercase: "doctor", "receptionist"
    try {
      await register({ name: name.trim(), email: email.trim(), password, role, specialization, phone });
      navigate(getDashboardPath({ role }), { replace: true });
    } catch (err) {
      const data = err?.response?.data ?? {};
      const fieldErrors = Object.values(data)
        .map(d => d?.message)
        .filter(Boolean)
        .join(' ');
      setError(fieldErrors || err?.message || 'Registration failed. This email may already be registered.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display:'flex', minHeight:'100vh', fontFamily:'Inter, system-ui, sans-serif' }}>

      {/* ── Left panel ─────────────────────────────────────────── */}
      <div style={{
        flex: '0 0 38%',
        background: 'linear-gradient(145deg, #0f4c3a 0%, #0f766e 40%, #134e4a 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '48px 40px',
        position: 'relative',
        overflow: 'hidden',
      }}
        className="auth-panel-left"
      >
        {/* Decorative */}
        <div style={{ position:'absolute', top:-60, right:-60, width:240, height:240, borderRadius:'50%', background:'rgba(255,255,255,0.04)' }} />
        <div style={{ position:'absolute', bottom:80, left:-80, width:300, height:300, borderRadius:'50%', background:'rgba(255,255,255,0.04)' }} />

        {/* Logo */}
        <div style={{ position:'relative', zIndex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
            <div style={{ width:40, height:40, borderRadius:10, background:'rgba(255,255,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} style={{ width:22, height:22 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <span style={{ color:'white', fontWeight:700, fontSize:'1.125rem' }}>ClinIQ</span>
          </div>
          <p style={{ color:'rgba(255,255,255,0.5)', fontSize:'0.75rem', marginLeft:50 }}>
            Staff Registration Portal
          </p>
        </div>

        {/* Role preview (dynamic) */}
        <div style={{ position:'relative', zIndex:1 }}>
          {selectedRole ? (
            <div style={{ animation:'fadeIn 0.3s ease' }}>
              <div style={{ width:56, height:56, borderRadius:14, background:'rgba(255,255,255,0.12)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16, color:'rgba(255,255,255,0.9)' }}>
                {selectedRole.icon}
              </div>
              <h2 style={{ color:'white', fontSize:'1.6rem', fontWeight:700, marginBottom:8, letterSpacing:'-0.03em' }}>
                {selectedRole.label}
              </h2>
              <p style={{ color:'rgba(255,255,255,0.65)', fontSize:'0.9rem', lineHeight:1.6, marginBottom:24 }}>
                {selectedRole.desc}
              </p>
            </div>
          ) : (
            <div>
              <h2 style={{ color:'white', fontSize:'1.6rem', fontWeight:700, marginBottom:8, letterSpacing:'-0.03em' }}>
                Join your clinic team
              </h2>
              <p style={{ color:'rgba(255,255,255,0.65)', fontSize:'0.9rem', lineHeight:1.6 }}>
                Create your staff account to get started. Select a role on the right to see what you'll be able to do.
              </p>
            </div>
          )}

          {/* Steps preview */}
          <div style={{ marginTop:32 }}>
            {STEPS.map((s, i) => (
              <div key={s} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                <div style={{
                  width:24, height:24, borderRadius:'50%',
                  background: i < step ? '#2dd4bf' : i === step ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.15)',
                  display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0
                }}>
                  {i < step ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke={i < step ? '#0f4c3a' : '#0f172a'} strokeWidth={3} style={{ width:12, height:12 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span style={{ fontSize:'0.7rem', fontWeight:700, color: i === step ? '#0f4c3a' : 'rgba(255,255,255,0.5)' }}>{i+1}</span>
                  )}
                </div>
                <span style={{ fontSize:'0.82rem', color: i <= step ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)', fontWeight: i === step ? 600 : 400 }}>
                  {s}
                </span>
              </div>
            ))}
          </div>
        </div>

        <p style={{ position:'relative', zIndex:1, color:'rgba(255,255,255,0.3)', fontSize:'0.7rem' }}>
          © 2025 ClinIQ · Secure staff access only
        </p>
      </div>

      {/* ── Right form panel ─────────────────────────────────────── */}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'40px 24px', background:'#f8fafc', overflowY:'auto' }}>
        <div style={{ width:'100%', maxWidth:420 }}>

          {/* Page heading */}
          <div style={{ marginBottom:28 }}>
            <h2 style={{ fontSize:'1.5rem', fontWeight:700, color:'#0f172a', marginBottom:6, letterSpacing:'-0.02em' }}>
              {STEPS[step]}
            </h2>
            <p style={{ color:'#64748b', fontSize:'0.875rem' }}>
              Step {step + 1} of {STEPS.length}
            </p>
            {/* Step progress bar */}
            <div style={{ marginTop:12, height:4, background:'#e2e8f0', borderRadius:4, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${((step + 1) / STEPS.length) * 100}%`, background:'linear-gradient(90deg, #0f766e, #2dd4bf)', borderRadius:4, transition:'width 0.4s ease' }} />
            </div>
          </div>

          {/* ── Step 0: Role selection ────────────────────────── */}
          {step === 0 && (
            <div>
              <p style={{ fontSize:'0.8rem', color:'#64748b', marginBottom:16 }}>
                Select the role that matches your position in the clinic.
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {ROLES.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRole(r.id)}
                    style={{
                      display:'flex', alignItems:'center', gap:16,
                      padding:'16px 18px',
                      border:`2px solid ${role === r.id ? r.color : '#e2e8f0'}`,
                      borderRadius:12,
                      background: role === r.id ? r.bg : 'white',
                      cursor:'pointer',
                      textAlign:'left',
                      transition:'all 0.15s',
                      boxShadow: role === r.id ? `0 0 0 3px ${r.border}` : 'none',
                    }}
                  >
                    <div style={{ color: role === r.id ? r.color : '#94a3b8', flexShrink:0, transition:'color 0.15s' }}>
                      {r.icon}
                    </div>
                    <div>
                      <div style={{ fontWeight:700, fontSize:'0.9rem', color: role === r.id ? r.color : '#1e293b', marginBottom:3 }}>
                        {r.label}
                      </div>
                      <div style={{ fontSize:'0.77rem', color:'#64748b', lineHeight:1.4 }}>
                        {r.desc}
                      </div>
                    </div>
                    {role === r.id && (
                      <div style={{ marginLeft:'auto', width:20, height:20, borderRadius:'50%', background:r.color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} style={{ width:12, height:12 }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <button
                onClick={nextStep}
                disabled={!canNextStep0}
                style={primaryBtnStyle(!canNextStep0)}
              >
                Continue →
              </button>
            </div>
          )}

          {/* ── Step 1: Personal details ──────────────────────── */}
          {step === 1 && (
            <form onSubmit={e => { e.preventDefault(); if (canNextStep1) nextStep(); }}>
              <Field label="Full Name *" htmlFor="reg-name">
                <input id="reg-name" type="text" placeholder="Dr. Jane Smith" value={name}
                  onChange={e => setName(e.target.value)} required style={inputStyle} autoFocus
                  onFocus={e => e.target.style.borderColor = '#0f766e'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
              </Field>

              <Field label="Work Email *" htmlFor="reg-email">
                <input id="reg-email" type="email" placeholder="you@clinic.com" value={email}
                  onChange={e => setEmail(e.target.value)} required style={inputStyle}
                  onFocus={e => e.target.style.borderColor = '#0f766e'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
              </Field>

              <Field label="Phone (optional)" htmlFor="reg-phone">
                <input id="reg-phone" type="tel" placeholder="+91 98765 43210" value={phone}
                  onChange={e => setPhone(e.target.value)} style={inputStyle}
                  onFocus={e => e.target.style.borderColor = '#0f766e'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
              </Field>

              {role === 'doctor' && (
                <Field label="Specialization" htmlFor="reg-spec">
                  <select id="reg-spec" value={specialization} onChange={e => setSpec(e.target.value)}
                    style={{ ...inputStyle, cursor:'pointer' }}
                    onFocus={e => e.target.style.borderColor = '#0f766e'}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                  >
                    <option value="">Select specialization…</option>
                    {['General Physician','Cardiologist','Dermatologist','Neurologist',
                      'Pediatrician','Gynecologist','Orthopedic','ENT Specialist',
                      'Ophthalmologist','Psychiatrist','Other'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </Field>
              )}

              <div style={{ display:'flex', gap:10, marginTop:24 }}>
                <button type="button" onClick={prevStep} style={secondaryBtnStyle}>
                  ← Back
                </button>
                <button type="submit" disabled={!canNextStep1} style={{ ...primaryBtnStyle(!canNextStep1), flex:1 }}>
                  Continue →
                </button>
              </div>
            </form>
          )}

          {/* ── Step 2: Password ──────────────────────────────── */}
          {step === 2 && (
            <form onSubmit={handleSubmit}>
              <Field label="Password *" htmlFor="reg-password">
                <div style={{ position:'relative' }}>
                  <input id="reg-password" type={showPwd ? 'text' : 'password'}
                    placeholder="Minimum 8 characters" value={password}
                    onChange={e => setPassword(e.target.value)} required autoFocus
                    style={{ ...inputStyle, paddingRight:44 }}
                    onFocus={e => e.target.style.borderColor = '#0f766e'}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                  />
                  <button type="button" onClick={() => setShowPwd(v => !v)}
                    style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding:4 }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width:16, height:16 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                </div>
                {/* Password strength */}
                {password && (
                  <div style={{ marginTop:8 }}>
                    <div style={{ display:'flex', gap:4, marginBottom:4 }}>
                      {[1,2,3,4].map(i => (
                        <div key={i} style={{ flex:1, height:3, borderRadius:2, background: getStrengthColor(password, i) }} />
                      ))}
                    </div>
                    <p style={{ fontSize:'0.7rem', color: getStrengthLabel(password).color }}>
                      {getStrengthLabel(password).text}
                    </p>
                  </div>
                )}
              </Field>

              <Field label="Confirm Password *" htmlFor="reg-confirm">
                <div style={{ position:'relative' }}>
                  <input id="reg-confirm" type={showPwd ? 'text' : 'password'}
                    placeholder="Re-enter your password" value={confirmPwd}
                    onChange={e => setConfirm(e.target.value)} required
                    style={{ ...inputStyle, paddingRight:44, borderColor: confirmPwd && confirmPwd !== password ? '#ef4444' : '#e2e8f0' }}
                    onFocus={e => e.target.style.borderColor = confirmPwd !== password ? '#ef4444' : '#0f766e'}
                    onBlur={e => e.target.style.borderColor = confirmPwd && confirmPwd !== password ? '#ef4444' : '#e2e8f0'}
                  />
                  {confirmPwd && (
                    <div style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)' }}>
                      {confirmPwd === password ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth={2.5} style={{ width:16, height:16 }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2.5} style={{ width:16, height:16 }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </div>
                  )}
                </div>
                {confirmPwd && confirmPwd !== password && (
                  <p style={{ color:'#ef4444', fontSize:'0.72rem', marginTop:4 }}>Passwords do not match</p>
                )}
              </Field>

              {/* Summary box */}
              <div style={{ background:'white', border:'1.5px solid #e2e8f0', borderRadius:12, padding:'14px 16px', marginBottom:20, marginTop:4 }}>
                <p style={{ fontSize:'0.7rem', fontWeight:600, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Account Summary</p>
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  <Row label="Name" val={name} />
                  <Row label="Email" val={email} />
                  <Row label="Role" val={selectedRole?.label} color={selectedRole?.color} />
                  {specialization && <Row label="Specialization" val={specialization} />}
                  {phone && <Row label="Phone" val={phone} />}
                </div>
              </div>

              {error && (
                <div style={{ marginBottom:16, padding:'10px 14px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, display:'flex', gap:8, alignItems:'flex-start' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth={2} style={{ width:16, height:16, flexShrink:0, marginTop:1 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p style={{ color:'#991b1b', fontSize:'0.8rem', lineHeight:1.4 }}>{error}</p>
                </div>
              )}

              <div style={{ display:'flex', gap:10 }}>
                <button type="button" onClick={prevStep} style={secondaryBtnStyle}>
                  ← Back
                </button>
                <button type="submit" disabled={!canSubmit || loading} style={{ ...primaryBtnStyle(!canSubmit || loading), flex:1 }}>
                  {loading ? (
                    <>
                      <span style={{ width:16, height:16, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', display:'inline-block', animation:'spin 0.7s linear infinite' }} />
                      Creating account…
                    </>
                  ) : 'Create Account'}
                </button>
              </div>
            </form>
          )}

          {/* Sign in link */}
          <p style={{ textAlign:'center', color:'#64748b', fontSize:'0.8rem', marginTop:24 }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color:'#0f766e', fontWeight:600, textDecoration:'none' }}
              onMouseOver={e => e.target.style.textDecoration = 'underline'}
              onMouseOut={e => e.target.style.textDecoration = 'none'}
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
        @media (max-width: 768px) { .auth-panel-left { display: none !important; } }
      `}</style>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────── */
function Field({ label, htmlFor, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label htmlFor={htmlFor} style={{ display:'block', fontSize:'0.75rem', fontWeight:600, color:'#475569', marginBottom:6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Row({ label, val, color }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
      <span style={{ fontSize:'0.78rem', color:'#94a3b8' }}>{label}</span>
      <span style={{ fontSize:'0.78rem', fontWeight:600, color: color || '#334155' }}>{val || '—'}</span>
    </div>
  );
}

function getStrength(pwd) {
  let score = 0;
  if (pwd.length >= 8)  score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/\d/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) score++;
  return score;
}

function getStrengthColor(pwd, bar) {
  const s = getStrength(pwd);
  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e'];
  return bar <= s ? colors[s - 1] || '#e2e8f0' : '#e2e8f0';
}

function getStrengthLabel(pwd) {
  const s = getStrength(pwd);
  const labels = [
    { text:'Too weak', color:'#ef4444' },
    { text:'Weak', color:'#f97316' },
    { text:'Fair', color:'#eab308' },
    { text:'Strong ✓', color:'#22c55e' },
  ];
  return labels[s - 1] || { text:'', color:'#94a3b8' };
}

const inputStyle = {
  width: '100%',
  padding: '11px 14px',
  border: '1.5px solid #e2e8f0',
  borderRadius: 10,
  fontSize: '0.875rem',
  background: 'white',
  color: '#0f172a',
  outline: 'none',
  transition: 'border-color 0.15s',
  boxSizing: 'border-box',
};

const primaryBtnStyle = (disabled) => ({
  width: '100%',
  padding: '12px',
  marginTop: 20,
  background: disabled ? '#e2e8f0' : 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)',
  color: disabled ? '#94a3b8' : 'white',
  border: 'none',
  borderRadius: 10,
  fontSize: '0.9rem',
  fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer',
  transition: 'all 0.15s',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  boxShadow: disabled ? 'none' : '0 4px 14px rgba(15, 118, 110, 0.35)',
});

const secondaryBtnStyle = {
  padding: '12px 20px',
  marginTop: 20,
  background: 'white',
  color: '#475569',
  border: '1.5px solid #e2e8f0',
  borderRadius: 10,
  fontSize: '0.875rem',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.15s',
  whiteSpace: 'nowrap',
};
