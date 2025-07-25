
import { useState, useEffect } from "react";
import PocketBase from "pocketbase";

export default function AddAppointmentForm({ onClose, onAppointmentAdded }) {
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState("");
  // Removed time and reason fields
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const pb = new PocketBase("http://127.0.0.1:8090");
    pb.collection("patients").getFullList().then(setPatients);
    // Fetch all doctors and expand user
    pb.collection("doctors").getFullList({ expand: "user" }).then((docs) => {
      // Debug: log all doctors and their expanded user
      // eslint-disable-next-line no-console
      console.log("Fetched doctors:", docs.map(d => ({ id: d.id, name: d.name, user: d.expand?.user, userId: d.user })));
      // If expand.user is missing, fallback to showing all doctors
      if (docs.length > 0 && !docs[0].expand?.user) {
        setDoctors(docs);
      } else {
        setDoctors(docs.filter(d => d.expand?.user && d.expand.user.role === "Doctor"));
      }
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!patientId || !doctorId || !date) {
      setError("All fields are required.");
      return;
    }
    // Double-check doctorId is in doctors list
    if (!doctors.find(d => d.id === doctorId)) {
      setError("Selected doctor is invalid. Please choose a valid doctor.");
      return;
    }
    setLoading(true);
    const pb = new PocketBase("http://127.0.0.1:8090");
    try {
      await pb.collection("appointments").create({
        patient: patientId,
        doctor: doctorId, // from doctors collection
        date,
        status: "Scheduled"
      });
      setLoading(false);
      onAppointmentAdded && onAppointmentAdded();
      onClose();
    } catch (err) {
      setLoading(false);
      setError(err?.message || "Failed to add appointment.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md space-y-4">
        <h2 className="text-2xl font-bold text-blue-800 mb-2">add appointment</h2>
        {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
        <div>
          <label className="block font-medium mb-1">patient</label>
          <select className="w-full border rounded px-3 py-2" value={patientId} onChange={e => setPatientId(e.target.value)} required>
            <option value="">select patient</option>
            {patients.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.email})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-medium mb-1">doctor</label>
          <select className="w-full border rounded px-3 py-2" value={doctorId} onChange={e => setDoctorId(e.target.value)} required>
            <option value="">select doctor</option>
            {doctors.map(d => (
              <option key={d.id} value={d.id}>{d.name || d.expand?.user?.email || d.id}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-medium mb-1">date</label>
          <input type="date" className="w-full border rounded px-3 py-2" value={date} onChange={e => setDate(e.target.value)} required />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300" onClick={onClose} disabled={loading}>cancel</button>
          <button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 font-semibold" disabled={loading}>{loading ? "adding..." : "add appointment"}</button>
        </div>
      </form>
    </div>
  );
}
