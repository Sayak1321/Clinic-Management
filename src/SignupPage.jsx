import { useState } from "react";
import PocketBase from "pocketbase";
import { Link, useNavigate } from "react-router-dom";


export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("Doctor");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const pb = new PocketBase("http://127.0.0.1:8090");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      // Create user
      const user = await pb.collection("users").create({ email, password, passwordConfirm: confirmPassword, role });
      // If role is Doctor, also create a doctor record in doctors collection
      if (role === "Doctor") {
        await pb.collection("doctors").create({
          user: user.id, // relate to user id if needed
          name: user.name || email,
          email: email
        });
      }
      // Optionally, auto-login or redirect to login page
      navigate("/login");
    } catch (err) {
      // Show detailed PocketBase error if available
      if (err?.data && typeof err.data === "object") {
        const messages = Object.entries(err.data)
          .map(([field, msg]) => `${field}: ${Array.isArray(msg) ? msg.join(", ") : msg}`)
          .join("; ");
        setError(messages || err.message || "Signup failed.");
      } else {
        setError(err?.message || JSON.stringify(err) || "Signup failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-200 px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md flex flex-col gap-6"
      >
        <h2 className="text-2xl font-bold text-blue-800 text-center">Sign Up</h2>
        <input
          type="email"
          className="border border-blue-200 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          className="border border-blue-200 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <input
          type="password"
          className="border border-blue-200 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        <div>
          <label className="block mb-1 font-medium text-blue-800">Sign up as:</label>
          <select
            className="border border-blue-200 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 w-full"
            value={role}
            onChange={e => setRole(e.target.value)}
            required
          >
            <option value="Doctor">Doctor</option>
            <option value="Receptionist">Receptionist</option>
          </select>
        </div>
        {error && <div className="text-red-600 text-sm text-center">{error}</div>}
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded transition"
          disabled={loading}
        >
          {loading ? "Signing up..." : "Sign Up"}
        </button>
        <p className="text-center text-sm mt-2">
          Already have an account? <Link to="/login" className="text-blue-600 hover:underline">Login</Link>
        </p>
      </form>
    </div>
  );
}
