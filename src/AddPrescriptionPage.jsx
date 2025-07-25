import { useState, useEffect } from "react";
import PocketBase from "pocketbase";
import { useNavigate } from "react-router-dom";

export default function AddPrescriptionPage() {
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [appointmentId, setAppointmentId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [patientId, setPatientId] = useState("");
  const [medication, setMedication] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const pb = new PocketBase("http://127.0.0.1:8090");
    pb.collection("appointments").getFullList({ expand: "doctor,patient" }).then(setAppointments);
    pb.collection("doctors").getFullList().then(setDoctors);
    pb.collection("patients").getFullList().then(setPatients);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!appointmentId || !doctorId || !patientId || !medication) {
      setError("All fields are required.");
      return;
    }
    setLoading(true);
    const pb = new PocketBase("http://127.0.0.1:8090");
    try {
      const debugData = {
        appointments: appointmentId,
        doctor: doctorId,
        patient: patientId,
        medication
      };
      // eslint-disable-next-line no-console
      console.log("Submitting prescription:", debugData);
      await pb.collection("prescriptions").create(debugData);
      setLoading(false);
      navigate("/doctor-dashboard", { state: { success: "Prescription added successfully!" } });
    } catch (err) {
      setLoading(false);
      // Show detailed PocketBase error if available
      if (err?.data && typeof err.data === "object") {
        const messages = Object.entries(err.data)
          .map(([field, msg]) => `${field}: ${Array.isArray(msg) ? msg.join(", ") : msg}`)
          .join("; ");
        // eslint-disable-next-line no-console
        console.error("PocketBase error:", err.data);
        setError(messages || err.message || "Failed to add prescription.");
      } else {
        setError(err?.message || "Failed to add prescription.");
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-200 px-4">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md flex flex-col gap-4">
        <h2 className="text-2xl font-bold text-blue-800 mb-4">Add Prescription</h2>
        {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
        <div>
          <label className="block font-medium mb-1">Appointment</label>
          <select className="w-full border rounded px-3 py-2" value={appointmentId} onChange={e => setAppointmentId(e.target.value)} required>
            <option value="">Select appointment</option>
            {appointments.map(a => (
              <option key={a.id} value={a.id}>
                {a.expand?.patient?.name || "Unknown Patient"} with {a.expand?.doctor?.name || "Unknown Doctor"} on {a.date}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-medium mb-1">Doctor</label>
          <select className="w-full border rounded px-3 py-2" value={doctorId} onChange={e => setDoctorId(e.target.value)} required>
            <option value="">Select doctor</option>
            {doctors.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-medium mb-1">Patient</label>
          <select className="w-full border rounded px-3 py-2" value={patientId} onChange={e => setPatientId(e.target.value)} required>
            <option value="">Select patient</option>
            {patients.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-medium mb-1">Medication</label>
          <textarea className="w-full border rounded px-3 py-2" value={medication} onChange={e => setMedication(e.target.value)} required placeholder="Enter medication details" />
        </div>
        <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded transition" disabled={loading}>
          {loading ? "Adding..." : "Add Prescription"}
        </button>
      </form>
    </div>
  );
}
