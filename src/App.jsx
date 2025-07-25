
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import LoginPage from "./LoginPage";
import SignupPage from "./SignupPage";
import DoctorDashboard from "./DoctorDashboard";
import ReceptionistDashboard from "./ReceptionistDashboard";
import ProfilePage from "./ProfilePage";
import AddPrescriptionPage from "./AddPrescriptionPage";

function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-blue-200 px-4">
      <header className="w-full max-w-2xl text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-extrabold text-blue-900 mb-4 drop-shadow-lg">Clinic Management System</h1>
        <p className="text-lg md:text-xl text-blue-700 font-medium mb-6">Efficiently manage appointments, patients, doctors, and more.</p>
        <Link to="/signup" className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg shadow transition">Start Now</Link>
      </header>
      <main className="w-full max-w-4xl flex flex-col md:flex-row gap-8 items-center justify-center">
        <img src="https://img.freepik.com/free-vector/doctor-character-background_1270-84.jpg?w=826&t=st=1689950000~exp=1689950600~hmac=placeholder" alt="Clinic Illustration" className="w-64 h-64 object-cover rounded-xl shadow-lg border-4 border-white" />
        <section className="flex-1">
          <h2 className="text-2xl font-bold text-blue-800 mb-4">Why Choose Our System?</h2>
          <ul className="list-disc list-inside text-blue-700 space-y-2 text-lg">
            <li>Easy appointment scheduling and management</li>
            <li>Comprehensive patient records</li>
            <li>Doctor and staff management</li>
            <li>Secure and user-friendly interface</li>
          </ul>
        </section>
      </main>
      <footer className="mt-16 text-blue-600 text-sm opacity-80">
        &copy; {new Date().getFullYear()} Clinic Management System. All rights reserved.
      </footer>
    </div>
  );
}


function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/doctor-dashboard" element={<DoctorDashboard />} />
        <Route path="/receptionist-dashboard" element={<ReceptionistDashboard />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/add-prescription" element={<AddPrescriptionPage />} />
      </Routes>
    </Router>
  );
}

export default App;
