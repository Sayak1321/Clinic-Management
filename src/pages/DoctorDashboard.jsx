import { useState, useEffect, useCallback, useRef } from 'react';
import supabase from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import TokenQueue from '../components/TokenQueue';
import { generatePrescriptionPDF } from '../lib/pdfPrescription';

const EMPTY_RX = { diagnosis: '', medicines: [{ name: '', dosage: '', duration: '' }], notes: '', report: '' };

export default function DoctorDashboard() {
  const { user: authUser, logout } = useAuth();
  const user = authUser || {
    id: 'd0000000-0000-0000-0000-000000000000',
    name: 'Guest Doctor',
    email: 'doctor@cliniq.com',
    role: 'doctor',
    is_available: true
  };
  const { settings } = useSettings();
  const { addToast } = useToast();
  const today = new Date().toISOString().split('T')[0];

  // --- Queue State ---
  const [tokens, setTokens] = useState([]);
  const [active, setActive] = useState(null); // Selected token
  const [filterMode, setFilterMode] = useState('my'); // 'my' or 'all'

  // --- Prescription Form State ---
  const [rx, setRx] = useState(EMPTY_RX);
  const [saving, setSaving] = useState(false);
  const [justSavedRx, setJustSavedRx] = useState(null); // Track for A5 pdf download prompt

  // --- Patient History State ---
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [openHistoryIdx, setOpenHistoryIdx] = useState(null);
  
  // --- All Patients State ---
  const [allPatients, setAllPatients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [historyPatient, setHistoryPatient] = useState(null);

  // --- Doctor Availability State ---
  const [isAvailable, setIsAvailable] = useState(user?.is_available !== false);

  // --- Connection Status ---
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // --- Caseload Report State ---
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [caseloadTokens, setCaseloadTokens] = useState([]);
  const [caseloadNotes, setCaseloadNotes] = useState('');
  const [loadingCaseload, setLoadingCaseload] = useState(false);

  const saveButtonRef = useRef(null);

  // --- Fetching Queue Tokens ---
  const fetchTokens = useCallback(async () => {
    try {
      // Filter out done tokens
      let query = supabase
        .from('tokens')
        .select('*, patient:patients(*), doctor:profiles(*), receptionist:profiles(*)')
        .eq('date', today)
        .neq('status', 'done');
      
      // If filtering 'my', show tokens assigned to this doctor OR unassigned
      if (filterMode === 'my') {
        query = query.or(`doctor.eq.${user.id},doctor.is.null`);
      }

      const { data, error } = await query.order('token_number');
      if (error) throw error;

      // Map to expand format
      const mapped = (data || []).map(t => ({
        ...t,
        patient: t.patient?.id || t.patient,
        doctor: t.doctor?.id || t.doctor,
        receptionist: t.receptionist?.id || t.receptionist,
        expand: {
          patient: t.patient,
          doctor: t.doctor,
          receptionist: t.receptionist
        }
      }));
      setTokens(mapped);
    } catch (err) {
      console.error('Error fetching queue:', err);
    }
  }, [today, filterMode, user.id]);

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
    fetchAllPatients();

    const tokensChannel = supabase.channel('tokens-doctor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tokens' }, () => fetchTokens())
      .subscribe();

    const patientsChannel = supabase.channel('patients-doctor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, () => fetchAllPatients())
      .subscribe();

    return () => {
      supabase.removeChannel(tokensChannel);
      supabase.removeChannel(patientsChannel);
    };
  }, [fetchTokens, fetchAllPatients]);

  // Real-time listener for new token registration and queue shifts
  useEffect(() => {
    const channel = supabase.channel('tokens-doctor-queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tokens' }, async (payload) => {
        fetchTokens();
        if (payload.eventType === 'INSERT') {
          const newToken = payload.new;
          // Queue notification toast (P1 7.11)
          try {
            const { data: pat } = await supabase
              .from('patients')
              .select('name')
              .eq('id', newToken.patient)
              .single();
            if (pat) {
              addToast(`Token #${newToken.token_number} added for ${pat.name}`, 'info');
            } else {
              addToast(`Token #${newToken.token_number} added to the queue`, 'info');
            }
          } catch {
            addToast(`Token #${newToken.token_number} added to the queue`, 'info');
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTokens, addToast]);

  // --- Keyboard Shortcuts (P1 7.8) ---
  const selectNextWaitingToken = useCallback(() => {
    const nextToken = tokens.find(t => t.status === 'waiting');
    if (nextToken) {
      selectToken(nextToken);
      addToast(`Selected patient Token #${nextToken.token_number}`, 'info');
    } else {
      addToast('No waiting patients in the queue.', 'info');
    }
  }, [tokens]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        saveButtonRef.current?.click();
      } else if (e.ctrlKey && e.key === 'ArrowDown') {
        e.preventDefault();
        selectNextWaitingToken();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectNextWaitingToken]);

  // --- Online Status Checker (P2 7.13) ---
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      addToast('Connection restored.', 'success');
    };
    const handleOffline = () => {
      setIsOnline(false);
      addToast('Network connection lost! Queue updates paused.', 'error');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [addToast]);

  // --- Loading Visit History (P0 7.1) ---
  useEffect(() => {
    if (!historyPatient) {
      setHistory([]);
      return;
    }
    const loadHistory = async () => {
      setHistoryLoading(true);
      try {
        const { data: res, error } = await supabase
          .from('prescriptions')
          .select('*, doctor:profiles(*), token:tokens(*), patient:patients(*)')
          .eq('patient', historyPatient.id)
          .order('created_at', { ascending: false });
        if (error) throw error;

        const mapped = (res || []).map(p => ({
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
        // Limit to 5 visits
        setHistory(mapped.slice(0, 5));
      } catch (err) {
        console.error('Error fetching patient history:', err);
      } finally {
        setHistoryLoading(false);
      }
    };
    loadHistory();
  }, [historyPatient]);

  const openCaseloadReport = async () => {
    setLoadingCaseload(true);
    setReportModalOpen(true);
    try {
      const { data, error } = await supabase
        .from('tokens')
        .select('*, patient:patients(*), doctor:profiles(*)')
        .eq('date', today)
        .eq('doctor', user.id)
        .order('token_number');
      if (error) throw error;
      
      const { data: prescriptions, error: pError } = await supabase
        .from('prescriptions')
        .select('*')
        .eq('doctor', user.id);
      if (pError) throw pError;

      const mapped = (data || []).map(t => {
        const p = (prescriptions || []).find(pr => pr.token === t.id);
        return {
          ...t,
          patientName: t.patient?.name || 'Unknown',
          patientPhone: t.patient?.phone || '',
          chiefComplaint: t.chief_complaint || '—',
          diagnosis: p ? p.diagnosis : (t.status === 'done' ? 'Completed' : 'Pending')
        };
      });

      setCaseloadTokens(mapped);
    } catch (err) {
      console.error(err);
      addToast('Failed to load caseload statistics.', 'error');
    } finally {
      setLoadingCaseload(false);
    }
  };

  const handleDownloadCaseloadReport = () => {
    let content = `CLINIQ DAILY CASELOAD SUMMARY REPORT\n`;
    content += `=====================================\n`;
    content += `Doctor: Dr. ${user.name}\n`;
    content += `Date: ${new Date().toLocaleDateString('en-IN')}\n`;
    content += `Total Patients Assigned: ${caseloadTokens.length}\n`;
    content += `Completed: ${caseloadTokens.filter(t => t.status === 'done').length}\n`;
    content += `In Progress: ${caseloadTokens.filter(t => t.status === 'in_progress').length}\n`;
    content += `Waiting: ${caseloadTokens.filter(t => t.status === 'waiting').length}\n\n`;

    content += `GENERAL COMMENTS & CLINICAL SUMMARY:\n`;
    content += `------------------------------------\n`;
    content += `${caseloadNotes || 'No notes added.'}\n\n`;

    content += `PATIENT LIST:\n`;
    content += `-------------\n`;
    caseloadTokens.forEach((t, i) => {
      content += `${i + 1}. Token #${t.token_number} - ${t.patientName} (${t.patientPhone})\n`;
      content += `   Status: ${t.status.toUpperCase()}\n`;
      content += `   Chief Complaint: ${t.chiefComplaint}\n`;
      content += `   Diagnosis: ${t.diagnosis || '—'}\n\n`;
    });

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `caseload-report-${today}-${user.name.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addToast('Caseload report downloaded successfully!', 'success');
  };

  // --- Queue Actions ---
  const selectToken = async (token) => {
    setJustSavedRx(null);
    setActive(token);
    setRx({ diagnosis: '', medicines: [{ name: '', dosage: '', duration: '' }], notes: '', report: '' });
    setHistoryPatient(token.expand?.patient || null);
    
    // Mark as in_progress on selection (P1 7.6)
    if (token.status === 'waiting') {
      try {
        const { error } = await supabase
          .from('tokens')
          .update({
            status: 'in_progress',
            doctor: user.id
          })
          .eq('id', token.id);
        if (error) throw error;
        addToast(`Patient token #${token.token_number} is now in consultation.`);
      } catch (err) {
        addToast('Failed to update token status.', 'error');
      }
    }
  };

  const handleSelectHistoryPatient = (patient) => {
    setJustSavedRx(null);
    setActive(null);
    setHistoryPatient(patient);
    setOpenHistoryIdx(null);
  };

  // --- Prescription Actions ---
  const addMedicine = () => {
    setRx(r => ({ ...r, medicines: [...r.medicines, { name: '', dosage: '', duration: '' }] }));
  };

  const removeMedicine = (idx) => {
    setRx(r => ({
      ...r,
      medicines: r.medicines.filter((_, i) => i !== idx)
    }));
  };

  const updateMedicine = (i, field, value) => {
    setRx(r => {
      const meds = [...r.medicines];
      meds[i] = { ...meds[i], [field]: value };
      return { ...r, medicines: meds };
    });
  };

  const handleSavePrescription = async (e) => {
    e.preventDefault();
    if (!active) return;

    setSaving(true);
    try {
      const { data: savedPresc, error: prescError } = await supabase
        .from('prescriptions')
        .insert({
          token:     active.id,
          patient:   active.expand.patient.id,
          doctor:    user.id,
          medicines: rx.medicines.filter(m => m.name.trim()),
          diagnosis: rx.diagnosis,
          notes:     rx.notes,
          report:    rx.report
        })
        .select()
        .single();
      if (prescError) throw prescError;

      // Mark token done
      const { error: tokenError } = await supabase
        .from('tokens')
        .update({ status: 'done' })
        .eq('id', active.id);
      if (tokenError) throw tokenError;

      addToast('Prescription saved and token marked done.', 'success');

      // Keep details available for printing
      setJustSavedRx({
        token: active,
        patient: active.expand.patient,
        prescription: savedPresc,
        doctor: user
      });

      // Clear active selection but prompt print button
      setActive(null);
      setRx(EMPTY_RX);
    } catch (err) {
      console.error(err);
      addToast('Error saving prescription.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // --- Doctor Status Toggle (P2 7.15) ---
  const toggleAvailability = async () => {
    try {
      const nextVal = !isAvailable;
      const { error } = await supabase
        .from('profiles')
        .update({ is_available: nextVal })
        .eq('id', user.id);
      if (error) throw error;
      setIsAvailable(nextVal);
      addToast(`Status updated to: ${nextVal ? 'Accepting Patients' : 'On Break'}`, 'success');
    } catch (err) {
      addToast('Failed to update availability status.', 'error');
    }
  };


  // --- Trigger Rx Printing (P1 7.9) ---
  const handlePrintPrescription = (rxData) => {
    if (!rxData) return;
    generatePrescriptionPDF({
      token: rxData.token,
      patient: rxData.patient,
      prescription: rxData.prescription,
      doctor: rxData.doctor,
      clinicName: settings.clinic_name
    });
    addToast('Prescription downloaded successfully.');
  };

  return (
    <div className="min-h-screen bg-surface-100 flex flex-col font-sans">
      
      {/* Offline Alert Banner */}
      {!isOnline && (
        <div className="bg-red-600 text-white px-4 py-2 text-center text-xs font-semibold animate-pulse z-50 shadow-md">
          Connection lost — queue updates paused. Reconnecting…
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-surface-200 px-6 py-3 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-2">
          <svg className="w-6 h-6 text-primary-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          <span className="font-bold text-lg text-slate-800">{settings.clinic_name}</span>
          <span className="text-slate-400">|</span>
          <h1 className="text-slate-600 text-sm font-normal">Doctor Panel ({user?.name})</h1>
        </div>
        
        {/* Availability Toggle */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className={['w-2 h-2 rounded-full', isAvailable ? 'bg-green-500' : 'bg-slate-400'].join(' ')}></span>
            <button
              onClick={toggleAvailability}
              className={[
                'text-xs py-1 px-3.5 rounded-full border font-semibold transition-all shadow-sm',
                isAvailable
                  ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              ].join(' ')}
            >
              {isAvailable ? 'Accepting Patients' : 'On Break'}
            </button>
          </div>
          <button
            onClick={openCaseloadReport}
            className="text-xs py-1 px-3.5 rounded-full border border-primary-200 bg-primary-50 hover:bg-primary-100 text-primary-700 font-semibold transition-all shadow-sm"
          >
            My Patient Report
          </button>
          <button onClick={logout} className="btn-secondary text-xs py-1 px-3 border border-slate-200 hover:bg-slate-100">
            Sign out
          </button>
        </div>
      </header>

      {/* Main Grid Layout */}
      <div className="max-w-7xl w-full mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        
        {/* Left Column (Queue & Filter) - Span 4 */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          
          {/* Queue Filter Toggle (P1 7.6) */}
          <div className="card p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Queue View Filter</span>
              <span className="text-[10px] text-slate-400 bg-slate-100 py-0.5 px-2 rounded-full font-semibold" title="Ctrl+Down to pull next patient">
                Ctrl+Down for Next
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                onClick={() => setFilterMode('my')}
                className={[
                  'text-xs py-1.5 rounded-md font-semibold transition-all',
                  filterMode === 'my'
                    ? 'bg-primary-700 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                ].join(' ')}
              >
                My Patients Only
              </button>
              <button
                onClick={() => setFilterMode('all')}
                className={[
                  'text-xs py-1.5 rounded-md font-semibold transition-all',
                  filterMode === 'all'
                    ? 'bg-primary-700 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                ].join(' ')}
              >
                All Queue Patients
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-[450px]">
            <TokenQueue
              tokens={tokens}
              onSelectToken={selectToken}
              activeId={active?.id}
            />
          </div>

          {/* Registered Patients Card */}
          <div className="card flex flex-col max-h-[350px]">
            <h2 className="text-base font-bold text-slate-800 mb-2">Registered Patients</h2>
            <input
              type="text"
              placeholder="Search patients..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="input mb-2 text-xs"
            />
            <div className="overflow-y-auto space-y-1.5 flex-1 pr-1">
              {allPatients
                .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.phone.includes(searchQuery))
                .map(p => (
                  <div
                    key={p.id}
                    onClick={() => handleSelectHistoryPatient(p)}
                    className={[
                      'p-2 rounded-lg border text-xs cursor-pointer transition-all flex justify-between items-center',
                      historyPatient?.id === p.id && !active
                        ? 'bg-primary-50 border-primary-300 text-primary-900 font-semibold'
                        : 'bg-surface-50 border-surface-200 hover:border-primary-400 text-slate-700'
                    ].join(' ')}
                  >
                    <div>
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-[10px] text-slate-400">{p.phone}</p>
                    </div>
                    <span className="text-[10px] text-primary-700 bg-primary-50 px-2 py-0.5 rounded font-bold">
                      History
                    </span>
                  </div>
                ))}
              {allPatients.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.phone.includes(searchQuery)).length === 0 && (
                <p className="text-xs text-slate-400 text-center py-4">No patients found.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (Prescription Form & History) - Span 8 */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Print Rx Banner after saving */}
          {justSavedRx && (
            <div className="bg-green-50 border border-green-200 p-4 rounded-card flex justify-between items-center shadow-sm">
              <div>
                <p className="text-sm font-bold text-green-800">Prescription Saved Successfully!</p>
                <p className="text-xs text-green-600">Download and print the prescription slip for patient: {justSavedRx.patient.name}.</p>
              </div>
              <button
                onClick={() => handlePrintPrescription(justSavedRx)}
                className="btn-primary bg-green-600 hover:bg-green-700 flex items-center gap-1.5 text-xs py-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print prescription (Rx)
              </button>
            </div>
          )}

          {active ? (
            <div className="card flex-1 flex flex-col">
              
              {/* Patient header with Chief Complaint */}
              <div className="border-b border-surface-200 pb-3 mb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">
                      Token #{active.token_number} — {active.expand?.patient?.name}
                    </h2>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-slate-500">
                      <span>Phone: <span className="font-semibold">{active.expand?.patient?.phone}</span></span>
                      {active.expand?.patient?.dob && (
                        <span>DOB: <span className="font-semibold">{new Date(active.expand.patient.dob).toLocaleDateString('en-IN')}</span></span>
                      )}
                      {active.expand?.patient?.blood_group && (
                        <span>Blood Group: <span className="font-semibold text-primary-700 bg-primary-50 px-1.5 rounded">{active.expand.patient.blood_group}</span></span>
                      )}
                    </div>
                  </div>
                  <span className="badge-in_progress py-1 px-3 text-xs">Active Session</span>
                </div>

                {/* Chief Complaint Field display (P1 7.7) */}
                {active.chief_complaint && (
                  <div className="bg-primary-50/50 border border-primary-100 p-2.5 rounded-lg text-xs mt-3 flex items-start gap-2">
                    <span className="font-bold text-primary-800">Chief Complaint:</span>
                    <p className="text-slate-700 italic">{active.chief_complaint}</p>
                  </div>
                )}
              </div>

              {/* Form Scroll Container */}
              <form onSubmit={handleSavePrescription} className="space-y-4 flex-1 flex flex-col">
                
                {/* Diagnosis */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Diagnosis</label>
                  <textarea
                    className="input"
                    rows={2}
                    placeholder="Enter diagnosis description..."
                    value={rx.diagnosis}
                    onChange={e => setRx(r => ({ ...r, diagnosis: e.target.value }))}
                  />
                </div>

                {/* Medicines List */}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-slate-700">Medicines (Rx)</label>
                    <button
                      type="button"
                      onClick={addMedicine}
                      className="text-xs text-primary-700 hover:text-primary-800 font-bold flex items-center gap-1.5"
                    >
                      + Add Medicine
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {rx.medicines.map((m, i) => (
                      <div key={i} className="grid grid-cols-12 gap-2 bg-slate-50 p-2 border border-slate-200 rounded-lg items-center">
                        <input
                          className="input col-span-5 py-1 px-2 text-xs bg-white"
                          placeholder="Medicine name"
                          value={m.name}
                          onChange={e => updateMedicine(i, 'name', e.target.value)}
                          required
                        />
                        <input
                          className="input col-span-3 py-1 px-2 text-xs bg-white"
                          placeholder="Dosage (e.g. 1-0-1)"
                          value={m.dosage}
                          onChange={e => updateMedicine(i, 'dosage', e.target.value)}
                          required
                        />
                        <input
                          className="input col-span-3 py-1 px-2 text-xs bg-white"
                          placeholder="Duration (e.g. 5 days)"
                          value={m.duration}
                          onChange={e => updateMedicine(i, 'duration', e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => removeMedicine(i)}
                          className="col-span-1 text-red-500 hover:text-red-700 text-base font-bold text-center leading-none focus:outline-none"
                          disabled={rx.medicines.length <= 1}
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Additional Advice / Notes</label>
                  <textarea
                    className="input"
                    rows={2}
                    placeholder="Enter additional instructions..."
                    value={rx.notes}
                    onChange={e => setRx(r => ({ ...r, notes: e.target.value }))}
                  />
                </div>

                {/* Visit Report */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Short Report / Visit Summary</label>
                  <textarea
                    className="input"
                    rows={3}
                    placeholder="Enter short report summary on this visit..."
                    value={rx.report}
                    onChange={e => setRx(r => ({ ...r, report: e.target.value }))}
                  />
                </div>

                {/* Patient History Accordion panel (P0 7.1) */}
                <div className="border border-surface-200 rounded-card overflow-hidden">
                  <div className="bg-slate-50 p-2.5 border-b border-surface-200 flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-700">Patient History (Last 5 Visits)</span>
                    <span className="text-[10px] text-slate-400 bg-white py-0.5 px-2 rounded-full border font-semibold">
                      {history.length} Record{history.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  
                  {historyLoading ? (
                    <p className="text-xs text-slate-400 text-center py-4">Loading history...</p>
                  ) : history.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4 bg-white">No previous visits recorded.</p>
                  ) : (
                    <div className="divide-y divide-surface-200 bg-white">
                      {history.map((h, idx) => {
                        const isOpen = openHistoryIdx === idx;
                        const medicines = typeof h.medicines === 'string' ? JSON.parse(h.medicines) : h.medicines;

                        return (
                          <div key={h.id} className="text-xs">
                            <button
                              type="button"
                              onClick={() => setOpenHistoryIdx(isOpen ? null : idx)}
                              className="w-full text-left p-2.5 flex justify-between items-center font-medium text-slate-700 hover:bg-slate-50/50"
                            >
                              <span>Visit on {new Date(h.created).toLocaleDateString('en-IN')}</span>
                              <span className="text-[10px] text-primary-700 font-bold bg-primary-50 py-0.5 px-2 rounded">
                                {isOpen ? 'Hide Details' : 'View Details'}
                              </span>
                            </button>

                            {isOpen && (
                              <div className="p-3 bg-slate-50 border-t border-surface-150 space-y-2 text-[11px] text-slate-600">
                                {h.diagnosis && (
                                  <div>
                                    <span className="font-bold text-slate-700">Diagnosis: </span>
                                    <span>{h.diagnosis}</span>
                                  </div>
                                )}
                                <div>
                                  <p className="font-bold text-slate-700 mb-1">Medicines:</p>
                                  <ul className="space-y-1 bg-white p-2 rounded border border-slate-200/50">
                                    {medicines.map((m, mIdx) => (
                                      <li key={mIdx} className="list-disc list-inside">
                                        <span className="font-semibold text-slate-800">{m.name}</span> — {m.dosage} ({m.duration})
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                {h.notes && (
                                  <div>
                                    <span className="font-bold text-slate-700">Advice: </span>
                                    <span className="italic">{h.notes}</span>
                                  </div>
                                )}
                                {h.report && (
                                  <div className="mt-1 bg-amber-50/50 p-2 rounded border border-amber-100">
                                    <span className="font-bold text-slate-700">Short Report: </span>
                                    <span>{h.report}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer Controls */}
                <div className="flex justify-between items-center pt-3 border-t border-surface-100">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider" title="Press Ctrl+Enter to save">
                    Shortcut: Ctrl+Enter to Save
                  </span>
                  <button
                    ref={saveButtonRef}
                    type="submit"
                    className="btn-primary py-2 px-8"
                    disabled={saving}
                  >
                    {saving ? 'Saving…' : 'Save Prescription & Mark Done'}
                  </button>
                </div>
              </form>
            </div>
          ) : historyPatient ? (
            <div className="card flex-1 flex flex-col">
              
              {/* Patient header */}
              <div className="border-b border-surface-200 pb-3 mb-4 flex justify-between items-start">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    Patient Profile: {historyPatient.name}
                  </h2>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-slate-500">
                    <span>Phone: <span className="font-semibold">{historyPatient.phone}</span></span>
                    {historyPatient.dob && (
                      <span>DOB: <span className="font-semibold">{new Date(historyPatient.dob).toLocaleDateString('en-IN')}</span></span>
                    )}
                    {historyPatient.blood_group && (
                      <span>Blood Group: <span className="font-semibold text-primary-700 bg-primary-50 px-1.5 rounded">{historyPatient.blood_group}</span></span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setHistoryPatient(null)}
                  className="text-xs text-red-500 hover:text-red-700 font-semibold"
                >
                  Close Profile
                </button>
              </div>

              {/* Patient History Accordion panel (P0 7.1) */}
              <div className="border border-surface-200 rounded-card overflow-hidden">
                <div className="bg-slate-50 p-2.5 border-b border-surface-200 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-700">Patient History (Last 5 Visits)</span>
                  <span className="text-[10px] text-slate-400 bg-white py-0.5 px-2 rounded-full border font-semibold">
                    {history.length} Record{history.length !== 1 ? 's' : ''}
                  </span>
                </div>
                
                {historyLoading ? (
                  <p className="text-xs text-slate-400 text-center py-4">Loading history...</p>
                ) : history.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4 bg-white">No previous visits recorded.</p>
                ) : (
                  <div className="divide-y divide-surface-200 bg-white">
                    {history.map((h, idx) => {
                      const isOpen = openHistoryIdx === idx;
                      const medicines = typeof h.medicines === 'string' ? JSON.parse(h.medicines) : h.medicines;

                      return (
                        <div key={h.id} className="text-xs">
                          <button
                            type="button"
                            onClick={() => setOpenHistoryIdx(isOpen ? null : idx)}
                            className="w-full text-left p-2.5 flex justify-between items-center font-medium text-slate-700 hover:bg-slate-50/50"
                          >
                            <span>Visit on {new Date(h.created_at || h.created).toLocaleDateString('en-IN')}</span>
                            <span className="text-[10px] text-primary-700 font-bold bg-primary-50 py-0.5 px-2 rounded">
                              {isOpen ? 'Hide Details' : 'View Details'}
                            </span>
                          </button>

                          {isOpen && (
                            <div className="p-3 bg-slate-50 border-t border-surface-150 space-y-2 text-[11px] text-slate-600">
                              {h.diagnosis && (
                                <div>
                                  <span className="font-bold text-slate-700">Diagnosis: </span>
                                  <span>{h.diagnosis}</span>
                                </div>
                              )}
                              <div>
                                <p className="font-bold text-slate-700 mb-1">Medicines:</p>
                                <ul className="space-y-1 bg-white p-2 rounded border border-slate-200/50">
                                  {medicines.map((m, mIdx) => (
                                    <li key={mIdx} className="list-disc list-inside">
                                      <span className="font-semibold text-slate-800">{m.name}</span> — {m.dosage} ({m.duration})
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              {h.notes && (
                                <div>
                                  <span className="font-bold text-slate-700">Advice: </span>
                                  <span className="italic">{h.notes}</span>
                                </div>
                              )}
                              {h.report && (
                                <div className="mt-1 bg-amber-50/50 p-2 rounded border border-amber-100">
                                  <span className="font-bold text-slate-700">Short Report: </span>
                                  <span>{h.report}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card flex-1 flex flex-col items-center justify-center py-20 text-slate-400">
              <svg className="w-12 h-12 text-slate-300 mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
              </svg>
              <h3 className="text-sm font-semibold text-slate-500 mb-1">No Active Patient</h3>
              <p className="text-xs text-slate-400 text-center max-w-xs px-4">
                Select a waiting or in-progress patient from the queue to start writing prescriptions, or select a registered patient from the directory to view their history.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Caseload Report Modal */}
      {reportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setReportModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <div className="bg-primary-900 text-white p-4 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg">My Caseload & Patient Report</h3>
                <p className="text-xs text-primary-200">Summary of patients assigned to you today ({today})</p>
              </div>
              <button
                onClick={() => setReportModalOpen(false)}
                className="text-white/80 hover:text-white text-xl font-bold"
              >
                &times;
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {loadingCaseload ? (
                <p className="text-sm text-slate-500 text-center py-12">Loading caseload data...</p>
              ) : (
                <>
                  {/* Summary Stats */}
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <p className="text-xl font-bold text-slate-800">{caseloadTokens.length}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Assigned</p>
                    </div>
                    <div className="bg-green-50 p-2.5 rounded-lg border border-green-100">
                      <p className="text-xl font-bold text-green-700">{caseloadTokens.filter(t => t.status === 'done').length}</p>
                      <p className="text-[10px] text-green-600 uppercase tracking-wider font-semibold">Completed</p>
                    </div>
                    <div className="bg-blue-50 p-2.5 rounded-lg border border-blue-100">
                      <p className="text-xl font-bold text-blue-700">{caseloadTokens.filter(t => t.status === 'in_progress').length}</p>
                      <p className="text-[10px] text-blue-600 uppercase tracking-wider font-semibold">Active</p>
                    </div>
                    <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-100">
                      <p className="text-xl font-bold text-amber-700">{caseloadTokens.filter(t => t.status === 'waiting').length}</p>
                      <p className="text-[10px] text-amber-600 uppercase tracking-wider font-semibold">Waiting</p>
                    </div>
                  </div>

                  {/* General Report/Clinical comments */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">General Notes / Summary Report Remarks</label>
                    <textarea
                      value={caseloadNotes}
                      onChange={e => setCaseloadNotes(e.target.value)}
                      className="input"
                      rows={3}
                      placeholder="Write a brief general summary report on today's cases..."
                    />
                  </div>

                  {/* Patient List */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">Patients Summary List</h4>
                    <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-150 text-xs">
                      {caseloadTokens.map((t, idx) => (
                        <div key={t.id} className="p-3 flex justify-between items-center bg-slate-50/50 hover:bg-slate-50">
                          <div>
                            <p className="font-semibold text-slate-800">Token #{t.token_number} - {t.patientName}</p>
                            <p className="text-[10px] text-slate-500">Complaint: {t.chiefComplaint}</p>
                            {t.diagnosis && <p className="text-[10px] text-primary-700 font-semibold mt-0.5">Diagnosis: {t.diagnosis}</p>}
                          </div>
                          <span className={[
                            'px-2 py-0.5 rounded text-[10px] font-bold',
                            t.status === 'done' ? 'bg-green-100 text-green-700' :
                            t.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                            'bg-amber-100 text-amber-700'
                          ].join(' ')}>{t.status.toUpperCase()}</span>
                        </div>
                      ))}
                      {caseloadTokens.length === 0 && (
                        <p className="text-slate-400 text-center py-6">No patients assigned to you today.</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setReportModalOpen(false)}
                className="btn-secondary text-xs px-4 py-2 border border-slate-200 hover:bg-slate-100"
              >
                Close
              </button>
              <button
                onClick={handleDownloadCaseloadReport}
                disabled={caseloadTokens.length === 0}
                className="btn-primary text-xs px-5 py-2"
              >
                Download Report (.TXT)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
