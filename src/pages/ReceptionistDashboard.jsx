import { useState, useEffect, useCallback, useRef } from 'react';
import supabase from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import TokenQueue from '../components/TokenQueue';
import ConfirmDialog from '../components/ConfirmDialog';
import { generateBillPDF } from '../lib/pdfBill';

export default function ReceptionistDashboard() {
  console.log('[ReceptionistDashboard] rendering');
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const { addToast } = useToast();
  const today = new Date().toISOString().split('T')[0];

  // --- State Variables ---
  const [form, setForm] = useState({ name: '', phone: '', dob: '', address: '', blood_group: '', chief_complaint: '' });
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

  // Active Billing State
  const [activeTokenToBill, setActiveTokenToBill] = useState(null);
  const [billItems, setBillItems] = useState([]);
  const [billTotal, setBillTotal] = useState(0);

  // Search patients & History State
  const [searchQuery, setSearchQuery] = useState('');
  const [foundPatients, setFoundPatients] = useState([]);
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
        .select('*, patient:patients(*), doctor:profiles(*)')
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

  useEffect(() => {
    fetchTokens();
    fetchBills();
    fetchDoctors();

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

    return () => {
      supabase.removeChannel(tokensChannel);
      supabase.removeChannel(billsChannel);
      supabase.removeChannel(profilesChannel);
    };
  }, [fetchTokens, fetchBills, fetchDoctors]);

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
    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('patients')
          .select('*')
          .ilike('phone', `%${form.phone}%`)
          .limit(5);
        if (error) throw error;
        setSuggestions(data || []);
      } catch (err) {
        console.error(err);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [form.phone]);

  const handleSelectSuggestion = (patient) => {
    setForm({
      name: patient.name,
      phone: patient.phone,
      dob: patient.dob ? patient.dob.split('T')[0] : '',
      address: patient.address || '',
      blood_group: patient.blood_group || '',
      chief_complaint: form.chief_complaint
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
          chief_complaint: form.chief_complaint
        });
      if (insertErr) throw insertErr;

      addToast(`Token #${nextTokenNum} successfully assigned to ${patient.name}!`);
      
      // Reset form
      setForm({ name: '', phone: '', dob: '', address: '', blood_group: '', chief_complaint: '' });
      setConfirmRevisitOpen(false);
      setRevisitPatientData(null);
    } catch (err) {
      console.error(err);
      addToast('Failed to assign token.', 'error');
    }
  };

  // --- Patient Search & Visit History Panel (P0 7.5) ---
  const handlePatientSearch = async (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (val.trim().length < 2) {
      setFoundPatients([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .or(`name.ilike.%${val}%,phone.ilike.%${val}%`);
      if (error) throw error;
      setFoundPatients(data || []);
    } catch (err) {
      console.error(err);
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

  const summary = getDailySummary();
  const paidTokenIds = new Set(bills.filter(b => b.paid).map(b => b.token));
  const unpaidTokenIds = new Set(bills.filter(b => !b.paid).map(b => b.token));

  return (
    <div className="min-h-screen bg-surface-100 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-surface-200 px-6 py-3 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-2">
          <svg className="w-6 h-6 text-primary-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <span className="font-bold text-lg text-slate-800">{settings.clinic_name}</span>
          <span className="text-slate-400">|</span>
          <h1 className="text-slate-600 text-sm font-normal">Receptionist Portal ({user?.name})</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs bg-slate-50 border border-slate-200 py-1 px-3 rounded-full">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-ping"></span>
            <span className="font-medium text-slate-600">SSE Active</span>
          </div>
          <button onClick={logout} className="btn-secondary text-xs py-1 px-3 border border-slate-200 hover:bg-slate-100">
            Sign out
          </button>
        </div>
      </header>

      {/* Main Grid Layout */}
      <div className="max-w-7xl w-full mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        
        {/* Left Column (Forms & Search) - Span 4 */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Register Patient Card */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-800">Register Walk-in</h2>
              <span className="text-[10px] text-slate-400 font-semibold bg-slate-100 py-0.5 px-2 rounded-full" title="Press Ctrl+N to focus phone field">
                Ctrl+N to Focus
              </span>
            </div>

            <form onSubmit={handleAssignToken} className="space-y-3">
              <div className="relative">
                <input
                  ref={phoneInputRef}
                  className="input"
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
                    className="absolute z-20 w-full mt-1 bg-white border border-surface-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
                  >
                    {suggestions.map((p, idx) => (
                      <li
                        key={p.id}
                        onClick={() => handleSelectSuggestion(p)}
                        className={[
                          'p-2.5 text-xs cursor-pointer border-b border-surface-50 last:border-0 transition-colors flex justify-between items-center',
                          idx === highlightIndex ? 'bg-primary-50 text-primary-900 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                        ].join(' ')}
                      >
                        <div>
                          <p className="font-bold">{p.name}</p>
                          <p className="text-[10px] text-slate-400">{p.phone}</p>
                        </div>
                        <span className="text-[10px] bg-primary-100 text-primary-700 font-bold px-2 py-0.5 rounded-full">
                          Select
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <input
                className="input"
                placeholder="Patient Name *"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
              />

              <div className="grid grid-cols-2 gap-2">
                <input
                  className="input text-xs"
                  type="date"
                  placeholder="DOB"
                  value={form.dob}
                  onChange={e => setForm(f => ({ ...f, dob: e.target.value }))}
                  title="Date of birth"
                />
                <select
                  className="input text-xs"
                  value={form.blood_group}
                  onChange={e => setForm(f => ({ ...f, blood_group: e.target.value }))}
                >
                  <option value="">Blood Group</option>
                  {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(bg => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>

              <input
                className="input"
                placeholder="Address"
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              />

              <input
                className="input"
                placeholder="Chief Complaint / Notes"
                value={form.chief_complaint}
                onChange={e => setForm(f => ({ ...f, chief_complaint: e.target.value }))}
              />

              <button type="submit" className="btn-primary w-full mt-2" disabled={submitting}>
                {submitting ? 'Assigning…' : 'Assign Token & Register'}
              </button>
            </form>
          </div>

          {/* Patient Lookup & History Panel */}
          <div className="card">
            <h2 className="text-base font-bold text-slate-800 mb-3">Lookup Patient & History</h2>
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={handlePatientSearch}
              className="input mb-3"
            />
            {foundPatients.length > 0 ? (
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {foundPatients.map(p => (
                  <div
                    key={p.id}
                    onClick={() => handleViewPatientHistory(p)}
                    className="flex justify-between items-center p-2 rounded-lg bg-surface-50 border border-surface-200 hover:border-primary-400 cursor-pointer transition-all"
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-800">{p.name}</p>
                      <p className="text-[10px] text-slate-500">{p.phone}</p>
                    </div>
                    <span className="text-[10px] text-primary-700 bg-primary-50 px-2 py-0.5 rounded font-bold">
                      History
                    </span>
                  </div>
                ))}
              </div>
            ) : searchQuery.trim().length >= 2 ? (
              <p className="text-xs text-slate-400 text-center py-4">No matching records found.</p>
            ) : (
              <p className="text-[11px] text-slate-400 text-center py-2">
                Type 2+ letters to search patient directory
              </p>
            )}
          </div>

          {/* Doctor Availability display */}
          <div className="card">
            <h2 className="text-base font-bold text-slate-800 mb-3">On-Duty Doctors</h2>
            <div className="space-y-2">
              {doctorsList.map(doc => (
                <div key={doc.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                  <div className="flex items-center gap-2">
                    <span className={['w-2 h-2 rounded-full', doc.is_available ? 'bg-green-500' : 'bg-slate-400'].join(' ')}></span>
                    <span className="font-semibold text-slate-800">Dr. {doc.name}</span>
                  </div>
                  <span className={['px-2 py-0.5 rounded text-[10px] font-bold', doc.is_available ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'].join(' ')}>
                    {doc.is_available ? 'Available' : 'On Break'}
                  </span>
                </div>
              ))}
              {doctorsList.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-2">No doctors configured.</p>
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
          />
        </div>

        {/* Right Column (Unpaid Bills & Summary) - Span 3 */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          
          {/* Daily Summary statistics */}
          <div className="card bg-gradient-to-br from-primary-900 to-primary-850 text-white border-0 shadow-lg">
            <h2 className="text-sm font-bold opacity-80 uppercase tracking-wider mb-3">Today's Clinic Summary</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-2xl font-bold">{summary.totalSeen}</p>
                <p className="text-xs opacity-75">Patients Seen</p>
              </div>
              <div>
                <p className="text-2xl font-bold">₹{summary.totalBilled}</p>
                <p className="text-xs opacity-75">Total Billed</p>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-white/20 pt-3">
              <div>
                <span className="text-sm font-bold text-amber-300">{summary.unpaidCount}</span>
                <span className="text-xs opacity-75 ml-1">Unpaid Bills</span>
              </div>
              <button
                onClick={handleDownloadDayReport}
                className="bg-white/10 hover:bg-white/20 transition-all text-xs py-1.5 px-3 rounded-lg border border-white/10 flex items-center gap-1 font-semibold"
              >
                CSV Report
              </button>
            </div>
          </div>

          {/* Unpaid Bills Sidebar Tracker */}
          <div className="card flex-1 flex flex-col min-h-[300px]">
            <h2 className="text-base font-bold text-slate-800 mb-3 pb-1 border-b border-surface-100 flex items-center justify-between">
              <span>Unpaid Bills</span>
              <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                {bills.filter(b => !b.paid).length} Unpaid
              </span>
            </h2>
            <div className="space-y-2 overflow-y-auto flex-1 pr-1 max-h-[400px]">
              {bills.filter(b => !b.paid).map(bill => (
                <div
                  key={bill.id}
                  className="p-3 rounded-lg bg-red-50/50 border border-red-100 flex flex-col gap-1.5 transition-all text-xs"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-slate-800">{bill.expand?.patient?.name}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Token #{bill.expand?.token?.token_number}</p>
                    </div>
                    <span className="font-bold text-red-700 bg-red-100/50 px-2 py-0.5 rounded">
                      ₹{bill.total}
                    </span>
                  </div>
                  <button
                    onClick={() => handleMarkBillPaid(bill.id)}
                    className="btn-primary w-full bg-red-600 hover:bg-red-700 text-[10px] py-1 shadow-sm mt-1"
                  >
                    Mark Paid
                  </button>
                </div>
              ))}
              {bills.filter(b => !b.paid).length === 0 && (
                <p className="text-slate-400 text-center py-12 flex items-center justify-center flex-1 h-full">
                  All bills cleared!
                </p>
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
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-lg bg-white p-6 rounded-card shadow-2xl relative max-h-[90vh] flex flex-col">
            <button
              onClick={() => setActiveTokenToBill(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold text-2xl"
            >
              &times;
            </button>
            <h2 className="text-lg font-bold text-slate-800 mb-1">
              Create Invoice
            </h2>
            <p className="text-xs text-slate-500 mb-4 border-b border-surface-100 pb-2">
              Patient: <span className="font-bold text-slate-700">{activeTokenToBill.expand?.patient?.name}</span> (Token #{activeTokenToBill.token_number})
            </p>

            <form onSubmit={handleCreateBill} className="space-y-4 flex-1 flex flex-col overflow-hidden">
              
              {/* Presets Row */}
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-1.5">Quick Presets</p>
                <div className="flex flex-wrap gap-1.5">
                  {BILL_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className="bg-slate-100 hover:bg-primary-50 hover:text-primary-700 text-slate-600 text-xs py-1 px-2.5 rounded border border-slate-200 transition-colors"
                    >
                      + {preset.description} (₹{preset.amount})
                    </button>
                  ))}
                </div>
              </div>

              {/* Items List */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[150px]">
                <p className="text-xs font-semibold text-slate-600 mb-1">Invoice Line Items</p>
                {billItems.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 border border-slate-200 rounded-lg">
                    <input
                      className="input col-span-7 py-1 px-2.5 text-xs bg-white"
                      placeholder="Item description"
                      value={item.description}
                      onChange={e => handleUpdateBillItem(idx, 'description', e.target.value)}
                      required
                    />
                    <input
                      type="number"
                      className="input col-span-3 py-1 px-2.5 text-xs bg-white"
                      placeholder="Amount"
                      value={item.amount || ''}
                      onChange={e => handleUpdateBillItem(idx, 'amount', e.target.value)}
                      required
                      min="0"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveBillRow(idx)}
                      className="col-span-2 text-red-500 hover:text-red-700 text-xs font-semibold py-1 bg-white border border-red-200 rounded hover:bg-red-50"
                      disabled={billItems.length <= 1}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddBillRow}
                  className="btn-secondary w-full text-xs py-1.5 border border-dashed border-primary-400 text-primary-700 hover:bg-primary-50"
                >
                  + Add Line Item
                </button>
              </div>

              {/* Total Summary */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 flex justify-between items-center text-sm font-semibold text-slate-800">
                <span>Grand Total</span>
                <span className="text-primary-700 text-lg">₹{billTotal}</span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-surface-100">
                <button
                  type="button"
                  onClick={() => setActiveTokenToBill(null)}
                  className="btn-secondary py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary py-2 px-6"
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
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-xl bg-white p-6 rounded-card shadow-2xl relative max-h-[85vh] flex flex-col">
            <button
              onClick={() => setShowHistoryModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold text-2xl"
            >
              &times;
            </button>
            <h2 className="text-lg font-bold text-slate-800 mb-1">
              Visit & Prescription History
            </h2>
            <p className="text-xs text-slate-500 mb-4 border-b border-surface-100 pb-2">
              Patient: <span className="font-bold text-slate-700">{historyPatient.name}</span> | Phone: {historyPatient.phone}
            </p>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {patientHistoryList.map((rx) => (
                <div key={rx.id} className="p-4 rounded-lg bg-surface-50 border border-surface-200">
                  <div className="flex justify-between items-start mb-2 border-b border-surface-100 pb-1.5 text-xs text-slate-500">
                    <span>Date: <span className="font-semibold text-slate-700">{new Date(rx.created).toLocaleDateString('en-IN')}</span></span>
                    <span>Doctor: <span className="font-semibold text-slate-700">Dr. {rx.expand?.doctor?.name || 'Unknown'}</span></span>
                  </div>
                  {rx.diagnosis && (
                    <div className="mb-2 text-xs">
                      <p className="font-bold text-slate-700">Diagnosis:</p>
                      <p className="text-slate-600 bg-white p-2 rounded border border-slate-100 mt-0.5">{rx.diagnosis}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-bold text-slate-700 mb-1">Medicines Prescribed:</p>
                    <table className="w-full text-[11px] text-left border-collapse bg-white rounded border border-slate-200/50">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                          <th className="p-1.5">Medicine</th>
                          <th className="p-1.5">Dosage</th>
                          <th className="p-1.5 text-right">Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(typeof rx.medicines === 'string' ? JSON.parse(rx.medicines) : rx.medicines).map((m, idx) => (
                          <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-55">
                            <td className="p-1.5 font-medium text-slate-800">{m.name}</td>
                            <td className="p-1.5 text-slate-600">{m.dosage}</td>
                            <td className="p-1.5 text-slate-600 text-right">{m.duration}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {rx.notes && (
                    <div className="mt-2 text-xs">
                      <p className="font-semibold text-slate-600">Doctor Notes:</p>
                      <p className="text-slate-500 italic mt-0.5">{rx.notes}</p>
                    </div>
                  )}
                </div>
              ))}
              {patientHistoryList.length === 0 && (
                <p className="text-slate-400 text-center py-12 text-sm">No prescriptions found for this patient.</p>
              )}
            </div>
            
            <div className="flex justify-end pt-4 border-t border-surface-100 mt-4">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="btn-primary py-2 px-6"
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
