import { useState, useEffect, useCallback, useRef } from 'react';
import supabase from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { generatePrescriptionPDF } from '../lib/pdfPrescription';

const EMPTY_RX = { diagnosis: '', medicines: [{ name: '', dosage: '', duration: '' }], notes: '', report: '' };

const ICD10_CODES = [
  { code: 'I10',    desc: 'Essential (primary) hypertension' },
  { code: 'E11.9',  desc: 'Type 2 diabetes mellitus without complications' },
  { code: 'J06.9',  desc: 'Acute upper respiratory infection, unspecified' },
  { code: 'M54.5',  desc: 'Low back pain, unspecified' },
  { code: 'K21.9',  desc: 'Gastro-esophageal reflux disease without esophagitis' },
  { code: 'N39.0',  desc: 'Urinary tract infection, site not specified' },
  { code: 'J45.909',desc: 'Unspecified asthma, uncomplicated' },
  { code: 'E78.5',  desc: 'Hyperlipidemia, unspecified' },
  { code: 'F41.1',  desc: 'Generalized anxiety disorder' },
  { code: 'M17.9',  desc: 'Osteoarthritis of knee, unspecified' },
  { code: 'R51',    desc: 'Headache, unspecified' },
  { code: 'J00',    desc: 'Acute nasopharyngitis (common cold)' },
  { code: 'K59.00', desc: 'Constipation, unspecified' },
  { code: 'R05.9',  desc: 'Cough, unspecified' },
];

const DRUG_INTERACTIONS = [
  { drugA: 'aspirin', drugB: 'warfarin', severity: 'Critical', message: 'Increased risk of severe gastrointestinal bleeding.' },
  { drugA: 'ibuprofen', drugB: 'aspirin', severity: 'High', message: 'Ibuprofen may decrease the cardioprotective effect of low-dose aspirin.' },
  { drugA: 'lisinopril', drugB: 'spironolactone', severity: 'Critical', message: 'Risk of severe hyperkalemia (high potassium levels).' },
  { drugA: 'sildenafil', drugB: 'nitroglycerin', severity: 'Fatal', message: 'Co-administration can cause severe, potentially fatal hypotension (low blood pressure).' },
  { drugA: 'warfarin', drugB: 'amiodarone', severity: 'High', message: 'Amiodarone increases warfarin concentration, enhancing anticoagulant effect and bleeding risk.' }
];

// Fix #9: robust date formatter that handles all ISO date strings
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

  // --- Queue State ---
  const [tokens, setTokens] = useState([]);
  const [active, setActive] = useState(null);
  const [filterMode, setFilterMode] = useState('my');

  // --- Allergies States ---
  const [isEditingAllergies, setIsEditingAllergies] = useState(false);
  const [patientAllergies, setPatientAllergies] = useState('');

  // --- Prescription Form State ---
  const [rx, setRx] = useState(EMPTY_RX);
  const [saving, setSaving] = useState(false);
  const [justSavedRx, setJustSavedRx] = useState(null);
  const [removingMedIdx, setRemovingMedIdx] = useState(null); // Fix #18: fade-out state

  // --- Patient History State ---
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [openHistoryIdx, setOpenHistoryIdx] = useState(null);

  // --- All Patients State ---
  const [allPatients, setAllPatients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [historyPatient, setHistoryPatient] = useState(null);

  // --- ICD-10 Search States ---
  const [icdSearch, setIcdSearch] = useState('');
  const [showIcdDropdown, setShowIcdDropdown] = useState(false);

  // --- Doctor Availability State ---
  const [isAvailable, setIsAvailable] = useState(user?.is_available !== false);

  // --- Connection Status ---
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // --- Caseload Report State ---
  const [caseloadTokens, setCaseloadTokens] = useState([]);
  const [caseloadNotes, setCaseloadNotes] = useState('');

  // --- UI Elements & Animation States ---
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [pulseWobble, setPulseWobble] = useState(0);
  const [selectedDrawerPrescription, setSelectedDrawerPrescription] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  // Fix #14: theme toggle rotation state
  const [themeToggleRotating, setThemeToggleRotating] = useState(false);

  const saveButtonRef = useRef(null);
  const searchInputRef = useRef(null);

  // --- Vitals wobble simulation ---
  useEffect(() => {
    const interval = setInterval(() => {
      setPulseWobble(Math.floor(Math.random() * 5) - 2);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // --- Unsaved Changes & Auto Draft Recovery ---
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      const isDirty = rx.diagnosis || rx.notes || rx.report || rx.medicines.some(m => m.name);
      if (active && isDirty) {
        e.preventDefault();
        e.returnValue = 'You have unsaved clinical encounter remarks. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [rx, active]);

  useEffect(() => {
    if (active) {
      localStorage.setItem(`cliniq_rx_draft_${active.id}`, JSON.stringify(rx));
    }
  }, [rx, active]);

  const handleSaveAllergies = async () => {
    if (!active) return;
    try {
      const { error } = await supabase
        .from('patients')
        .update({ allergies: patientAllergies })
        .eq('id', active.expand.patient.id);
      if (error) throw error;
      
      active.expand.patient.allergies = patientAllergies;
      setIsEditingAllergies(false);
      addToast('Patient allergy records updated.', 'success');
      fetchTokens();
    } catch (err) {
      console.error(err);
      addToast('Failed to update allergy records.', 'error');
    }
  };

  const getDrugInteractions = () => {
    const currentMeds = rx.medicines.map(m => m.name.toLowerCase().trim()).filter(Boolean);
    const warnings = [];

    for (let i = 0; i < currentMeds.length; i++) {
      for (let j = i + 1; j < currentMeds.length; j++) {
        const medA = currentMeds[i];
        const medB = currentMeds[j];
        const match = DRUG_INTERACTIONS.find(inter => 
          (inter.drugA === medA && inter.drugB === medB) || 
          (inter.drugA === medB && inter.drugB === medA)
        );
        if (match) {
          warnings.push({ type: 'Current Prescriptions', medA: currentMeds[i], medB: currentMeds[j], ...match });
        }
      }
    }

    if (history.length > 0) {
      const lastRx = history[0];
      const historyMedsRaw = lastRx.medicines ? (typeof lastRx.medicines === 'string' ? JSON.parse(lastRx.medicines) : lastRx.medicines) : [];
      const historyMeds = historyMedsRaw.map(m => m.name.toLowerCase().trim()).filter(Boolean);

      for (const medCurr of currentMeds) {
        for (const medHist of historyMeds) {
          if (medCurr === medHist) continue;
          const match = DRUG_INTERACTIONS.find(inter => 
            (inter.drugA === medCurr && inter.drugB === medHist) || 
            (inter.drugA === medHist && inter.drugB === medCurr)
          );
          if (match) {
            warnings.push({ type: 'Active Medical History', medA: medCurr, medB: medHist, ...match });
          }
        }
      }
    }

    return warnings;
  };

  // --- Fetching Queue Tokens ---
  const fetchTokens = useCallback(async () => {
    try {
      let query = supabase
        .from('tokens')
        .select('*, patient:patients(*), doctor:profiles!doctor(*), receptionist:profiles!receptionist(*)')
        .eq('date', today);

      if (filterMode === 'my') {
        query = query.or(`doctor.eq.${user.id},doctor.is.null`);
      }

      const { data, error } = await query.order('token_number');
      if (error) throw error;

      const mapped = (data || []).map(t => ({
        ...t,
        patient: t.patient?.id || t.patient,
        doctor:  t.doctor?.id  || t.doctor,
        receptionist: t.receptionist?.id || t.receptionist,
        expand: {
          patient:      t.patient,
          doctor:       t.doctor,
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

  const fetchCaseloadReport = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('tokens')
        .select('*, patient:patients(*), doctor:profiles!doctor(*)')
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
          patientName:   t.patient?.name  || 'Unknown',
          patientPhone:  t.patient?.phone || '',
          chiefComplaint: t.chief_complaint || '—',
          diagnosis: p ? p.diagnosis : (t.status === 'done' ? 'Completed' : 'Pending')
        };
      });
      setCaseloadTokens(mapped);
    } catch (err) {
      console.error('Error fetching caseload report:', err);
    }
  }, [today, user.id]);

  // Initial load with skeleton delay
  useEffect(() => {
    const loadAll = async () => {
      await Promise.all([fetchTokens(), fetchAllPatients(), fetchCaseloadReport()]);
      setTimeout(() => setLoading(false), 600);
    };
    loadAll();

    const tokensChannel = supabase.channel('tokens-doctor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tokens' }, () => {
        fetchTokens();
        fetchCaseloadReport();
      })
      .subscribe();

    const patientsChannel = supabase.channel('patients-doctor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, () => fetchAllPatients())
      .subscribe();

    return () => {
      supabase.removeChannel(tokensChannel);
      supabase.removeChannel(patientsChannel);
    };
  }, [fetchTokens, fetchAllPatients, fetchCaseloadReport]);

  // Real-time new token notification
  useEffect(() => {
    const channel = supabase.channel('tokens-doctor-queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tokens' }, async (payload) => {
        fetchTokens();
        fetchCaseloadReport();
        if (payload.eventType === 'INSERT') {
          const newToken = payload.new;
          try {
            const { data: pat } = await supabase
              .from('patients')
              .select('name')
              .eq('id', newToken.patient)
              .single();
            addToast(`Token #${newToken.token_number} added for ${pat?.name || 'a patient'}`, 'info');
          } catch {
            addToast(`Token #${newToken.token_number} added to queue`, 'info');
          }
        }
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchTokens, fetchCaseloadReport, addToast]);

  // --- Keyboard Shortcuts ---
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
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchModalOpen(prev => !prev);
      } else if (e.key === 'Escape') {
        setSearchModalOpen(false);
        setIsDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectNextWaitingToken]);

  // --- Online Status ---
  useEffect(() => {
    const handleOnline  = () => { setIsOnline(true);  addToast('Connection restored.', 'success'); };
    const handleOffline = () => { setIsOnline(false); addToast('Network connection lost! Queue updates paused.', 'error'); };
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [addToast]);

  // --- Loading Visit History ---
  useEffect(() => {
    if (!historyPatient) { setHistory([]); return; }
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
          doctor:  p.doctor?.id  || p.doctor,
          token:   p.token?.id   || p.token,
          expand: { patient: p.patient, doctor: p.doctor, token: p.token }
        }));
        setHistory(mapped.slice(0, 5));
      } catch (err) {
        console.error('Error fetching patient history:', err);
      } finally {
        setHistoryLoading(false);
      }
    };
    loadHistory();
  }, [historyPatient]);

  const handleDownloadCaseloadReport = () => {
    let content = `CLINIQ DAILY CASELOAD SUMMARY REPORT\n=====================================\n`;
    content += `Doctor: Dr. ${user.name}\nDate: ${new Date().toLocaleDateString('en-IN')}\n`;
    content += `Total: ${caseloadTokens.length} | Completed: ${caseloadTokens.filter(t=>t.status==='done').length} | In Progress: ${caseloadTokens.filter(t=>t.status==='in_progress').length} | Waiting: ${caseloadTokens.filter(t=>t.status==='waiting').length}\n\n`;
    content += `COMMENTS:\n${caseloadNotes || 'No notes added.'}\n\nPATIENT LIST:\n`;
    caseloadTokens.forEach((t, i) => {
      content += `${i+1}. Token #${t.token_number} - ${t.patientName} (${t.patientPhone})\n   Status: ${t.status.toUpperCase()}\n   Complaint: ${t.chiefComplaint}\n   Diagnosis: ${t.diagnosis||'—'}\n\n`;
    });
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `caseload-report-${today}-${user.name.replace(/\s+/g,'_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addToast('Caseload report downloaded!', 'success');
  };

  // --- Queue Actions ---
  const selectToken = async (token) => {
    setJustSavedRx(null);
    setActive(token);
    
    // Auto Recovery of Draft SOAP and prescriptions
    const draft = localStorage.getItem(`cliniq_rx_draft_${token.id}`);
    if (draft) {
      try {
        setRx(JSON.parse(draft));
        addToast(`Restored unsaved draft for Token #${token.token_number}`, 'info');
      } catch {
        setRx({ diagnosis: '', medicines: [{ name: '', dosage: '', duration: '' }], notes: '', report: '' });
      }
    } else {
      setRx({ diagnosis: '', medicines: [{ name: '', dosage: '', duration: '' }], notes: '', report: '' });
    }
    
    setHistoryPatient(token.expand?.patient || null);
    if (token.status === 'waiting') {
      try {
        const { error } = await supabase.from('tokens').update({ status: 'in_progress', doctor: user.id }).eq('id', token.id);
        if (error) throw error;
        addToast(`Patient token #${token.token_number} is now in consultation.`);
        fetchTokens();
      } catch {
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
  const addMedicine = () => setRx(r => ({ ...r, medicines: [...r.medicines, { name: '', dosage: '', duration: '' }] }));

  // Fix #18: animated removal
  const removeMedicine = (idx) => {
    setRemovingMedIdx(idx);
    setTimeout(() => {
      setRx(r => ({ ...r, medicines: r.medicines.filter((_, i) => i !== idx) }));
      setRemovingMedIdx(null);
    }, 280);
  };

  const updateMedicine = (i, field, value) => {
    setRx(r => {
      const meds = [...r.medicines];
      meds[i] = { ...meds[i], [field]: value };
      return { ...r, medicines: meds };
    });
  };

  const handleSavePrescription = async (e) => {
    if (e) e.preventDefault();
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

      const { error: tokenError } = await supabase
        .from('tokens')
        .update({ status: 'done' })
        .eq('id', active.id);
      if (tokenError) throw tokenError;

      // Clean up localStorage draft
      localStorage.removeItem(`cliniq_rx_draft_${active.id}`);

      addToast('Prescription saved and token marked done.', 'success');
      setJustSavedRx({ token: active, patient: active.expand.patient, prescription: savedPresc, doctor: user });
      setActive(null);
      setRx(EMPTY_RX);
      fetchTokens();
      fetchCaseloadReport();
    } catch (err) {
      console.error(err);
      addToast('Error saving prescription.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // --- Doctor Status Toggle ---
  const toggleAvailability = async () => {
    try {
      const nextVal = !isAvailable;
      const { error } = await supabase.from('profiles').update({ is_available: nextVal }).eq('id', user.id);
      if (error) throw error;
      setIsAvailable(nextVal);
      addToast(`Status: Dr. ${user.name} is ${nextVal ? 'Accepting Patients' : 'On Break'}`, 'success');
    } catch {
      addToast('Failed to update availability.', 'error');
    }
  };

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

  // --- SOAP Notes Toolbar ---
  const insertMarkdown = (tag) => {
    const textarea = document.getElementById('clinical-soap-textarea');
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end   = textarea.selectionEnd;
    const text  = textarea.value;
    const selected = text.substring(start, end);
    let replacement = '';
    if (tag === 'bold')   replacement = `**${selected || 'bold text'}**`;
    else if (tag === 'italic') replacement = `*${selected || 'italic text'}*`;
    else if (tag === 'list')   replacement = `\n- ${selected || 'list item'}`;
    else if (tag === 'vitals') replacement = `\n- Temp: 98.6°F`;
    const newText = text.substring(0, start) + replacement + text.substring(end);
    setRx(prev => ({ ...prev, report: newText }));
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + replacement.length, start + replacement.length);
    }, 50);
  };

  const openPrescriptionDrawer = (pRx) => {
    setSelectedDrawerPrescription(pRx);
    setFollowUpDate('');
    setIsDrawerOpen(true);
  };

  const handleScheduleFollowUp = () => {
    if (!followUpDate) { addToast('Please select a valid follow-up date.', 'error'); return; }
    addToast(`Follow-up scheduled for ${new Date(followUpDate).toLocaleDateString('en-IN')}`, 'success');
    setIsDrawerOpen(false);
  };

  const getWaitTime = (createdAt) => {
    if (!createdAt) return '—';
    const diffMins = Math.floor((new Date() - new Date(createdAt)) / 60000);
    if (diffMins < 0)  return 'Just now';
    if (diffMins < 60) return `${diffMins}m wait`;
    return `${Math.floor(diffMins/60)}h ${diffMins%60}m`;
  };

  // Fix #14: Theme toggle with rotation
  const handleThemeToggle = () => {
    setThemeToggleRotating(true);
    setIsLightMode(v => !v);
    setTimeout(() => setThemeToggleRotating(false), 400);
  };

  // --- Skeleton Screen Loader ---
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col font-sans" style={{ backgroundColor: 'var(--bg-canvas)', color: 'var(--color-text-high)' }}>
        <header className="dashboard-header h-16 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--color-border)' }} />
            <div className="w-36 h-5 rounded animate-pulse" style={{ backgroundColor: 'var(--color-border)' }} />
          </div>
          <div className="w-96 h-9 rounded-full animate-pulse hidden md:block" style={{ backgroundColor: 'var(--color-border)', opacity: 0.6 }} />
          <div className="w-32 h-8 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-border)' }} />
        </header>
        <div className="flex flex-1 overflow-hidden">
          <div className="w-16 border-r py-6 flex flex-col items-center gap-6 shrink-0" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--color-border)' }}>
            {[1,2,3,4,5].map(i => (
              <div key={i} className="w-10 h-10 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-border)', opacity: 0.6 }} />
            ))}
          </div>
          <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-4 gap-6 overflow-y-auto">
            <div className="lg:col-span-1 space-y-4">
              <div className="h-6 rounded w-1/2 animate-pulse mb-3" style={{ backgroundColor: 'var(--color-border)' }} />
              {[1,2,3].map(i => (
                <div key={i} className="h-24 rounded-xl border p-4 space-y-2 animate-pulse" style={{ backgroundColor: 'var(--color-border)', opacity: 0.3, borderColor: 'var(--color-border)' }}>
                  <div className="h-4 rounded w-3/4" style={{ backgroundColor: 'var(--color-border)' }} />
                  <div className="h-3 rounded w-1/2" style={{ backgroundColor: 'var(--color-border)' }} />
                </div>
              ))}
            </div>
            <div className="lg:col-span-2 space-y-6">
              <div className="h-48 rounded-xl border p-6 space-y-3 animate-pulse" style={{ backgroundColor: 'var(--color-border)', opacity: 0.3, borderColor: 'var(--color-border)' }} />
              <div className="h-36 rounded-xl border animate-pulse" style={{ backgroundColor: 'var(--color-border)', opacity: 0.3, borderColor: 'var(--color-border)' }} />
              <div className="h-64 rounded-xl border animate-pulse" style={{ backgroundColor: 'var(--color-border)', opacity: 0.3, borderColor: 'var(--color-border)' }} />
            </div>
            <div className="lg:col-span-1 space-y-6">
              <div className="h-40 rounded-xl border animate-pulse" style={{ backgroundColor: 'var(--color-border)', opacity: 0.3, borderColor: 'var(--color-border)' }} />
              <div className="h-64 rounded-xl border p-4 space-y-4 animate-pulse" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--color-border)' }}>
                <div className="h-5 rounded w-2/3" style={{ backgroundColor: 'var(--color-border)' }} />
                {[1,2,3].map(i => <div key={i} className="h-9 rounded-lg" style={{ backgroundColor: 'var(--color-border)', opacity: 0.4 }} />)}
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }



  // --- Stat cards config ---
  const statCards = [
    { label: 'Total Patients', val: caseloadTokens.length,                                    colorCls: 'text-textHigh' },
    { label: 'Completed',      val: caseloadTokens.filter(t=>t.status==='done').length,        colorCls: 'text-emerald-400', primary: true },
    { label: 'Consulting',     val: caseloadTokens.filter(t=>t.status==='in_progress').length, colorCls: 'text-accent' },
    { label: 'Upcoming',       val: caseloadTokens.filter(t=>t.status==='waiting').length,     colorCls: 'text-amber-400' },
  ];

  return (
    <div
      className="min-h-screen flex flex-col font-sans antialiased overflow-hidden"
      style={{ backgroundColor: 'var(--bg-canvas)', color: 'var(--color-text-high)', transition: 'background-color 0.3s, color 0.3s' }}
    >

      {/* Offline Alert Banner */}
      {!isOnline && (
        <div className="px-4 py-2 text-center text-xs font-semibold animate-pulse flex items-center justify-center gap-2"
          style={{ backgroundColor: 'rgba(127,29,29,0.6)', borderBottom: '1px solid rgba(185,28,28,0.4)', color: '#fca5a5' }}>
          <span className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: '#ef4444', display: 'inline-block' }} />
          Clinical Network Connection Lost — Reconnecting…
        </div>
      )}

      {/* Header — Fix #4: shimmer gradient for visual depth */}
      <header className="dashboard-header h-16 flex items-center justify-between px-6 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-lg shadow-inner"
            style={{ backgroundColor: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', color: 'var(--color-accent)' }}>
            Q
          </div>
          <div>
            <span className="font-bold text-sm tracking-wide block" style={{ color: 'var(--color-text-high)' }}>{settings.clinic_name || 'CLINIQ'}</span>
            <span className="text-[10px] block" style={{ color: 'var(--color-text-muted)' }}>Doctor Portal · {user.name}</span>
          </div>
        </div>

        {/* Global Search trigger */}
        <div
          onClick={() => setSearchModalOpen(true)}
          className="rounded-full px-4 py-2 flex items-center justify-between cursor-pointer group hidden md:flex"
          style={{ backgroundColor: 'rgba(11,15,25,0.6)', border: '1px solid var(--color-border)', width: '24rem', transition: 'border-color 0.2s, background-color 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(56,189,248,0.4)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
        >
          <div className="flex items-center gap-2 text-xs select-none" style={{ color: 'var(--color-text-muted)' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span>Search patients globally...</span>
          </div>
          <kbd className="font-mono text-[9px] px-1.5 py-0.5 rounded select-none"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
            ⌘K
          </kbd>
        </div>

        <div className="flex items-center gap-4">
          {/* Fix #14: Theme toggle with rotation animation */}
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

          {/* Network status */}
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full relative flex">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isOnline ? 'bg-emerald-400' : 'bg-red-400'}`} style={{ backgroundColor: isOnline ? '#34d399' : '#f87171' }} />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: isOnline ? '#10b981' : '#ef4444' }} />
            </span>
            <span className="text-[10px] font-semibold tracking-wider uppercase hidden sm:inline" style={{ color: 'var(--color-text-muted)' }}>
              {isOnline ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left Sidebar — Fix #2: z-index isolation */}
        <aside className="w-16 border-r py-6 flex flex-col items-center justify-between shrink-0 h-full z-10"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--color-border)', transition: 'background-color 0.3s' }}>
          <div className="flex flex-col items-center gap-5 w-full">
            {[
              { id: 'dashboard', tooltip: 'Dashboard',         icon: <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" /> },
              { id: 'patients',  tooltip: 'Global Search',     icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />, onClick: () => setSearchModalOpen(true) },
              { id: 'calendar',  tooltip: 'Appointments',      icon: <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /> },
              { id: 'analytics', tooltip: 'Clinical Analytics', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /> },
              { id: 'settings',  tooltip: 'Preferences',       icon: <><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></> },
            ].map(item => (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick || (() => setActiveTab(item.id))}
                className="relative group w-10 h-10 rounded-xl flex items-center justify-center border transition-all"
                style={{
                  backgroundColor: activeTab === item.id && !item.onClick ? 'rgba(56,189,248,0.1)' : 'transparent',
                  borderColor: activeTab === item.id && !item.onClick ? 'rgba(56,189,248,0.3)' : 'transparent',
                  color: activeTab === item.id && !item.onClick ? 'var(--color-accent)' : 'var(--color-text-muted)',
                }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">{item.icon}</svg>
                <span className="absolute left-14 text-[11px] px-2 py-1 rounded shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all whitespace-nowrap z-50"
                  style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-high)' }}>
                  {item.tooltip}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-col items-center gap-5 w-full">
            {/* Availability */}
            <button type="button" onClick={toggleAvailability}
              className="relative group w-10 h-10 rounded-xl flex items-center justify-center transition-all"
              style={{ color: 'var(--color-text-muted)' }}>
              <span className="w-3 h-3 rounded-full" style={{
                backgroundColor: isAvailable ? '#10b981' : '#f59e0b',
                boxShadow: isAvailable ? '0 0 8px rgba(16,185,129,0.6)' : '0 0 8px rgba(245,158,11,0.6)'
              }} />
              <span className="absolute left-14 text-[11px] px-2 py-1 rounded shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all whitespace-nowrap z-50"
                style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-high)' }}>
                {isAvailable ? 'Accepting Patients' : 'On Break'}
              </span>
            </button>

            {/* Logout */}
            <button type="button" onClick={logout}
              className="relative group w-10 h-10 rounded-xl flex items-center justify-center transition-all"
              style={{ color: 'rgba(248,113,113,0.8)' }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="absolute left-14 text-[11px] px-2 py-1 rounded shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all whitespace-nowrap z-50"
                style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-high)' }}>
                Sign Out
              </span>
            </button>
          </div>
        </aside>

        {/* Main 4-column grid — Fix #1: lg:grid-cols-4 now has CSS rule */}
        <main className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 p-6 overflow-y-auto" style={{ transition: 'background-color 0.3s' }}>

          {/* ──────────────────────────────────────────────────
              COLUMN 1: Live Queue Hub
          ────────────────────────────────────────────────── */}
          <div className="lg:col-span-1 flex flex-col gap-4 min-h-0">
            <div className="rounded-2xl p-5 flex flex-col shadow-lg"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--color-border)', height: '100%', maxHeight: 'calc(100vh - 8.5rem)', transition: 'background-color 0.3s' }}>

              {/* Fix #6: Section header with accent underline */}
              <div className="pb-3 mb-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="section-title">Live Queue Hub</div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                    style={{ color: 'var(--color-text-muted)', backgroundColor: 'var(--bg-canvas)', border: '1px solid var(--color-border)' }}>
                    {tokens.filter(t => t.status !== 'done').length} Active
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg" style={{ backgroundColor: 'var(--bg-canvas)', border: '1px solid var(--color-border)' }}>
                  {['my', 'all'].map(mode => (
                    <button key={mode} type="button" onClick={() => setFilterMode(mode)}
                      className="text-[10px] py-1.5 rounded-md font-semibold transition-all"
                      style={{
                        backgroundColor: filterMode === mode ? 'rgba(56,189,248,0.15)' : 'transparent',
                        color: filterMode === mode ? 'var(--color-accent)' : 'var(--color-text-muted)',
                        border: filterMode === mode ? '1px solid rgba(56,189,248,0.2)' : '1px solid transparent',
                      }}>
                      {mode === 'my' ? 'My Cases' : 'All Directory'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Patient card list — Fix #5: status left accent stripes */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                {[...tokens]
                  .sort((a,b) => { const o = { waiting:0, in_progress:1, done:2 }; return o[a.status]-o[b.status]; })
                  .map(token => {
                    const isSelected = active?.id === token.id;
                    const waitText = getWaitTime(token.created_at);

                    let badgeLabel = 'Waiting';
                    let badgeStyle = { backgroundColor:'rgba(245,158,11,0.1)', color:'#f59e0b', border:'1px solid rgba(245,158,11,0.2)' };
                    let cardStatus = 'queue-card-waiting';
                    if (token.status === 'in_progress') {
                      badgeLabel = 'In Consult'; badgeStyle = { backgroundColor:'rgba(56,189,248,0.1)', color:'var(--color-accent)', border:'1px solid rgba(56,189,248,0.2)' }; cardStatus = 'queue-card-in-progress';
                    } else if (token.status === 'done') {
                      badgeLabel = 'Billing'; badgeStyle = { backgroundColor:'rgba(16,185,129,0.1)', color:'#10b981', border:'1px solid rgba(16,185,129,0.2)' }; cardStatus = 'queue-card-done';
                    }

                    return (
                      <div
                        key={token.id}
                        onClick={() => selectToken(token)}
                        className={`p-3.5 rounded-xl transition-all duration-200 cursor-pointer relative group flex flex-col gap-1.5 ${cardStatus}`}
                        style={{
                          border: isSelected ? '1px solid rgba(56,189,248,0.6)' : '1px solid var(--color-border)',
                          backgroundColor: isSelected ? 'rgba(56,189,248,0.04)' : 'rgba(11,15,25,0.3)',
                          boxShadow: isSelected ? '0 0 12px rgba(56,189,248,0.06)' : 'none',
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-5 h-5 shrink-0 rounded-full flex items-center justify-center font-bold text-[10px]"
                              style={{ backgroundColor:'var(--bg-card)', border:'1px solid var(--color-border)', color:'var(--color-text-high)' }}>
                              {token.token_number}
                            </span>
                            <h3 className="font-bold text-xs truncate" style={{ color:'var(--color-text-high)', maxWidth:'110px' }}>
                              {token.expand?.patient?.name || 'Unknown'}
                            </h3>
                          </div>
                          <span className="text-[8px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider" style={badgeStyle}>
                            {badgeLabel}
                          </span>
                        </div>

                        {/* Fix #10: Phone · wait time with separator dot */}
                        <div className="flex justify-between items-center text-[10px]" style={{ color:'var(--color-text-muted)' }}>
                          <span>{token.expand?.patient?.phone}</span>
                          <span className="font-mono text-[9px] px-1.5 rounded" style={{ color:'var(--color-accent)', backgroundColor:'rgba(56,189,248,0.05)' }}>{waitText}</span>
                        </div>

                        {token.chief_complaint && (
                          <p className="text-[10px] italic pt-1 mt-0.5 line-clamp-1" style={{ color:'var(--color-text-muted)', borderTop:'1px solid rgba(30,41,59,0.3)' }}>
                            {token.chief_complaint}
                          </p>
                        )}

                        {/* Fix #15: slide-in queue action buttons */}
                        <div className="queue-action-reveal absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 pl-2 shadow-md"
                          style={{ backgroundColor:'var(--bg-card)', borderLeft:'1px solid var(--color-border)' }}>
                          {token.status === 'waiting' ? (
                            <button type="button"
                              onClick={e => { e.stopPropagation(); selectToken(token); }}
                              className="px-2 py-1 rounded font-extrabold text-[10px] uppercase tracking-wider transition-all"
                              style={{ backgroundColor:'var(--color-accent)', color:'#020617' }}>
                              Call Next
                            </button>
                          ) : (
                            <button type="button"
                              onClick={e => { e.stopPropagation(); handleSelectHistoryPatient(token.expand?.patient); }}
                              className="px-2 py-1 rounded font-extrabold text-[10px] uppercase tracking-wider transition-all"
                              style={{ backgroundColor:'var(--bg-canvas)', border:'1px solid var(--color-border)', color:'var(--color-text-high)' }}>
                              View Chart
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                {/* Fix #16: Empty state with illustration */}
                {tokens.length === 0 && (
                  <div className="empty-queue-state">
                    <svg fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p>Queue is empty — patients appear once checked in by reception.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ──────────────────────────────────────────────────
              COLUMN 2 & 3: Clinical Metric Stream + EHR
          ────────────────────────────────────────────────── */}
          <div className="lg:col-span-2 flex flex-col gap-6 min-h-0">

            {/* Finalized Rx banner */}
            {justSavedRx && (
              <div className="rounded-2xl flex justify-between items-center shadow-lg p-4 animate-fadeIn"
                style={{ backgroundColor:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.2)' }}>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color:'#34d399' }}>Consultation Finalized</p>
                  <p className="text-[11px]" style={{ color:'var(--color-text-muted)' }}>A5 Prescription slip ready for {justSavedRx.patient.name}.</p>
                </div>
                <button type="button" onClick={() => handlePrintPrescription(justSavedRx)}
                  className="font-bold text-xs py-1.5 px-4 rounded-full flex items-center gap-1.5 shadow-sm transition-all"
                  style={{ backgroundColor:'var(--color-accent)', color:'#020617' }}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print Rx
                </button>
              </div>
            )}

            {active ? (
              /* Active Patient EHR Center */
              <div className="rounded-2xl p-6 flex flex-col gap-5 shadow-lg relative min-h-[500px]"
                style={{ backgroundColor:'var(--bg-card)', border:'1px solid var(--color-border)', transition:'background-color 0.3s' }}>

                {/* Patient Details Header — Fix #9: date format fixed, Fix #10: metadata separator */}
                <div className="pb-4" style={{ borderBottom:'1px solid var(--color-border)' }}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wide"
                          style={{ backgroundColor:'rgba(56,189,248,0.1)', color:'var(--color-accent)', border:'1px solid rgba(56,189,248,0.2)' }}>
                          TOKEN #{active.token_number}
                        </span>
                        <h2 className="text-xl font-extrabold" style={{ color:'var(--color-text-high)' }}>
                          {active.expand?.patient?.name}
                        </h2>
                      </div>
                      {/* Fix #10: separated metadata with · */}
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs" style={{ color:'var(--color-text-muted)' }}>
                        <span>DOB: <span className="font-semibold" style={{ color:'var(--color-text-high)' }}>{formatDate(active.expand?.patient?.dob)}</span></span>
                        <span style={{ color:'var(--color-border)' }}>·</span>
                        <span>Phone: <span className="font-semibold" style={{ color:'var(--color-text-high)' }}>{active.expand?.patient?.phone}</span></span>
                        {active.expand?.patient?.blood_group && (
                          <>
                            <span style={{ color:'var(--color-border)' }}>·</span>
                            <span>Blood: <span className="font-semibold px-2 py-0.5 rounded" style={{ color:'var(--color-text-high)', backgroundColor:'var(--bg-canvas)', border:'1px solid var(--color-border)' }}>{active.expand.patient.blood_group}</span></span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider animate-pulse"
                      style={{ color:'#10b981', backgroundColor:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.2)' }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor:'#10b981' }} />
                      Consultation
                    </span>
                  </div>

                  {/* Allergy Alert Banner — With Edit capability */}
                  <div className="rounded-xl p-3 text-xs mt-4 flex items-start gap-2.5 relative"
                    style={{ backgroundColor:'rgba(245,158,11,0.05)', border:'1px solid rgba(245,158,11,0.1)', color:'#f59e0b' }}>
                    <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color:'#fbbf24' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold block mb-0.5 uppercase tracking-wide text-[10px]">Clinical Allergy Warning</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (isEditingAllergies) {
                              handleSaveAllergies();
                            } else {
                              setPatientAllergies(active.expand?.patient?.allergies || '');
                              setIsEditingAllergies(true);
                            }
                          }}
                          className="text-[9px] hover:underline font-bold"
                          style={{ color: 'var(--color-accent)' }}
                        >
                          {isEditingAllergies ? 'Save ✓' : 'Edit ✎'}
                        </button>
                      </div>
                      {isEditingAllergies ? (
                        <div className="flex gap-2 mt-1.5">
                          <input
                            type="text"
                            value={patientAllergies}
                            onChange={e => setPatientAllergies(e.target.value)}
                            placeholder="Enter patient allergies..."
                            className="bg-canvas border border-borderMuted text-textHigh rounded-md px-2 py-1 text-[10px] flex-1 focus:outline-none focus:border-accent"
                          />
                          <button
                            type="button"
                            onClick={() => setIsEditingAllergies(false)}
                            className="text-[9px] hover:underline"
                            style={{ color: 'var(--color-text-muted)' }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px]" style={{ color:'var(--color-text-muted)' }}>
                          {active.expand?.patient?.allergies || 'No known medication allergies reported. Always check history files before advising prescription antibiotics.'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>



                {/* Medication History */}
                <div className="rounded-xl p-4" style={{ backgroundColor:'rgba(11,15,25,0.5)', border:'1px solid var(--color-border)' }}>
                  <div className="section-title mb-2">Medication History</div>
                  <div className="text-[11px] overflow-y-auto max-h-[120px] scrollbar-thin">
                    {history.length > 0 ? (() => {
                      const lastRx = history[0];
                      const lastMeds = lastRx.medicines ? (typeof lastRx.medicines === 'string' ? JSON.parse(lastRx.medicines) : lastRx.medicines) : [];
                      return (
                        <div className="space-y-1.5">
                          <p className="text-[9px] font-bold" style={{ color:'var(--color-accent)' }}>LAST VISIT ({formatDate(lastRx.created_at)}):</p>
                          {(lastMeds || []).map((m, mIdx) => (
                            <div key={mIdx} className="flex justify-between pb-1" style={{ borderBottom:'1px solid rgba(30,41,59,0.3)', color:'var(--color-text-high)' }}>
                              <span className="font-semibold">{m.name}</span>
                              <span className="font-mono text-[10px]" style={{ color:'var(--color-text-muted)' }}>{m.dosage} · {m.duration}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })() : (
                      <p className="italic text-center py-2" style={{ color:'var(--color-text-muted)' }}>No previously documented active medications.</p>
                    )}
                  </div>
                </div>

                {/* Historical Consultations */}
                <div className="rounded-xl overflow-hidden mt-1" style={{ border:'1px solid var(--color-border)' }}>
                  <div className="p-3 flex justify-between items-center" style={{ backgroundColor:'var(--bg-canvas)', borderBottom:'1px solid var(--color-border)' }}>
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color:'var(--color-text-high)' }}>Historical Records ({history.length})</span>
                    <span className="text-[10px]" style={{ color:'var(--color-text-muted)' }}>Last 5 Visits</span>
                  </div>
                  {historyLoading ? (
                    <p className="text-xs text-center py-4" style={{ color:'var(--color-text-muted)' }}>Loading clinical history...</p>
                  ) : history.length === 0 ? (
                    <p className="text-xs text-center py-4" style={{ color:'var(--color-text-muted)' }}>No previous clinical files found.</p>
                  ) : (
                    <div style={{ backgroundColor:'rgba(11,15,25,0.2)' }}>
                      {history.map((h, idx) => {
                        const isOpen = openHistoryIdx === idx;
                        const medicines = h.medicines ? (typeof h.medicines === 'string' ? JSON.parse(h.medicines) : h.medicines) : [];
                        return (
                          <div key={h.id} className="text-xs" style={{ borderTop: idx > 0 ? '1px solid rgba(30,41,59,0.6)' : 'none' }}>
                            <button type="button" onClick={() => setOpenHistoryIdx(isOpen ? null : idx)}
                              className="w-full text-left p-3 flex justify-between items-center font-medium transition-colors"
                              style={{ color:'var(--color-text-high)' }}>
                              <span>Consultation on {formatDate(h.created_at)}</span>
                              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded"
                                style={{ color:'var(--color-accent)', backgroundColor:'rgba(56,189,248,0.1)', border:'1px solid rgba(56,189,248,0.2)' }}>
                                {isOpen ? 'Collapse' : 'Expand'}
                              </span>
                            </button>
                            {isOpen && (
                              <div className="p-4 space-y-3 text-[11px] animate-fadeIn"
                                style={{ borderTop:'1px solid var(--color-border)', backgroundColor:'rgba(11,15,25,0.5)', color:'var(--color-text-high)' }}>
                                {h.diagnosis && <div><span className="font-bold" style={{ color:'var(--color-text-muted)' }}>Diagnosis: </span><span>{h.diagnosis}</span></div>}
                                <div>
                                  <p className="font-bold mb-1" style={{ color:'var(--color-text-muted)' }}>Prescribed Medicines:</p>
                                  <ul className="space-y-1 p-2 rounded-lg" style={{ backgroundColor:'var(--bg-card)', border:'1px solid rgba(30,41,59,0.8)' }}>
                                    {(medicines || []).map((m, mIdx) => (
                                      <li key={mIdx} className="list-disc list-inside">
                                        <span className="font-semibold" style={{ color:'var(--color-text-high)' }}>{m.name}</span> — {m.dosage} ({m.duration})
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                {h.notes && <div><span className="font-bold" style={{ color:'var(--color-text-muted)' }}>Advice: </span><span className="italic">{h.notes}</span></div>}
                                {h.report && (
                                  <div className="p-2.5 rounded" style={{ backgroundColor:'var(--bg-card)', border:'1px solid var(--color-border)' }}>
                                    <span className="font-bold block mb-1" style={{ color:'var(--color-text-muted)' }}>Visit notes summary</span>
                                    <span className="whitespace-pre-wrap" style={{ color:'var(--color-text-high)' }}>{h.report}</span>
                                  </div>
                                )}
                                <div className="pt-1 flex justify-end">
                                  <button type="button" onClick={() => openPrescriptionDrawer(h)}
                                    className="text-[10px] font-semibold flex items-center gap-1 hover:underline"
                                    style={{ color:'var(--color-accent)' }}>
                                    View Full EHR File →
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : historyPatient ? (
              /* EHR Patient File View */
              <div className="rounded-2xl p-6 flex flex-col gap-5 shadow-lg relative min-h-[500px]"
                style={{ backgroundColor:'var(--bg-card)', border:'1px solid var(--color-border)', transition:'background-color 0.3s' }}>
                <div className="pb-3 flex justify-between items-start" style={{ borderBottom:'1px solid var(--color-border)' }}>
                  <div>
                    <h2 className="text-xl font-bold" style={{ color:'var(--color-text-high)' }}>EHR Patient File: {historyPatient.name}</h2>
                    {/* Fix #10: separated metadata */}
                    <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-2 text-xs" style={{ color:'var(--color-text-muted)' }}>
                      <span>Phone: <span className="font-semibold" style={{ color:'var(--color-text-high)' }}>{historyPatient.phone}</span></span>
                      <span style={{ color:'var(--color-border)' }}>·</span>
                      <span>DOB: <span className="font-semibold" style={{ color:'var(--color-text-high)' }}>{formatDate(historyPatient.dob)}</span></span>
                      {historyPatient.blood_group && (
                        <>
                          <span style={{ color:'var(--color-border)' }}>·</span>
                          <span>Blood: <span className="font-semibold px-2 py-0.5 rounded" style={{ color:'var(--color-text-high)', backgroundColor:'var(--bg-canvas)', border:'1px solid var(--color-border)' }}>{historyPatient.blood_group}</span></span>
                        </>
                      )}
                    </div>
                  </div>
                  <button type="button" onClick={() => setHistoryPatient(null)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
                    style={{ color:'#f87171', border:'1px solid rgba(127,29,29,0.4)', backgroundColor:'rgba(127,29,29,0.1)' }}>
                    Close EHR Directory
                  </button>
                </div>

                <div className="rounded-xl overflow-hidden mt-1" style={{ border:'1px solid var(--color-border)' }}>
                  <div className="p-3 flex justify-between items-center" style={{ backgroundColor:'var(--bg-canvas)', borderBottom:'1px solid var(--color-border)' }}>
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color:'var(--color-text-high)' }}>Historical Consultations ({history.length})</span>
                    <span className="text-[10px]" style={{ color:'var(--color-text-muted)' }}>Last 5 visits</span>
                  </div>
                  {historyLoading ? (
                    <p className="text-xs text-center py-4" style={{ color:'var(--color-text-muted)' }}>Loading patient history...</p>
                  ) : history.length === 0 ? (
                    <p className="text-xs text-center py-4" style={{ color:'var(--color-text-muted)' }}>No previous consultations found.</p>
                  ) : (
                    <div style={{ backgroundColor:'rgba(11,15,25,0.2)' }}>
                      {history.map((h, idx) => {
                        const isOpen = openHistoryIdx === idx;
                        const medicines = typeof h.medicines === 'string' ? JSON.parse(h.medicines) : h.medicines;
                        return (
                          <div key={h.id} className="text-xs" style={{ borderTop: idx > 0 ? '1px solid rgba(30,41,59,0.6)' : 'none' }}>
                            <button type="button" onClick={() => setOpenHistoryIdx(isOpen ? null : idx)}
                              className="w-full text-left p-3 flex justify-between items-center font-medium transition-colors"
                              style={{ color:'var(--color-text-high)' }}>
                              <span>Consultation on {formatDate(h.created_at)}</span>
                              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded"
                                style={{ color:'var(--color-accent)', backgroundColor:'rgba(56,189,248,0.1)', border:'1px solid rgba(56,189,248,0.2)' }}>
                                {isOpen ? 'Hide Details' : 'View Details'}
                              </span>
                            </button>
                            {isOpen && (
                              <div className="p-4 space-y-3 text-[11px] animate-fadeIn"
                                style={{ borderTop:'1px solid var(--color-border)', backgroundColor:'rgba(11,15,25,0.5)', color:'var(--color-text-high)' }}>
                                {h.diagnosis && <div><span className="font-bold" style={{ color:'var(--color-text-muted)' }}>Diagnosis: </span><span>{h.diagnosis}</span></div>}
                                <div>
                                  <p className="font-bold mb-1" style={{ color:'var(--color-text-muted)' }}>Prescribed Medicines:</p>
                                  <ul className="space-y-1 p-2 rounded-lg" style={{ backgroundColor:'var(--bg-card)', border:'1px solid rgba(30,41,59,0.8)' }}>
                                    {(medicines || []).map((m, mIdx) => (
                                      <li key={mIdx} className="list-disc list-inside">
                                        <span className="font-semibold" style={{ color:'var(--color-text-high)' }}>{m.name}</span> — {m.dosage} ({m.duration})
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                {h.notes && <div><span className="font-bold" style={{ color:'var(--color-text-muted)' }}>Advice: </span><span className="italic">{h.notes}</span></div>}
                                {h.report && (
                                  <div className="p-2.5 rounded" style={{ backgroundColor:'var(--bg-card)', border:'1px solid var(--color-border)' }}>
                                    <span className="font-bold block mb-1" style={{ color:'var(--color-text-muted)' }}>Clinical Report Summary</span>
                                    <span className="whitespace-pre-wrap" style={{ color:'var(--color-text-high)' }}>{h.report}</span>
                                  </div>
                                )}
                                <div className="pt-1 flex justify-end">
                                  <button type="button" onClick={() => openPrescriptionDrawer(h)}
                                    className="text-[10px] font-semibold flex items-center gap-1 hover:underline"
                                    style={{ color:'var(--color-accent)' }}>
                                    View Full EHR File →
                                  </button>
                                </div>
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
              /* Welcome / Idle state */
              <div className="rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[500px] shadow-lg"
                style={{ backgroundColor:'var(--bg-card)', border:'1px solid var(--color-border)', transition:'background-color 0.3s' }}>
                <div className="relative mb-6">
                  <div className="absolute inset-0 rounded-full scale-125 animate-pulse" style={{ backgroundColor:'rgba(56,189,248,0.1)', filter:'blur(40px)' }} />
                  <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor:'var(--bg-canvas)', border:'1px solid var(--color-border)', color:'var(--color-accent)' }}>
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </div>
                </div>
                <h2 className="text-lg font-bold mb-1" style={{ color:'var(--color-text-high)' }}>Clinical Directory Ready</h2>
                <p className="text-xs max-w-xs mb-6" style={{ color:'var(--color-text-muted)' }}>
                  Select an arriving patient from the Live Queue Hub, or trigger a search (<kbd className="font-mono text-[10px] px-1 rounded" style={{ backgroundColor:'var(--bg-canvas)', border:'1px solid var(--color-border)', color:'var(--color-text-high)' }}>⌘K</kbd>) to view charts.
                </p>
                <button type="button" onClick={() => setSearchModalOpen(true)}
                  className="font-semibold px-5 py-2.5 rounded-full transition-all text-xs flex items-center gap-2 shadow-sm"
                  style={{ backgroundColor:'rgba(56,189,248,0.1)', border:'1px solid rgba(56,189,248,0.3)', color:'var(--color-accent)' }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Lookup Patient Files
                </button>
              </div>
            )}
          </div>

          {/* ──────────────────────────────────────────────────
              COLUMN 4: Encounter Panel OR Caseload Stats
          ────────────────────────────────────────────────── */}
          <div className="lg:col-span-1 flex flex-col gap-6 min-h-0">
            {active ? (
              /* EHR Encounter Panel */
              <form onSubmit={handleSavePrescription} className="rounded-2xl p-5 flex flex-col gap-4 shadow-lg h-full overflow-hidden"
                style={{ backgroundColor:'var(--bg-card)', border:'1px solid var(--color-border)', maxHeight:'calc(100vh - 8.5rem)', transition:'background-color 0.3s' }}>
                <div className="pb-3" style={{ borderBottom:'1px solid var(--color-border)' }}>
                  {/* Fix #6: section title with accent underline */}
                  <div className="section-title">Encounter Panel</div>
                  <span className="text-[10px] block mt-0.5" style={{ color:'var(--color-text-muted)' }}>Active consultation record sheet</span>
                </div>

                <div className="flex-1 flex flex-col gap-3.5 overflow-y-auto pr-1 scrollbar-thin">

                  {/* Drug Interaction Warning Panel */}
                  {(() => {
                    const warnings = getDrugInteractions();
                    if (warnings.length === 0) return null;
                    return (
                      <div className="rounded-xl p-3 text-xs mb-2 flex flex-col gap-1.5 border animate-fadeIn"
                        style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)', color: '#f87171' }}>
                        <div className="flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-wider text-red-400">
                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          Critical Drug Interaction Alert ({warnings.length})
                        </div>
                        <div className="space-y-2 mt-1">
                          {warnings.map((w, idx) => (
                            <div key={idx} className="pb-1.5 border-b last:border-0" style={{ borderColor: 'rgba(239,68,68,0.15)' }}>
                              <p className="font-semibold text-[10px]">
                                <span className="uppercase text-[9px] px-1 py-0.2 rounded font-black mr-1" 
                                  style={{ backgroundColor: w.severity === 'Fatal' ? '#b91c1c' : '#dc2626', color: '#ffffff' }}>
                                  {w.severity}
                                </span>
                                <span className="capitalize">{w.medA}</span> + <span className="capitalize">{w.medB}</span> ({w.type})
                              </p>
                              <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{w.message}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Fix #11: ICD-10 lookup with accent prefix icon */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" style={{ color:'var(--color-accent)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color:'var(--color-text-muted)' }}>Diagnosis Code Lookup</span>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search ICD-10 (e.g. Back Pain, I10)"
                        value={icdSearch}
                        onChange={e => { setIcdSearch(e.target.value); setShowIcdDropdown(true); }}
                        onFocus={() => setShowIcdDropdown(true)}
                        className="w-full rounded-xl p-2.5 text-xs focus:outline-none transition-all font-sans"
                        style={{ backgroundColor:'var(--bg-canvas)', border:'1px solid var(--color-border)', color:'var(--color-text-high)' }}
                      />
                      {showIcdDropdown && icdSearch && (
                        <div className="absolute left-0 right-0 mt-1 rounded-xl shadow-2xl z-30 max-h-40 overflow-y-auto animate-fadeIn"
                          style={{ backgroundColor:'var(--bg-card)', border:'1px solid var(--color-border)' }}>
                          {ICD10_CODES
                            .filter(c => c.code.toLowerCase().includes(icdSearch.toLowerCase()) || c.desc.toLowerCase().includes(icdSearch.toLowerCase()))
                            .map((code, idx) => (
                              <div key={idx} onClick={() => {
                                  setRx(prev => ({ ...prev, diagnosis: prev.diagnosis + (prev.diagnosis ? ', ' : '') + `${code.code} - ${code.desc}` }));
                                  setIcdSearch(''); setShowIcdDropdown(false);
                                  addToast(`Added ICD-10: ${code.code}`, 'info');
                                }}
                                className="p-2.5 text-[11px] cursor-pointer transition-colors"
                                style={{ color:'var(--color-text-high)', borderBottom:'1px solid rgba(30,41,59,0.3)' }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-canvas)'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                <span className="font-bold" style={{ color:'var(--color-accent)' }}>{code.code}</span> — {code.desc}
                              </div>
                            ))}
                          {ICD10_CODES.filter(c => c.code.toLowerCase().includes(icdSearch.toLowerCase()) || c.desc.toLowerCase().includes(icdSearch.toLowerCase())).length === 0 && (
                            <div className="p-2.5 text-[11px] text-center" style={{ color:'var(--color-text-muted)' }}>No diagnostic codes found</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Diagnosis Final Assessment */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" style={{ color:'var(--color-accent)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color:'var(--color-text-muted)' }}>Diagnosis (Final Assessment)</span>
                    </div>
                    <textarea rows={2}
                      className="w-full rounded-xl p-2.5 text-xs focus:outline-none transition-all font-sans"
                      style={{ backgroundColor:'var(--bg-canvas)', border:'1px solid var(--color-border)', color:'var(--color-text-high)' }}
                      placeholder="Add primary diagnosis (ICD-10 list above)"
                      value={rx.diagnosis}
                      onChange={e => setRx(r => ({ ...r, diagnosis: e.target.value }))}
                      required
                    />
                  </div>

                  {/* SOAP Remarks */}
                  <div className="flex flex-col flex-1 min-h-[120px]">
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" style={{ color:'var(--color-accent)' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color:'var(--color-text-muted)' }}>Clinical Examination Remarks</span>
                      </div>
                      <div className="flex items-center gap-1 p-0.5 rounded-lg" style={{ backgroundColor:'var(--bg-canvas)', border:'1px solid var(--color-border)', color:'var(--color-text-muted)' }}>
                        {[
                          { tag:'bold',   label:'B',     cls:'font-extrabold' },
                          { tag:'italic', label:'I',     cls:'italic' },
                          { tag:'vitals', label:'+ Vitals', cls:'text-[9px] font-semibold', accent: true },
                        ].map(btn => (
                          <button key={btn.tag} type="button" onClick={() => insertMarkdown(btn.tag)}
                            className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${btn.cls}`}
                            style={{ color: btn.accent ? 'var(--color-accent)' : 'inherit' }}>
                            {btn.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea
                      id="clinical-soap-textarea"
                      className="w-full flex-1 rounded-xl p-2.5 text-xs focus:outline-none transition-all font-mono min-h-[100px] resize-none"
                      style={{ backgroundColor:'var(--bg-canvas)', border:'1px solid var(--color-border)', color:'var(--color-text-high)' }}
                      placeholder="Symptoms, clinical signs, doctor remarks..."
                      value={rx.report}
                      onChange={e => setRx(r => ({ ...r, report: e.target.value }))}
                    />
                  </div>

                  {/* Care Advice */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" style={{ color:'var(--color-accent)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                      <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color:'var(--color-text-muted)' }}>Doctor Dietary & Care Advice</span>
                    </div>
                    <textarea rows={2}
                      className="w-full rounded-xl p-2.5 text-xs focus:outline-none transition-all font-sans"
                      style={{ backgroundColor:'var(--bg-canvas)', border:'1px solid var(--color-border)', color:'var(--color-text-high)' }}
                      placeholder="Additional dietary limits or medication instructions..."
                      value={rx.notes}
                      onChange={e => setRx(r => ({ ...r, notes: e.target.value }))}
                    />
                  </div>

                  {/* Prescription Builder — Fix #18: animated removal */}
                  <div className="pt-3 flex flex-col gap-1.5" style={{ borderTop:'1px solid rgba(30,41,59,0.3)' }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" style={{ color:'var(--color-accent)' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                        <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color:'var(--color-text-muted)' }}>Prescribe Medicines</span>
                      </div>
                      <button type="button" onClick={addMedicine}
                        className="text-[9px] font-bold px-2 py-0.5 rounded-md transition-all"
                        style={{ color:'var(--color-accent)', backgroundColor:'rgba(56,189,248,0.05)', border:'1px solid rgba(56,189,248,0.2)' }}>
                        + Add Line
                      </button>
                    </div>

                    <div className="space-y-2 max-h-36 overflow-y-auto pr-1 scrollbar-thin">
                      {rx.medicines.map((m, i) => (
                        <div key={i}
                          className={`flex flex-col gap-1.5 p-2 rounded-lg relative group/row transition-all ${removingMedIdx === i ? 'med-row-removing' : ''}`}
                          style={{ backgroundColor:'rgba(11,15,25,0.4)', border:'1px solid rgba(30,41,59,0.5)' }}>
                          <button type="button" onClick={() => removeMedicine(i)}
                            className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center font-bold text-xs shadow-md transition-all opacity-0 group-hover/row:opacity-100"
                            style={{ backgroundColor:'var(--bg-canvas)', border:'1px solid var(--color-border)', color:'var(--color-text-muted)' }}
                            disabled={rx.medicines.length <= 1}>
                            ×
                          </button>
                          <input
                            className="w-full rounded py-1 px-2 text-[10px] focus:outline-none transition-all font-semibold"
                            style={{ backgroundColor:'var(--bg-canvas)', border:'1px solid var(--color-border)', color:'var(--color-text-high)' }}
                            placeholder="Medicine name (e.g. Paracetamol)"
                            value={m.name}
                            onChange={e => updateMedicine(i, 'name', e.target.value)}
                            required
                          />
                          <div className="grid grid-cols-2 gap-1.5">
                            <input
                              className="w-full rounded py-1 px-2 text-[9px] focus:outline-none transition-all font-mono"
                              style={{ backgroundColor:'var(--bg-canvas)', border:'1px solid var(--color-border)', color:'var(--color-text-high)' }}
                              placeholder="Dosage (e.g. 1-0-1)"
                              value={m.dosage}
                              onChange={e => updateMedicine(i, 'dosage', e.target.value)}
                              required
                            />
                            <input
                              className="w-full rounded py-1 px-2 text-[9px] focus:outline-none transition-all"
                              style={{ backgroundColor:'var(--bg-canvas)', border:'1px solid var(--color-border)', color:'var(--color-text-high)' }}
                              placeholder="Duration (e.g. 5 days)"
                              value={m.duration}
                              onChange={e => updateMedicine(i, 'duration', e.target.value)}
                              required
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Fix #17: Finalize button with visible saving state */}
                <div className="pt-3 flex flex-col gap-2 shrink-0" style={{ borderTop:'1px solid rgba(30,41,59,0.3)' }}>
                  <button ref={saveButtonRef} type="submit"
                    className="w-full font-extrabold py-2.5 rounded-full transition-all text-xs flex items-center justify-center gap-2 shadow-md uppercase tracking-wider"
                    style={{ backgroundColor: saving ? 'rgba(56,189,248,0.7)' : 'var(--color-accent)', color:'#020617', cursor: saving ? 'not-allowed' : 'pointer' }}
                    disabled={saving}>
                    {saving ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Saving Encounter...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        Sign & Finalize Encounter
                      </>
                    )}
                  </button>
                  <span className="text-[8px] text-center font-medium block" style={{ color:'var(--color-text-muted)' }}>
                    Consultation registered under Dr. {user.name}
                  </span>
                </div>
              </form>
            ) : (
              /* Fix #12: Caseload Stats with visual hierarchy */
              <div className="rounded-2xl p-5 flex flex-col gap-4 shadow-lg h-full overflow-hidden"
                style={{ backgroundColor:'var(--bg-card)', border:'1px solid var(--color-border)', maxHeight:'calc(100vh - 8.5rem)', transition:'background-color 0.3s' }}>
                <div className="pb-3 flex justify-between items-center" style={{ borderBottom:'1px solid var(--color-border)' }}>
                  <div>
                    <div className="section-title">Caseload Stats</div>
                    <p className="text-[10px] mt-0.5" style={{ color:'var(--color-text-muted)' }}>Summary reports database</p>
                  </div>
                  <button type="button" onClick={handleDownloadCaseloadReport}
                    disabled={caseloadTokens.length === 0}
                    title="Export daily caseload report"
                    className="p-1.5 rounded-lg transition-all"
                    style={{ backgroundColor:'var(--bg-canvas)', border:'1px solid var(--color-border)', color: caseloadTokens.length === 0 ? 'rgba(148,163,184,0.4)' : 'var(--color-accent)' }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                </div>

                {/* Fix #12: Stat cards with hierarchy — Completed is primary/larger */}
                <div className="grid grid-cols-2 gap-2.5">
                  {statCards.map((stat, sIdx) => (
                    <div key={sIdx}
                      className={`p-3 rounded-xl flex flex-col items-center justify-center text-center shadow-inner ${stat.primary ? 'stat-card-primary' : ''}`}
                      style={{ border: `1px solid ${stat.primary ? 'rgba(16,185,129,0.2)' : 'rgba(30,41,59,0.5)'}` }}>
                      <span className={`font-black block ${stat.primary ? 'text-3xl' : 'text-lg'}`} style={{ color: stat.primary ? '#10b981' : stat.colorCls === 'text-accent' ? 'var(--color-accent)' : stat.colorCls === 'text-amber-400' ? '#f59e0b' : 'var(--color-text-high)' }}>
                        {stat.val}
                        {stat.primary && <span className="text-sm ml-1">✓</span>}
                      </span>
                      <span className="text-[8px] uppercase tracking-wider font-extrabold mt-1" style={{ color:'var(--color-text-muted)' }}>{stat.label}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-wide" style={{ color:'var(--color-text-muted)' }}>Daily Caseload Comments</label>
                  <textarea
                    value={caseloadNotes}
                    onChange={e => setCaseloadNotes(e.target.value)}
                    className="w-full rounded-xl p-3 text-[11px] focus:outline-none transition-all font-sans resize-none"
                    style={{ backgroundColor:'var(--bg-canvas)', border:'1px solid var(--color-border)', color:'var(--color-text-high)' }}
                    rows={4}
                    placeholder="Enter notes. It compiles into the caseload report text file download."
                  />
                </div>

                {/* Fix #13: Patient checklist as collapsible scrollable list */}
                <div className="flex-1 flex flex-col min-h-0">
                  <span className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color:'var(--color-text-muted)' }}>Patients Checklist</span>
                  <div className="rounded-xl overflow-y-auto flex-1 scrollbar-thin" style={{ border:'1px solid var(--color-border)', backgroundColor:'rgba(11,15,25,0.3)' }}>
                    {caseloadTokens.map((t, idx) => (
                      <div key={t.id} className="p-2.5 flex justify-between items-center transition-colors text-[11px]"
                        style={{ borderTop: idx > 0 ? '1px solid rgba(30,41,59,0.3)' : 'none', color:'var(--color-text-high)' }}>
                        <div className="truncate" style={{ maxWidth:'120px' }}>
                          <span className="font-bold block" style={{ color:'var(--color-text-high)' }}>#{t.token_number} — {t.patientName}</span>
                          <span className="text-[9px] block truncate" style={{ color:'var(--color-text-muted)' }}>{t.chiefComplaint}</span>
                        </div>
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider"
                          style={{
                            backgroundColor: t.status === 'done' ? 'rgba(16,185,129,0.1)' : t.status === 'in_progress' ? 'rgba(56,189,248,0.1)' : 'rgba(245,158,11,0.1)',
                            color: t.status === 'done' ? '#10b981' : t.status === 'in_progress' ? 'var(--color-accent)' : '#f59e0b',
                            border: `1px solid ${t.status === 'done' ? 'rgba(16,185,129,0.2)' : t.status === 'in_progress' ? 'rgba(56,189,248,0.2)' : 'rgba(245,158,11,0.2)'}`,
                          }}>
                          {t.status === 'done' ? 'Billing' : t.status === 'in_progress' ? 'Consult' : 'Waiting'}
                        </span>
                      </div>
                    ))}
                    {caseloadTokens.length === 0 && (
                      <div className="text-center py-10 flex flex-col items-center justify-center h-full">
                        <p className="text-[10px]" style={{ color:'var(--color-text-muted)' }}>No cases assigned to your directory today.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

        </main>
      </div>

      {/* ──────────────────────────────────────────────────
          Global Search Modal (⌘K)
      ────────────────────────────────────────────────── */}
      {searchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor:'rgba(2,6,23,0.8)', backdropFilter:'blur(12px)' }}>
          <div className="rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col animate-slideIn"
            style={{ backgroundColor:'var(--bg-card)', border:'1px solid var(--color-border)', maxHeight:'80vh' }}>
            <div className="p-4 flex items-center justify-between" style={{ borderBottom:'1px solid var(--color-border)' }}>
              <div className="flex items-center gap-2.5 flex-1 mr-4">
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color:'var(--color-text-muted)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  ref={searchInputRef}
                  placeholder="Type patient name or phone to lookup directory..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="bg-transparent border-0 outline-none text-sm w-full focus:ring-0 focus:outline-none"
                  style={{ color:'var(--color-text-high)' }}
                  autoFocus
                />
              </div>
              <button type="button" onClick={() => setSearchModalOpen(false)}
                className="text-[10px] font-bold px-2.5 py-1 rounded-lg transition-colors"
                style={{ color:'var(--color-text-muted)', border:'1px solid var(--color-border)', backgroundColor:'var(--bg-canvas)' }}>
                ESC
              </button>
            </div>
            <div className="overflow-y-auto p-2 max-h-[300px] scrollbar-thin"
              style={{ backgroundColor:'rgba(11,15,25,0.3)' }}>
              {allPatients
                .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.phone.includes(searchQuery))
                .map(p => (
                  <div key={p.id}
                    onClick={() => { handleSelectHistoryPatient(p); setSearchModalOpen(false); }}
                    className="p-3 rounded-xl cursor-pointer flex justify-between items-center transition-colors group"
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-canvas)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <div>
                      <p className="font-bold text-xs transition-colors" style={{ color:'var(--color-text-high)' }}>{p.name}</p>
                      <p className="text-[10px]" style={{ color:'var(--color-text-muted)' }}>{p.phone}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color:'var(--color-accent)', backgroundColor:'rgba(56,189,248,0.1)', border:'1px solid rgba(56,189,248,0.2)' }}>
                      Open EHR File
                    </span>
                  </div>
                ))}
              {allPatients.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.phone.includes(searchQuery)).length === 0 && (
                <p className="text-xs text-center py-10" style={{ color:'var(--color-text-muted)' }}>No matching patient files found.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────
          EHR History Side Drawer
      ────────────────────────────────────────────────── */}
      {isDrawerOpen && selectedDrawerPrescription && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div onClick={() => setIsDrawerOpen(false)} className="absolute inset-0" style={{ backgroundColor:'rgba(2,6,23,0.6)', backdropFilter:'blur(4px)' }} />
          <div className="relative w-full max-w-md border-l shadow-2xl p-6 overflow-y-auto flex flex-col justify-between z-10 animate-slideIn"
            style={{ backgroundColor:'var(--bg-card)', borderColor:'var(--color-border)', transition:'background-color 0.3s' }}>
            <div>
              <div className="flex justify-between items-center pb-4 mb-4" style={{ borderBottom:'1px solid var(--color-border)' }}>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color:'var(--color-text-high)' }}>Historical Consultation Record</h3>
                  <p className="text-[10px] mt-0.5" style={{ color:'var(--color-text-muted)' }}>Visit: {new Date(selectedDrawerPrescription.created_at).toLocaleString('en-IN')}</p>
                </div>
                <button type="button" onClick={() => setIsDrawerOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs"
                  style={{ border:'1px solid var(--color-border)', backgroundColor:'var(--bg-canvas)', color:'var(--color-text-muted)' }}>
                  ×
                </button>
              </div>

              <div className="space-y-4 text-xs" style={{ color:'var(--color-text-high)' }}>
                <div className="p-3 rounded-xl" style={{ backgroundColor:'rgba(11,15,25,0.5)', border:'1px solid var(--color-border)' }}>
                  <span className="text-[9px] font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--color-text-muted)' }}>Diagnosis</span>
                  <p className="font-semibold">{selectedDrawerPrescription.diagnosis || 'No diagnosis logged.'}</p>
                </div>

                <div className="p-3 rounded-xl" style={{ backgroundColor:'rgba(11,15,25,0.5)', border:'1px solid var(--color-border)' }}>
                  <span className="text-[9px] font-bold uppercase tracking-wider block mb-2" style={{ color:'var(--color-text-muted)' }}>Prescribed Medicines</span>
                  <div className="rounded-lg overflow-hidden" style={{ border:'1px solid var(--color-border)', backgroundColor:'var(--bg-card)' }}>
                    <table className="text-[11px] w-full" style={{ color:'var(--color-text-high)', borderCollapse:'collapse' }}>
                      <thead>
                        <tr className="text-[9px] font-bold" style={{ backgroundColor:'var(--bg-canvas)', borderBottom:'1px solid var(--color-border)', color:'var(--color-text-muted)' }}>
                          <th className="p-2 text-left">Name</th>
                          <th className="p-2 text-left">Dosage</th>
                          <th className="p-2 text-left">Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(typeof selectedDrawerPrescription.medicines === 'string'
                          ? JSON.parse(selectedDrawerPrescription.medicines || '[]')
                          : (selectedDrawerPrescription.medicines || [])
                        ).map((med, medI) => (
                          <tr key={medI} style={{ borderBottom:'1px solid rgba(30,41,59,0.4)' }}>
                            <td className="p-2 font-medium">{med.name}</td>
                            <td className="p-2 font-mono" style={{ color:'var(--color-text-muted)' }}>{med.dosage}</td>
                            <td className="p-2" style={{ color:'var(--color-text-muted)' }}>{med.duration}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {selectedDrawerPrescription.notes && (
                  <div className="p-3 rounded-xl" style={{ backgroundColor:'rgba(11,15,25,0.5)', border:'1px solid var(--color-border)' }}>
                    <span className="text-[9px] font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--color-text-muted)' }}>Special Advice</span>
                    <p className="italic">"{selectedDrawerPrescription.notes}"</p>
                  </div>
                )}

                {selectedDrawerPrescription.report && (
                  <div className="p-3 rounded-xl" style={{ backgroundColor:'rgba(11,15,25,0.5)', border:'1px solid var(--color-border)' }}>
                    <span className="text-[9px] font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--color-text-muted)' }}>Visit Notes Summary</span>
                    <p className="whitespace-pre-wrap">{selectedDrawerPrescription.report}</p>
                  </div>
                )}

                <div className="p-3 rounded-xl space-y-2 mt-2"
                  style={{ backgroundColor:'rgba(245,158,11,0.05)', border:'1px solid rgba(245,158,11,0.1)' }}>
                  <span className="text-[9px] font-bold uppercase tracking-wider block" style={{ color:'#f59e0b' }}>Schedule Follow-up Consultation</span>
                  <div className="flex gap-2">
                    <input type="date" value={followUpDate} min={new Date().toISOString().split('T')[0]}
                      onChange={e => setFollowUpDate(e.target.value)}
                      className="rounded-lg p-2 flex-1 focus:outline-none text-xs"
                      style={{ backgroundColor:'var(--bg-canvas)', border:'1px solid var(--color-border)', color:'var(--color-text-high)' }}
                    />
                    <button type="button" onClick={handleScheduleFollowUp}
                      className="font-bold px-3 py-2 rounded-lg text-[10px] transition-all"
                      style={{ backgroundColor:'var(--color-accent)', color:'#020617' }}>
                      Schedule
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 mt-6" style={{ borderTop:'1px solid var(--color-border)' }}>
              <button type="button"
                onClick={() => {
                  handlePrintPrescription({
                    token: selectedDrawerPrescription.expand?.token || { token_number: 'N/A' },
                    patient: selectedDrawerPrescription.expand?.patient || historyPatient,
                    prescription: selectedDrawerPrescription,
                    doctor: user
                  });
                  setIsDrawerOpen(false);
                }}
                className="w-full font-extrabold py-2.5 rounded-full text-xs flex items-center justify-center gap-1.5 shadow-md transition-all uppercase tracking-wider"
                style={{ backgroundColor:'var(--color-accent)', color:'#020617' }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Download PDF Prescription
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
