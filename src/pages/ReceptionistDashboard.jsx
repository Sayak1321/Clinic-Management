import { useState, useEffect, useCallback, useRef } from 'react';
import supabase from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import TokenQueue from '../components/TokenQueue';
import ConfirmDialog from '../components/ConfirmDialog';
import { generateBillPDF } from '../lib/pdfBill';

// Format standard date formatting consistently
const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  } catch {
    return dateStr;
  }
};

export default function ReceptionistDashboard() {
  console.log('[ReceptionistDashboard] rendering');
  const { user: authUser, logout } = useAuth();
  const user = authUser || {
    id: 'e0000000-0000-0000-0000-000000000000',
    name: 'Guest Receptionist',
    email: 'receptionist@cliniq.com',
    role: 'receptionist'
  };
  const { settings } = useSettings();
  const { addToast } = useToast();
  const today = new Date().toISOString().split('T')[0];

  // --- Theme State ---
  const [isLightMode, setIsLightMode] = useState(() => {
    return localStorage.getItem('theme') === 'light';
  });

  useEffect(() => {
    if (isLightMode) {
      document.documentElement.classList.add('light');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.classList.remove('light');
      localStorage.setItem('theme', 'dark');
    }
  }, [isLightMode]);

  const [themeToggleRotating, setThemeToggleRotating] = useState(false);

  const handleThemeToggle = () => {
    setThemeToggleRotating(true);
    setIsLightMode(v => !v);
    setTimeout(() => setThemeToggleRotating(false), 400);
  };

  // --- State Variables ---
  const [form, setForm] = useState({ name: '', phone: '', dob: '', address: '', blood_group: '', chief_complaint: '', doctor: '' });
  const [submitting, setSubmitting] = useState(false);
  
  // Autocomplete suggestions
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const suggestionsRef = useRef(null);

  // Today's tokens & bills
  const [tokens, setTokens] = useState([]);
  const [bills, setBills] = useState([]);
  const [doctorsList, setDoctorsList] = useState([]);
  const [allPatients, setAllPatients] = useState([]);

  // Active Billing State
  const [activeTokenToBill, setActiveTokenToBill] = useState(null);
  const [billItems, setBillItems] = useState([]);
  const [billTotal, setBillTotal] = useState(0);

  // Search patients & History State
  const [searchQuery, setSearchQuery] = useState('');
  const [historyPatient, setHistoryPatient] = useState(null);
  const [patientHistoryList, setPatientHistoryList] = useState([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Confirmations
  const [confirmRevisitOpen, setConfirmRevisitOpen] = useState(false);
  const [revisitPatientData, setRevisitPatientData] = useState(null);

  const phoneInputRef = useRef(null);

  // --- Common Bill Item Presets ---
  const BILL_PRESETS = [
    { description: 'Consultation Fee', amount: settings.default_consultation_fee || 500 },
    { description: 'Injection Charge', amount: 100 },
    { description: 'Dressing & Bandage', amount: 150 },
    { description: 'Blood Test', amount: 300 },
    { description: 'Medicines Dispensed', amount: 200 }
  ];

  // --- Fetching Data ---
  const fetchTokens = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('tokens')
        .select('*, patient:patients(*), doctor:profiles!doctor(*)')
        .eq('date', today)
        .order('token_number');
      if (error) throw error;

      const mapped = (data || []).map(t => ({
        ...t,
        patient: t.patient?.id || t.patient,
        doctor: t.doctor?.id || t.doctor,
        expand: {
          patient: t.patient,
          doctor: t.doctor
        }
      }));
      setTokens(mapped);
    } catch (err) {
      console.error('Error fetching tokens:', err);
    }
  }, [today]);

  const fetchBills = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('bills')
        .select('*, patient:patients(*), token:tokens(*)')
        .gte('created_at', `${today}T00:00:00`)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const mapped = (data || []).map(b => ({
        ...b,
        patient: b.patient?.id || b.patient,
        token: b.token?.id || b.token,
        expand: {
          patient: b.patient,
          token: b.token
        }
      }));
      setBills(mapped);
    } catch (err) {
      console.error('Error fetching bills:', err);
    }
  }, [today]);

  const fetchDoctors = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'doctor');
      if (error) throw error;
      setDoctorsList(data || []);
    } catch (err) {
      console.error('Error fetching doctors:', err);
    }
  }, []);

  const fetchAllPatients = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('name');
      if (error) throw error;
      setAllPatients(data || []);
    } catch (err) {
      console.error('Error fetching patients:', err);
    }
  }, []);

  useEffect(() => {
    fetchTokens();
    fetchBills();
    fetchDoctors();
    fetchAllPatients();

    // Subscribe to real-time events in Supabase
    const tokensChannel = supabase.channel('tokens-receptionist')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tokens' }, () => fetchTokens())
      .subscribe();

    const billsChannel = supabase.channel('bills-receptionist')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bills' }, () => fetchBills())
      .subscribe();

    const profilesChannel = supabase.channel('profiles-receptionist')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchDoctors())
      .subscribe();

    const patientsChannel = supabase.channel('patients-receptionist')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, () => fetchAllPatients())
      .subscribe();

    return () => {
      supabase.removeChannel(tokensChannel);
      supabase.removeChannel(billsChannel);
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(patientsChannel);
    };
  }, [fetchTokens, fetchBills, fetchDoctors, fetchAllPatients]);

  // --- Keyboard Shortcuts (P1 7.8) ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        phoneInputRef.current?.focus();
        addToast('Phone input focused', 'info');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [addToast]);

  // --- Autocomplete Lookup (P0 7.2) ---
  useEffect(() => {
    if (form.phone.length < 3) {
      setSuggestions([]);
      return;
    }
    const matching = allPatients
      .filter(p => p.phone.includes(form.phone))
      .slice(0, 5);
    setSuggestions(matching);
  }, [form.phone, allPatients]);

  const handleSelectSuggestion = (patient) => {
    setForm({
      name: patient.name,
      phone: patient.phone,
      dob: patient.dob ? patient.dob.split('T')[0] : '',
      address: patient.address || '',
      blood_group: patient.blood_group || '',
      chief_complaint: form.chief_complaint,
      doctor: form.doctor
    });
    setSuggestions([]);
    setShowSuggestions(false);
    addToast(`Selected patient: ${patient.name}`);
  };

  const handleSuggestionKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      if (highlightIndex >= 0 && highlightIndex < suggestions.length) {
        e.preventDefault();
        handleSelectSuggestion(suggestions[highlightIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  // --- Registration Logic ---
  const handleAssignToken = async (e) => {
    if (e) e.preventDefault();

    setSubmitting(true);
    try {
      // 1. Upsert patient by phone number
      let patient;
      const { data: existing, error: searchError } = await supabase
        .from('patients')
        .select('*')
        .eq('phone', form.phone)
        .limit(1);
      if (searchError) throw searchError;

      if (existing && existing.length > 0) {
        patient = existing[0];
        // Keep their records updated if fields changed
        if (form.name !== patient.name || form.dob !== (patient.dob ? patient.dob : '') || form.address !== patient.address || form.blood_group !== patient.blood_group) {
          const { data: updated, error: updateError } = await supabase
            .from('patients')
            .update({
              name: form.name,
              dob: form.dob || null,
              address: form.address,
              blood_group: form.blood_group
            })
            .eq('id', patient.id)
            .select()
            .single();
          if (updateError) throw updateError;
          patient = updated;
        }
      } else {
        const { data: created, error: createError } = await supabase
          .from('patients')
          .insert({
            name: form.name,
            phone: form.phone,
            dob: form.dob || null,
            address: form.address,
            blood_group: form.blood_group,
          })
          .select()
          .single();
        if (createError) throw createError;
        patient = created;
      }

      // Revisit Detection (P2 7.16)
      if (!confirmRevisitOpen) {
        const { data: todayTokenExists, error: checkError } = await supabase
          .from('tokens')
          .select('id')
          .eq('patient', patient.id)
          .eq('date', today)
          .limit(1);
        if (checkError) throw checkError;
        if (todayTokenExists && todayTokenExists.length > 0) {
          setRevisitPatientData(patient);
          setConfirmRevisitOpen(true);
          setSubmitting(false);
          return;
        }
      }

      // Proceed to assign token
      await createTokenForPatient(patient);
    } catch (err) {
      console.error(err);
      addToast('Failed to register patient.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const createTokenForPatient = async (patient) => {
    try {
      // Calculate token number
      const { data: todayTokens, error: fetchErr } = await supabase
        .from('tokens')
        .select('token_number')
        .eq('date', today)
        .order('token_number', { ascending: false })
        .limit(1);
      if (fetchErr) throw fetchErr;

      const nextTokenNum = todayTokens && todayTokens.length > 0
        ? todayTokens[0].token_number + 1
        : 1;

      const { error: insertErr } = await supabase
        .from('tokens')
        .insert({
          patient:      patient.id,
          token_number: nextTokenNum,
          date:         today,
          status:       'waiting',
          receptionist: user.id,
          chief_complaint: form.chief_complaint,
          doctor:       form.doctor || null
        });
      if (insertErr) throw insertErr;

      addToast(`Token #${nextTokenNum} successfully assigned to ${patient.name}!`);
      
      // Reset form
      setForm({ name: '', phone: '', dob: '', address: '', blood_group: '', chief_complaint: '', doctor: '' });
      setConfirmRevisitOpen(false);
      setRevisitPatientData(null);
    } catch (err) {
      console.error(err);
      addToast('Failed to assign token.', 'error');
    }
  };

  // --- Patient Search & Visit History Panel (P0 7.5) ---
  const handlePatientSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleAssignDoctor = async (tokenId, doctorId) => {
    try {
      const { error } = await supabase
        .from('tokens')
        .update({ doctor: doctorId || null })
        .eq('id', tokenId);
      if (error) throw error;
      addToast('Doctor assignment updated successfully.', 'success');
      fetchTokens();
    } catch (err) {
      console.error(err);
      addToast('Failed to update doctor assignment.', 'error');
    }
  };

  const handleViewPatientHistory = async (patient) => {
    setHistoryPatient(patient);
    try {
      const { data: prescriptions, error } = await supabase
        .from('prescriptions')
        .select('*, doctor:profiles(*), token:tokens(*)')
        .eq('patient', patient.id)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const mapped = (prescriptions || []).map(p => ({
        ...p,
        patient: p.patient?.id || p.patient,
        doctor: p.doctor?.id || p.doctor,
        token: p.token?.id || p.token,
        expand: {
          patient: p.patient,
          doctor: p.doctor,
          token: p.token
        }
      }));
      setPatientHistoryList(mapped);
      setShowHistoryModal(true);
    } catch (err) {
      addToast('Failed to load patient history.', 'error');
    }
  };

  // --- Billing Editor (P0 7.3) ---
  const handleOpenBilling = (token) => {
    setActiveTokenToBill(token);
    // Initialize with consultation fee
    const initialItems = [{ description: 'Consultation Fee', amount: settings.default_consultation_fee || 500 }];
    setBillItems(initialItems);
    setBillTotal(settings.default_consultation_fee || 500);
  };

  const handleAddBillRow = () => {
    setBillItems(prev => [...prev, { description: '', amount: 0 }]);
  };

  const handleRemoveBillRow = (idx) => {
    const updated = billItems.filter((_, i) => i !== idx);
    setBillItems(updated);
    setBillTotal(updated.reduce((sum, item) => sum + Number(item.amount || 0), 0));
  };

  const handleUpdateBillItem = (idx, field, value) => {
    const updated = [...billItems];
    if (field === 'amount') {
      updated[idx][field] = Number(value || 0);
    } else {
      updated[idx][field] = value;
    }
    setBillItems(updated);
    setBillTotal(updated.reduce((sum, item) => sum + Number(item.amount || 0), 0));
  };

  const handleApplyPreset = (preset) => {
    // Add preset to rows, avoiding duplicates if desired or just appending
    const updated = [...billItems, { ...preset }];
    setBillItems(updated);
    setBillTotal(updated.reduce((sum, item) => sum + Number(item.amount || 0), 0));
  };

  const handleCreateBill = async (e) => {
    e.preventDefault();
    if (!activeTokenToBill) return;

    try {
      // Get doctor prescription if available
      const { data: prescriptionData } = await supabase
        .from('prescriptions')
        .select('*, doctor:profiles(*)')
        .eq('token', activeTokenToBill.id)
        .limit(1);

      const prescription = prescriptionData && prescriptionData.length > 0 ? {
        ...prescriptionData[0],
        expand: {
          doctor: prescriptionData[0].doctor
        }
      } : null;

      const { data: bill, error: billError } = await supabase
        .from('bills')
        .insert({
          token:        activeTokenToBill.id,
          patient:      activeTokenToBill.expand.patient.id,
          items:        billItems.filter(item => item.description.trim()),
          total:        billTotal,
          paid:         false,
          receptionist: user.id,
        })
        .select()
        .single();
      if (billError) throw billError;

      addToast(`Bill created for ${activeTokenToBill.expand.patient.name}.`);

      // Trigger automatic PDF download
      generateBillPDF({
        token: activeTokenToBill,
        patient: activeTokenToBill.expand.patient,
        billItems,
        total: billTotal,
        prescription,
        clinicName: settings.clinic_name
      });

      setActiveTokenToBill(null);
    } catch (err) {
      console.error(err);
      addToast('Error generating bill.', 'error');
    }
  };

  // --- Mark Bill as Paid (P0 7.4) ---
  const handleMarkBillPaid = async (billId) => {
    try {
      const { error } = await supabase
        .from('bills')
        .update({ paid: true })
        .eq('id', billId);
      if (error) throw error;
      addToast('Bill marked as paid.', 'success');
    } catch (err) {
      addToast('Failed to update payment status.', 'error');
    }
  };

  // --- Daily Receptionist Summary & CSV Report (P1 7.10) ---
  const getDailySummary = () => {
    const todayTokens = tokens;
    const todayBills = bills;

    const totalSeen = todayTokens.filter(t => t.status === 'done').length;
    const totalBilled = todayBills.reduce((sum, b) => sum + b.total, 0);
    const unpaidCount = todayBills.filter(b => !b.paid).length;

    return { totalSeen, totalBilled, unpaidCount };
  };

  const handleDownloadDayReport = () => {
    try {
      // Build a simple CSV report of today's activities
      let csvContent = 'data:text/csv;charset=utf-8,';
      csvContent += 'Token Number,Patient Name,Phone,Status,Chief Complaint,Bill Total,Payment Status\n';

      tokens.forEach(t => {
        const associatedBill = bills.find(b => b.token === t.id);
        const billTotal = associatedBill ? associatedBill.total : '—';
        const paidStatus = associatedBill ? (associatedBill.paid ? 'Paid' : 'Unpaid') : 'No Bill';
        
        const row = [
          t.token_number,
          `"${t.expand?.patient?.name || ''}"`,
          t.expand?.patient?.phone || '',
          t.status,
          `"${t.chief_complaint || ''}"`,
          billTotal,
          paidStatus
        ].join(',');
        csvContent += row + '\n';
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `daily-report-${today}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      addToast('Daily summary CSV report downloaded.');
    } catch (err) {
      addToast('Failed to download report.', 'error');
    }
  };

  const displayedPatients = searchQuery.trim() === ''
    ? allPatients
    : allPatients.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        p.phone.includes(searchQuery)
      );

  const summary = getDailySummary();
  const paidTokenIds = new Set(bills.filter(b => b.paid).map(b => b.token));
  const unpaidTokenIds = new Set(bills.filter(b => !b.paid).map(b => b.token));

  return (
    <div
      className="min-h-screen flex flex-col font-sans antialiased overflow-hidden"
      style={{ backgroundColor: 'var(--bg-canvas)', color: 'var(--color-text-high)', transition: 'background-color 0.3s, color 0.3s' }}
    >
      {/* Header — Modernized Header with Shimmer, Theme Toggle and SSE Indicator */}
      <header className="dashboard-header h-16 flex items-center justify-between px-6 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-lg shadow-inner"
            style={{ backgroundColor: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', color: 'var(--color-accent)' }}>
            Q
          </div>
          <div>
            <span className="font-bold text-sm tracking-wide block" style={{ color: 'var(--color-text-high)' }}>{settings.clinic_name || 'CLINIQ'}</span>
            <span className="text-[10px] block" style={{ color: 'var(--color-text-muted)' }}>Reception Portal · {user.name}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Theme toggle matching doctor portal */}
          <button
            type="button"
            onClick={handleThemeToggle}
            className="theme-toggle-btn w-9 h-9 rounded-lg flex items-center justify-center"
            style={{
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--color-text-muted)',
              transform: themeToggleRotating ? 'scale(0.88) rotate(180deg)' : 'scale(1) rotate(0deg)',
            }}
            title="Toggle Light/Dark Theme"
          >
            {isLightMode ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 7a5 5 0 100 10 5 5 0 000-10z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
            )}
          </button>

          {/* Sync indicator */}
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full relative flex">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-emerald-400" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[10px] font-semibold tracking-wider uppercase hidden sm:inline" style={{ color: 'var(--color-text-muted)' }}>
              Live Sync
            </span>
          </div>

          <button onClick={logout}
            className="text-xs font-semibold px-4 py-1.5 rounded-full transition-all border text-red-400 bg-red-500/5 hover:border-red-500/30">
            Sign out
          </button>
        </div>
      </header>

      {/* Main Grid Layout — Responsive Grid spanning 12 cols */}
      <div className="max-w-7xl w-full mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 overflow-y-auto">
        
        {/* Left Column (Forms & Search) - Span 4 */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Register Patient Card */}
          <div className="card" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--color-border)' }}>
            <div className="flex items-center justify-between mb-4 border-b border-borderMuted/30 pb-2">
              <div className="section-title">Register Walk-in</div>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider" 
                style={{ backgroundColor: 'var(--bg-canvas)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
                title="Press Ctrl+N to focus phone field">
                Ctrl+N
              </span>
            </div>

            <form onSubmit={handleAssignToken} className="space-y-3.5">
              <div className="relative">
                <input
                  ref={phoneInputRef}
                  className="w-full bg-canvas border border-borderMuted text-textHigh placeholder-textMuted/50 rounded-xl p-2.5 text-xs focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all font-sans"
                  placeholder="Phone number (10-digit) *"
                  value={form.phone}
                  onChange={e => {
                    setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '').substring(0, 10) }));
                    setShowSuggestions(true);
                  }}
                  onKeyDown={handleSuggestionKeyDown}
                  required
                  autoFocus
                />
                
                {/* Autocomplete Dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <ul
                    ref={suggestionsRef}
                    className="absolute z-20 w-full mt-1 rounded-xl shadow-2xl max-h-48 overflow-y-auto divide-y divide-borderMuted/30 animate-fadeIn"
                    style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--color-border)' }}
                  >
                    {suggestions.map((p, idx) => (
                      <li
                        key={p.id}
                        onClick={() => handleSelectSuggestion(p)}
                        className={[
                          'p-2.5 text-xs cursor-pointer transition-colors flex justify-between items-center',
                          idx === highlightIndex ? 'bg-accent/15 text-accent font-semibold' : 'text-textHigh'
                        ].join(' ')}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-canvas)'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <div>
                          <p className="font-bold">{p.name}</p>
                          <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{p.phone}</p>
                        </div>
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full"
                          style={{ color: 'var(--color-accent)', backgroundColor: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)' }}>
                          Select
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <input
                className="w-full bg-canvas border border-borderMuted text-textHigh placeholder-textMuted/50 rounded-xl p-2.5 text-xs focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all font-sans"
                placeholder="Patient Name *"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
              />

              <div className="grid grid-cols-2 gap-2">
                <input
                  className="w-full bg-canvas border border-borderMuted text-textHigh placeholder-textMuted/50 rounded-xl p-2.5 text-xs focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all font-sans text-xs"
                  type="date"
                  placeholder="DOB"
                  value={form.dob}
                  onChange={e => setForm(f => ({ ...f, dob: e.target.value }))}
                  title="Date of birth"
                />
                <select
                  className="w-full bg-canvas border border-borderMuted text-textHigh placeholder-textMuted/50 rounded-xl p-2.5 text-xs focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all font-sans text-xs cursor-pointer"
                  value={form.blood_group}
                  onChange={e => setForm(f => ({ ...f, blood_group: e.target.value }))}
                >
                  <option value="" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--color-text-high)' }}>Blood Group</option>
                  {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(bg => (
                    <option key={bg} value={bg} style={{ backgroundColor: 'var(--bg-card)', color: 'var(--color-text-high)' }}>{bg}</option>
                  ))}
                </select>
              </div>

              <input
                className="w-full bg-canvas border border-borderMuted text-textHigh placeholder-textMuted/50 rounded-xl p-2.5 text-xs focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all font-sans"
                placeholder="Address"
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              />

              <select
                className="w-full bg-canvas border border-borderMuted text-textHigh placeholder-textMuted/50 rounded-xl p-2.5 text-xs focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all font-sans text-xs cursor-pointer"
                value={form.doctor}
                onChange={e => setForm(f => ({ ...f, doctor: e.target.value }))}
              >
                <option value="" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--color-text-high)' }}>Assign Doctor (Optional)</option>
                {doctorsList.map(doc => (
                  <option key={doc.id} value={doc.id} style={{ backgroundColor: 'var(--bg-card)', color: 'var(--color-text-high)' }}>
                    Dr. {doc.name} {doc.is_available ? '(Available)' : '(On Break)'}
                  </option>
                ))}
              </select>

              <input
                className="w-full bg-canvas border border-borderMuted text-textHigh placeholder-textMuted/50 rounded-xl p-2.5 text-xs focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all font-sans"
                placeholder="Chief Complaint / Notes"
                value={form.chief_complaint}
                onChange={e => setForm(f => ({ ...f, chief_complaint: e.target.value }))}
              />

              <button type="submit" className="w-full font-bold py-2.5 rounded-full transition-all text-xs flex items-center justify-center shadow-md uppercase tracking-wider mt-2"
                style={{ backgroundColor: 'var(--color-accent)', color: '#020617' }}
                disabled={submitting}>
                {submitting ? 'Assigning…' : 'Assign Token & Register'}
              </button>
            </form>
          </div>

          {/* Patient Lookup & History Panel */}
          <div className="card" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--color-border)' }}>
            <div className="section-title mb-3">Lookup Patient & History</div>
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={handlePatientSearch}
              className="w-full bg-canvas border border-borderMuted text-textHigh placeholder-textMuted/50 rounded-xl p-2.5 text-xs focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all font-sans mb-3.5"
            />
            {displayedPatients.length > 0 ? (
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                {displayedPatients.map(p => (
                  <div
                    key={p.id}
                    onClick={() => handleViewPatientHistory(p)}
                    className="flex justify-between items-center p-2 rounded-xl border border-borderMuted/30 hover:border-accent/40 cursor-pointer transition-all"
                    style={{ backgroundColor: 'rgba(11,15,25,0.3)' }}
                  >
                    <div>
                      <p className="text-xs font-semibold" style={{ color: 'var(--color-text-high)' }}>{p.name}</p>
                      <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{p.phone}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded"
                      style={{ color: 'var(--color-accent)', backgroundColor: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)' }}>
                      History
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-center py-4" style={{ color: 'var(--color-text-muted)' }}>
                {searchQuery.trim() ? 'No matching records found.' : 'No patients registered.'}
              </p>
            )}
          </div>

          {/* Doctor Availability display */}
          <div className="card" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--color-border)' }}>
            <div className="section-title mb-3">On-Duty Doctors</div>
            <div className="space-y-2">
              {doctorsList.map(doc => (
                <div key={doc.id} className="flex items-center justify-between p-2.5 rounded-xl text-xs border border-borderMuted/30"
                  style={{ backgroundColor: 'rgba(11,15,25,0.3)' }}>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full animate-pulse" style={{
                      backgroundColor: doc.is_available ? '#10b981' : '#94a3b8',
                      boxShadow: doc.is_available ? '0 0 8px rgba(16,185,129,0.5)' : 'none'
                    }}></span>
                    <span className="font-semibold text-textHigh">Dr. {doc.name}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                    style={{
                      backgroundColor: doc.is_available ? 'rgba(16,185,129,0.1)' : 'rgba(148,163,184,0.1)',
                      color: doc.is_available ? '#10b981' : 'var(--color-text-muted)',
                      border: `1px solid ${doc.is_available ? 'rgba(16,185,129,0.2)' : 'var(--color-border)'}`
                    }}>
                    {doc.is_available ? 'Available' : 'On Break'}
                  </span>
                </div>
              ))}
              {doctorsList.length === 0 && (
                <p className="text-xs text-center py-2" style={{ color: 'var(--color-text-muted)' }}>No doctors configured.</p>
              )}
            </div>
          </div>
        </div>

        {/* Center Column (Live Queue) - Span 5 */}
        <div className="lg:col-span-5">
          <TokenQueue
            tokens={tokens}
            showBillButton
            onGenerateBill={handleOpenBilling}
            paidTokenIds={paidTokenIds}
            unpaidTokenIds={unpaidTokenIds}
            doctors={doctorsList}
            onAssignDoctor={handleAssignDoctor}
          />
        </div>

        {/* Right Column (Unpaid Bills & Summary) - Span 3 */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          
          {/* Daily Summary statistics */}
          <div className="card text-white border-0 shadow-lg"
            style={{ background: 'linear-gradient(135deg, var(--primary-900) 0%, var(--primary-800) 100%)' }}>
            <h2 className="text-xs font-extrabold opacity-95 uppercase tracking-wider mb-3">Today's Clinic Summary</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-2xl font-black">{summary.totalSeen}</p>
                <p className="text-[9px] opacity-75 uppercase tracking-wider font-extrabold mt-1">Patients Seen</p>
              </div>
              <div>
                <p className="text-2xl font-black">₹{summary.totalBilled}</p>
                <p className="text-[9px] opacity-75 uppercase tracking-wider font-extrabold mt-1">Total Billed</p>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-white/20 pt-3">
              <div>
                <span className="text-sm font-bold text-amber-300">{summary.unpaidCount}</span>
                <span className="text-[9px] opacity-75 ml-1.5 uppercase tracking-wider font-extrabold">Unpaid Bills</span>
              </div>
              <button
                onClick={handleDownloadDayReport}
                className="bg-white/10 hover:bg-white/20 transition-all text-[9px] py-1.5 px-3 rounded-lg border border-white/10 flex items-center gap-1 font-bold uppercase tracking-wider"
              >
                CSV Report
              </button>
            </div>
          </div>

          {/* Unpaid Bills Sidebar Tracker */}
          <div className="card flex-1 flex flex-col min-h-[300px]" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--color-border)' }}>
            <div className="pb-2 mb-3 flex items-center justify-between border-b border-borderMuted/30">
              <div className="section-title">Unpaid Bills</div>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                style={{
                  backgroundColor: bills.filter(b => !b.paid).length > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                  color: bills.filter(b => !b.paid).length > 0 ? '#f87171' : '#10b981',
                  border: `1px solid ${bills.filter(b => !b.paid).length > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`
                }}>
                {bills.filter(b => !b.paid).length} Unpaid
              </span>
            </div>
            
            <div className="space-y-2 overflow-y-auto flex-1 pr-1 max-h-[400px] scrollbar-thin">
              {bills.filter(b => !b.paid).map(bill => (
                <div
                  key={bill.id}
                  className="p-3 rounded-xl flex flex-col gap-1.5 border"
                  style={{
                    backgroundColor: 'rgba(239,68,68,0.025)',
                    borderColor: 'rgba(239,68,68,0.15)',
                    color: 'var(--color-text-high)'
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-xs">{bill.expand?.patient?.name}</p>
                      <p className="text-[9px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Token #{bill.expand?.token?.token_number}</p>
                    </div>
                    <span className="font-bold text-xs px-2 py-0.5 rounded"
                      style={{ color: '#f87171', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.15)' }}>
                      ₹{bill.total}
                    </span>
                  </div>
                  <button
                    onClick={() => handleMarkBillPaid(bill.id)}
                    className="w-full font-bold text-[9px] py-1.5 rounded-lg shadow-sm mt-1 uppercase tracking-wider transition-all"
                    style={{ backgroundColor: '#dc2626', color: '#ffffff' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#b91c1c'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#dc2626'}
                  >
                    Mark Paid
                  </button>
                </div>
              ))}
              {bills.filter(b => !b.paid).length === 0 && (
                <div className="text-center py-12 flex flex-col items-center justify-center flex-1 h-full text-textMuted">
                  <svg className="w-8 h-8 mb-2 opacity-35" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>All bills cleared!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Revisit Warning Dialog */}
      <ConfirmDialog
        isOpen={confirmRevisitOpen}
        title="Double Registration Warning"
        message={`Warning: ${revisitPatientData?.name} already has a token assigned for today. Are you sure you want to register them again?`}
        onConfirm={async () => {
          if (revisitPatientData) {
            setSubmitting(true);
            await createTokenForPatient(revisitPatientData);
            setSubmitting(false);
          }
        }}
        onCancel={() => {
          setConfirmRevisitOpen(false);
          setRevisitPatientData(null);
        }}
      />

      {/* Bill Editor Overlay (Modal Form) */}
      {activeTokenToBill && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-lg p-6 rounded-2xl shadow-2xl relative max-h-[90vh] flex flex-col animate-slideIn"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--color-border)', color: 'var(--color-text-high)' }}>
            <button
              onClick={() => setActiveTokenToBill(null)}
              className="absolute top-4 right-4 text-textMuted hover:text-textHigh font-bold text-2xl"
            >
              &times;
            </button>
            <h2 className="text-lg font-bold mb-1">
              Create Invoice
            </h2>
            <p className="text-xs mb-4 border-b border-borderMuted/30 pb-2" style={{ color: 'var(--color-text-muted)' }}>
              Patient: <span className="font-bold" style={{ color: 'var(--color-text-high)' }}>{activeTokenToBill.expand?.patient?.name}</span> (Token #{activeTokenToBill.token_number})
            </p>

            <form onSubmit={handleCreateBill} className="space-y-4 flex-1 flex flex-col overflow-hidden">
              
              {/* Presets Row */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Quick Presets</p>
                <div className="flex flex-wrap gap-1.5">
                  {BILL_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className="text-[10px] py-1.5 px-2.5 rounded-lg border transition-all font-semibold"
                      style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(56,189,248,0.4)'; e.currentTarget.style.color = 'var(--color-accent)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-muted)'; }}
                    >
                      + {preset.description} (₹{preset.amount})
                    </button>
                  ))}
                </div>
              </div>

              {/* Items List */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[150px] scrollbar-thin">
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>Invoice Line Items</p>
                {billItems.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center p-2 rounded-xl border"
                    style={{ backgroundColor: 'rgba(11,15,25,0.3)', borderColor: 'var(--color-border)' }}>
                    <input
                      className="col-span-7 w-full bg-canvas border border-borderMuted text-textHigh placeholder-textMuted/50 rounded-lg py-1 px-2 text-[11px] focus:outline-none transition-all font-semibold"
                      placeholder="Item description"
                      value={item.description}
                      onChange={e => handleUpdateBillItem(idx, 'description', e.target.value)}
                      required
                    />
                    <input
                      type="number"
                      className="col-span-3 w-full bg-canvas border border-borderMuted text-textHigh placeholder-textMuted/50 rounded-lg py-1 px-2 text-[11px] focus:outline-none transition-all font-mono"
                      placeholder="Amount"
                      value={item.amount || ''}
                      onChange={e => handleUpdateBillItem(idx, 'amount', e.target.value)}
                      required
                      min="0"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveBillRow(idx)}
                      className="col-span-2 text-red-400 hover:text-red-350 text-[10px] font-bold py-1 bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 rounded-lg"
                      disabled={billItems.length <= 1}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddBillRow}
                  className="w-full text-[10px] font-bold py-2 border border-dashed rounded-xl transition-all"
                  style={{ borderColor: 'rgba(56,189,248,0.4)', color: 'var(--color-accent)', backgroundColor: 'rgba(56,189,248,0.02)' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(56,189,248,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(56,189,248,0.02)'}
                >
                  + Add Line Item
                </button>
              </div>

              {/* Total Summary */}
              <div className="p-3.5 rounded-xl border flex justify-between items-center text-xs font-bold"
                style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--color-border)', color: 'var(--color-text-high)' }}>
                <span className="uppercase tracking-wider">Grand Total</span>
                <span className="text-xl" style={{ color: 'var(--color-accent)' }}>₹{billTotal}</span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-borderMuted/30">
                <button
                  type="button"
                  onClick={() => setActiveTokenToBill(null)}
                  className="px-4 py-2 rounded-full border transition-all text-xs font-semibold"
                  style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full font-bold text-xs uppercase tracking-wider transition-all shadow-md"
                  style={{ backgroundColor: 'var(--color-accent)', color: '#020617' }}
                >
                  Generate Invoice & Print
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Patient History Modal */}
      {showHistoryModal && historyPatient && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-xl p-6 rounded-2xl shadow-2xl relative max-h-[85vh] flex flex-col animate-slideIn"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--color-border)', color: 'var(--color-text-high)' }}>
            <button
              onClick={() => setShowHistoryModal(false)}
              className="absolute top-4 right-4 text-textMuted hover:text-textHigh font-bold text-2xl"
            >
              &times;
            </button>
            <h2 className="text-lg font-bold mb-1">
              Visit & Prescription History
            </h2>
            <p className="text-xs mb-4 border-b border-borderMuted/30 pb-2" style={{ color: 'var(--color-text-muted)' }}>
              Patient: <span className="font-bold" style={{ color: 'var(--color-text-high)' }}>{historyPatient.name}</span> | Phone: {historyPatient.phone}
            </p>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
              {patientHistoryList.map((rx) => (
                <div key={rx.id} className="p-4 rounded-xl border text-xs"
                  style={{ backgroundColor: 'rgba(11,15,25,0.3)', borderColor: 'var(--color-border)' }}>
                  <div className="flex justify-between items-start mb-2 border-b pb-1.5 text-[10px]"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                    <span>Date: <span className="font-semibold text-textHigh">{formatDate(rx.created_at || rx.created)}</span></span>
                    <span>Doctor: <span className="font-semibold text-textHigh">Dr. {rx.expand?.doctor?.name || 'Unknown'}</span></span>
                  </div>
                  {rx.diagnosis && (
                    <div className="mb-2.5">
                      <p className="font-bold text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>Diagnosis</p>
                      <p className="p-2.5 rounded-lg border font-medium" style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--color-border)' }}>{rx.diagnosis}</p>
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-[10px] uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Medicines Prescribed</p>
                    <div className="rounded-lg overflow-hidden border" style={{ borderColor: 'var(--color-border)' }}>
                      <table className="w-full text-[11px] text-left border-collapse" style={{ backgroundColor: 'var(--bg-card)' }}>
                        <thead>
                          <tr className="text-[10px] font-bold border-b" style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                            <th className="p-2">Medicine</th>
                            <th className="p-2">Dosage</th>
                            <th className="p-2 text-right">Duration</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(typeof rx.medicines === 'string' ? JSON.parse(rx.medicines) : rx.medicines).map((m, idx) => (
                            <tr key={idx} className="border-b last:border-0" style={{ borderColor: 'rgba(30,41,59,0.3)' }}>
                              <td className="p-2 font-semibold">{m.name}</td>
                              <td className="p-2 font-mono" style={{ color: 'var(--color-text-muted)' }}>{m.dosage}</td>
                              <td className="p-2 text-right" style={{ color: 'var(--color-text-muted)' }}>{m.duration}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  {rx.notes && (
                    <div className="mt-2.5">
                      <p className="font-bold text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Doctor Notes</p>
                      <p className="italic mt-0.5" style={{ color: 'var(--color-text-high)' }}>"{rx.notes}"</p>
                    </div>
                  )}
                </div>
              ))}
              {patientHistoryList.length === 0 && (
                <p className="text-center py-12 text-xs" style={{ color: 'var(--color-text-muted)' }}>No prescriptions found for this patient.</p>
              )}
            </div>
            
            <div className="flex justify-end pt-4 border-t border-borderMuted/30 mt-4">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="px-6 py-2.5 rounded-full font-bold text-xs uppercase tracking-wider transition-all"
                style={{ backgroundColor: 'var(--color-accent)', color: '#020617' }}
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
