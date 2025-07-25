import { useState } from "react";
import PocketBase from "pocketbase";

export default function AddPatientForm({ onClose, onPatientAdded }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [address, setAddress] = useState("");
  const [gender, setGender] = useState("");
  const [medicalHistory, setMedicalHistory] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const pb = new PocketBase("http://127.0.0.1:8090");
      await pb.collection("patients").create({
        name,
        email,
        phone,
        date_of_birth: dateOfBirth,
        address,
        gender,
        medicalHistory
      });
      if (onPatientAdded) onPatientAdded();
      if (onClose) onClose();
    } catch (err) {
      setError("Failed to add patient.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md relative">
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 text-2xl">&times;</button>
        <h2 className="text-2xl font-bold text-blue-800 mb-4">Add Patient</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input type="text" className="border border-blue-200 rounded px-4 py-2" placeholder="Name" value={name} onChange={e => setName(e.target.value)} required />
          <input type="email" className="border border-blue-200 rounded px-4 py-2" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="tel" className="border border-blue-200 rounded px-4 py-2" placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} required />
          <input type="date" className="border border-blue-200 rounded px-4 py-2" placeholder="Date of Birth" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} required />
          <input type="text" className="border border-blue-200 rounded px-4 py-2" placeholder="Address" value={address} onChange={e => setAddress(e.target.value)} required />
          <select className="border border-blue-200 rounded px-4 py-2" value={gender} onChange={e => setGender(e.target.value)} required>
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
          <textarea className="border border-blue-200 rounded px-4 py-2" placeholder="Medical History (optional)" value={medicalHistory} onChange={e => setMedicalHistory(e.target.value)} />
          {error && <div className="text-red-600 text-sm text-center">{error}</div>}
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded transition" disabled={loading}>
            {loading ? "Adding..." : "Add Patient"}
          </button>
        </form>
      </div>
    </div>
  );
}
