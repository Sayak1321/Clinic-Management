  // Delete handlers for each list
  const handleDeletePrescription = async (id) => {
    const pb = new PocketBase("http://127.0.0.1:8090");
    await pb.collection("prescriptions").delete(id);
    setPrescriptions((prev) => prev.filter((item) => item.id !== id));
  };
  const handleDeleteBill = async (id) => {
    const pb = new PocketBase("http://127.0.0.1:8090");
    await pb.collection("bills").delete(id);
    setBills((prev) => prev.filter((item) => item.id !== id));
  };
  const handleDeleteAppointment = async (id) => {
    const pb = new PocketBase("http://127.0.0.1:8090");
    await pb.collection("appointments").delete(id);
    setAppointments((prev) => prev.filter((item) => item.id !== id));
  };
  const handleDeletePatient = async (id) => {
    const pb = new PocketBase("http://127.0.0.1:8090");
    await pb.collection("patients").delete(id);
    setPatients((prev) => prev.filter((item) => item.id !== id));
  };


import { useEffect, useState } from "react";
import jsPDF from "jspdf";
import PocketBase from "pocketbase";
import { Link, useNavigate, useLocation } from "react-router-dom";

export default function DoctorDashboard() {
  // Generate PDF for a prescription
  const handleDownloadPDF = (presc) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Prescription", 20, 20);
    doc.setFontSize(12);
    doc.text(`Patient: ${presc.expand?.patient?.name || "Unknown"}`, 20, 40);
    doc.text(`Doctor: ${presc.expand?.doctor?.name || "Unknown"}`, 20, 50);
    doc.text(`Medication: ${presc.medication}`, 20, 60);
    doc.text(`Appointment Date: ${presc.expand?.appointments?.date || "-"}`, 20, 70);
    doc.save(`prescription_${presc.id}.pdf`);
  };
  const [user, setUser] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const pb = new PocketBase("http://127.0.0.1:8090");
    const authUser = pb.authStore.model;
    setUser(authUser);
    Promise.all([
      pb.collection("appointments").getFullList({ expand: "patient,doctor" }),
      pb.collection("patients").getFullList(),
      pb.collection("prescriptions").getFullList({ expand: "doctor,patient,appointments" }),
      pb.collection("bills").getFullList({ expand: "appointment,patient" })
    ]).then(([appts, pats, presc, bills]) => {
      setAppointments(appts);
      setPatients(pats);
      setPrescriptions(presc);
      setBills(bills);
      setLoading(false);
    });
    // Show success message if redirected from prescription creation
    if (location.state && location.state.success) {
      setSuccess(location.state.success);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  if (loading) return <div className="text-center py-8">Loading...</div>;
  if (!user) return <div className="text-center py-8 text-red-600">Not logged in.</div>;

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 bg-blue-100 p-6 flex flex-col gap-4 border-r border-blue-200">
        <div className="font-bold text-blue-900 text-xl mb-4">Menu</div>
        <Link to="/doctor-dashboard" className="text-blue-800 hover:underline">Dashboard</Link>
        <Link to="/profile" className="text-blue-800 hover:underline">Profile</Link>
      </aside>
      <main className="flex-1 p-6 max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-blue-800 mb-6">Doctor Dashboard</h1>
        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded mb-4">
            {success}
          </div>
        )}
        <h2 className="text-2xl font-semibold text-blue-700 mb-2 mt-8">All Bills</h2>
        {bills.length === 0 ? (
          <div className="text-gray-500">No bills found.</div>
        ) : (
          <ul className="divide-y divide-blue-100 bg-white rounded-xl shadow mb-6 max-h-64 overflow-y-auto">
        {bills.map((bill) => (
              <li key={bill.id} className="p-4 flex flex-col md:flex-row md:items-center gap-2">
                <div className="flex-1">
                  <div className="font-medium text-blue-900">Patient: {bill.expand?.patient?.name || "Unknown"}</div>
                  <div className="text-sm text-blue-700">Appointment: {bill.expand?.appointment?.date || "-"}</div>
                  <div className="text-sm text-blue-700">Amount: ₹{bill.amount}</div>
                </div>
                <button className="bg-red-500 hover:bg-red-700 text-white px-3 py-1 rounded text-sm mt-2 md:mt-0" onClick={() => handleDeleteBill(bill.id)}>Delete</button>
              </li>
            ))}
          </ul>
        )}
        <h2 className="text-2xl font-semibold text-blue-700 mb-2 mt-8">All Prescriptions</h2>
        {prescriptions.length === 0 ? (
          <div className="text-gray-500">No prescriptions found.</div>
        ) : (
          <ul className="divide-y divide-blue-100 bg-white rounded-xl shadow mb-6 max-h-64 overflow-y-auto">
        {prescriptions.map((presc) => (
          <li key={presc.id} className="p-4 flex flex-col md:flex-row md:items-center gap-2">
            <div className="flex-1">
              <div className="font-medium text-blue-900">Patient: {presc.expand?.patient?.name || "Unknown"}</div>
              <div className="text-sm text-blue-700">Doctor: {presc.expand?.doctor?.name || "Unknown"}</div>
              <div className="text-sm text-blue-700">Medication: {presc.medication}</div>
              <div className="text-sm text-blue-700">Appointment: {presc.expand?.appointments?.date || "-"}</div>
            </div>
            <div className="flex gap-2 mt-2 md:mt-0">
              <button
                className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                onClick={() => handleDownloadPDF(presc)}
              >
                Download PDF
              </button>
              <button
                className="bg-red-500 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
                onClick={() => handleDeletePrescription(presc.id)}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
          </ul>
        )}
        <div className="mb-4 text-lg">Welcome, <span className="font-semibold">{user.name || user.email}</span></div>
        <div className="flex gap-4 mb-6">
          <button
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded transition"
            onClick={() => navigate("/add-prescription")}
          >
            Add Prescription
          </button>
        </div>
        <h2 className="text-2xl font-semibold text-blue-700 mb-2">All Appointments</h2>
        {appointments.length === 0 ? (
          <div className="text-gray-500">No appointments for today.</div>
        ) : (
          <ul className="divide-y divide-blue-100 bg-white rounded-xl shadow max-h-64 overflow-y-auto">
        {appointments.map((appt) => (
              <li key={appt.id} className="p-4 flex flex-col md:flex-row md:items-center gap-2">
                <div className="flex-1">
                  <div className="font-medium text-blue-900">Patient: {appt.expand?.patient?.name || "Unknown"}</div>
                  <div className="text-sm text-blue-700">Doctor: {appt.expand?.doctor?.name || "Unknown"}</div>
                  <div className="text-sm text-blue-700">Date: {appt.date || "-"}</div>
                </div>
                <div className="flex gap-2 items-center">
                  <div className="text-sm text-blue-600">Status: {appt.status || "Scheduled"}</div>
                  <button className="bg-red-500 hover:bg-red-700 text-white px-3 py-1 rounded text-sm" onClick={() => handleDeleteAppointment(appt.id)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <h2 className="text-2xl font-semibold text-blue-700 mb-2 mt-8">All Patients</h2>
        {patients.length === 0 ? (
          <div className="text-gray-500">No patients found.</div>
        ) : (
          <ul className="divide-y divide-blue-100 bg-white rounded-xl shadow max-h-64 overflow-y-auto">
        {patients.map((pat) => (
              <li key={pat.id} className="p-4 flex flex-col md:flex-row md:items-center gap-2">
                <div className="flex-1">
                  <div className="font-medium text-blue-900">{pat.name}</div>
                  <div className="text-sm text-blue-700">Email: {pat.email}</div>
                </div>
                <button className="bg-red-500 hover:bg-red-700 text-white px-3 py-1 rounded text-sm mt-2 md:mt-0" onClick={() => handleDeletePatient(pat.id)}>Delete</button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
