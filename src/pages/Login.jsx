import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/* ── Role meta used for the pill selector ───────────────────────── */
const ROLES = [
  {
    id: 'receptionist',
    label: 'Receptionist',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 20, height: 20 }}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    desc: 'Manage walk-ins & billing'
  },
  {
    id: 'doctor',
    label: 'Doctor',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 20, height: 20 }}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    desc: 'Prescriptions & patient care'
  }
];

export default function Login() {
  const { login, user, getDashboardPath } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [selectedRole, setSelectedRole] = useState('');

  // Already authenticated → go to their dashboard
  if (user) {
    navigate(getDashboardPath(user), { replace: true });
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setError('');
    setLoading(true);
    try {
      const record = await login(email.trim(), password);
      navigate(getDashboardPath(record), { replace: true });
    } catch {
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Left branding panel ─────────────────────────────────── */}
      <div style={{
        flex: '0 0 42%',
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
        {/* Decorative circles */}
        <div style={{ position:'absolute', top:-60, right:-60, width:240, height:240, borderRadius:'50%', background:'rgba(255,255,255,0.04)' }} />
        <div style={{ position:'absolute', bottom:80, left:-80, width:300, height:300, borderRadius:'50%', background:'rgba(255,255,255,0.04)' }} />
        <div style={{ position:'absolute', top:'40%', right:-40, width:160, height:160, borderRadius:'50%', background:'rgba(45,212,191,0.12)' }} />

        {/* Logo */}
        <div style={{ position:'relative', zIndex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
            <div style={{ width:40, height:40, borderRadius:10, background:'rgba(255,255,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} style={{ width:22, height:22 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <span style={{ color:'white', fontWeight:700, fontSize:'1.125rem', letterSpacing:'-0.02em' }}>
              ClinIQ
            </span>
          </div>
          <p style={{ color:'rgba(255,255,255,0.5)', fontSize:'0.75rem', marginLeft:50 }}>
            Clinic Management System
          </p>
        </div>

        {/* Main copy */}
        <div style={{ position:'relative', zIndex:1 }}>
          <h1 style={{ color:'white', fontSize:'2rem', fontWeight:700, lineHeight:1.2, marginBottom:12, letterSpacing:'-0.03em' }}>
            Smarter clinic.<br />Better care.
          </h1>
          <p style={{ color:'rgba(255,255,255,0.65)', fontSize:'0.9rem', lineHeight:1.65, marginBottom:32 }}>
            One unified platform for your doctors, receptionists, and administrators to collaborate in real-time.
          </p>

          {/* Feature bullets */}
          {[
            'Live patient token queue',
            'Instant prescription & billing',
            'Patient visit history at a glance',
            'End-of-day reports in one click',
          ].map(feat => (
            <div key={feat} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
              <div style={{ width:20, height:20, borderRadius:'50%', background:'rgba(45,212,191,0.25)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth={2.5} style={{ width:12, height:12 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span style={{ color:'rgba(255,255,255,0.75)', fontSize:'0.8rem' }}>{feat}</span>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <div style={{ position:'relative', zIndex:1 }}>
          <p style={{ color:'rgba(255,255,255,0.3)', fontSize:'0.7rem' }}>
            © 2025 ClinIQ · Secure staff access only
          </p>
        </div>
      </div>

      {/* ── Right form panel ─────────────────────────────────────── */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        background: '#f8fafc',
        overflowY: 'auto',
      }}>
        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* Heading */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize:'1.5rem', fontWeight:700, color:'#0f172a', marginBottom:6, letterSpacing:'-0.02em' }}>
              Welcome back
            </h2>
            <p style={{ color:'#64748b', fontSize:'0.875rem' }}>
              Sign in to your account to continue
            </p>
          </div>

          {/* Optional role hint */}
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize:'0.75rem', fontWeight:600, color:'#64748b', marginBottom: 8, textTransform:'uppercase', letterSpacing:'0.06em' }}>
              Sign in as
            </p>
            <div style={{ display:'flex', gap: 8 }}>
              {ROLES.map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedRole(r.id === selectedRole ? '' : r.id)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    padding: '10px 6px',
                    borderRadius: 10,
                    border: `2px solid ${selectedRole === r.id ? '#0f766e' : '#e2e8f0'}`,
                    background: selectedRole === r.id ? '#f0fdfa' : 'white',
                    cursor: 'pointer',
                    color: selectedRole === r.id ? '#0f766e' : '#64748b',
                    transition: 'all 0.15s',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                  }}
                  title={r.desc}
                >
                  <span style={{ color: selectedRole === r.id ? '#0f766e' : '#94a3b8' }}>{r.icon}</span>
                  {r.label}
                </button>
              ))}
            </div>
            <p style={{ fontSize:'0.65rem', color:'#94a3b8', marginTop:6 }}>
              This is optional — just a visual reminder. Access is determined by your account role.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display:'block', fontSize:'0.75rem', fontWeight:600, color:'#475569', marginBottom:6 }}>
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                placeholder="you@clinic.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#0f766e'}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                <label style={{ fontSize:'0.75rem', fontWeight:600, color:'#475569' }}>
                  Password
                </label>
              </div>
              <div style={{ position:'relative' }}>
                <input
                  id="login-password"
                  type={showPwd ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  style={{ ...inputStyle, paddingRight: 44 }}
                  onFocus={e => e.target.style.borderColor = '#0f766e'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding:4 }}
                  tabIndex={-1}
                >
                  {showPwd ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width:16, height:16 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width:16, height:16 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ marginBottom: 16, padding:'10px 14px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, display:'flex', gap:8, alignItems:'flex-start' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth={2} style={{ width:16, height:16, flexShrink:0, marginTop:1 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p style={{ color:'#991b1b', fontSize:'0.8rem', lineHeight:1.4 }}>{error}</p>
              </div>
            )}

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                background: loading ? '#6b7280' : 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)',
                color: 'white',
                border: 'none',
                borderRadius: 10,
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: loading ? 'none' : '0 4px 14px rgba(15, 118, 110, 0.35)',
              }}
            >
              {loading ? (
                <>
                  <span style={{ width:16, height:16, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', display:'inline-block', animation:'spin 0.7s linear infinite' }} />
                  Signing in…
                </>
              ) : 'Sign in to ClinIQ'}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display:'flex', alignItems:'center', gap:12, margin:'24px 0' }}>
            <div style={{ flex:1, height:1, background:'#e2e8f0' }} />
            <span style={{ color:'#94a3b8', fontSize:'0.75rem' }}>or</span>
            <div style={{ flex:1, height:1, background:'#e2e8f0' }} />
          </div>

          {/* Register link */}
          <div style={{ textAlign:'center' }}>
            <p style={{ color:'#64748b', fontSize:'0.8rem' }}>
              New staff member?{' '}
              <Link to="/register" style={{ color:'#0f766e', fontWeight:600, textDecoration:'none' }}
                onMouseOver={e => e.target.style.textDecoration = 'underline'}
                onMouseOut={e => e.target.style.textDecoration = 'none'}
              >
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .auth-panel-left { display: none !important; }
        }
      `}</style>
    </div>
  );
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
