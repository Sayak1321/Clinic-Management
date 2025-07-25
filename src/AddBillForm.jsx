import { useState, useEffect } from "react";
import PocketBase from "pocketbase";

export default function AddBillForm({ onClose, onBillAdded }) {
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [appointmentId, setAppointmentId] = useState("");
  const [patientId, setPatientId] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const pb = new PocketBase("http://127.0.0.1:8090");
    pb.collection("appointments").getFullList({ expand: "patient" }).then(setAppointments);
    pb.collection("patients").getFullList().then(setPatients);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!appointmentId || !patientId || !amount) {
      setError("All fields are required.");
      return;
    }
    setLoading(true);
    const pb = new PocketBase("http://127.0.0.1:8090");
    try {
      await pb.collection("bills").create({
        appointment: appointmentId,
        patient: patientId,
        amount
      });
      setLoading(false);
      onBillAdded && onBillAdded();
      onClose();
    } catch (err) {
      setLoading(false);
      setError(err?.message || "Failed to add bill.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md space-y-4">
        <h2 className="text-2xl font-bold text-blue-800 mb-2">Add Bill</h2>
        {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
        <div>
          <label className="block font-medium mb-1">Appointment</label>
          <select className="w-full border rounded px-3 py-2" value={appointmentId} onChange={e => setAppointmentId(e.target.value)} required>
            <option value="">Select appointment</option>
            {appointments.map(a => (
              <option key={a.id} value={a.id}>
                {a.expand?.patient?.name || "Unknown Patient"} on {a.date}
              </option>
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
          <label className="block font-medium mb-1">Amount</label>
          <input type="number" className="w-full border rounded px-3 py-2" value={amount} onChange={e => setAmount(e.target.value)} required min="0" />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300" onClick={onClose} disabled={loading}>Cancel</button>
          <button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 font-semibold" disabled={loading}>{loading ? "Adding..." : "Add Bill"}</button>
        </div>
      </form>
    </div>
  );
}
