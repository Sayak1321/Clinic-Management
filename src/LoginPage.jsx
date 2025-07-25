

import { useState } from "react";
import PocketBase from "pocketbase";

import { Link, useNavigate } from "react-router-dom";


export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Initialize PocketBase client
  const pb = new PocketBase("http://127.0.0.1:8090");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      // Authenticate with PocketBase
      const authData = await pb.collection("users").authWithPassword(email, password);
      // Redirect based on role
      const userRole = authData?.record?.role;
      if (userRole === "Doctor") {
        navigate("/doctor-dashboard");
      } else if (userRole === "Receptionist") {
        navigate("/receptionist-dashboard");
      } else {
        navigate("/");
      }
      // Optionally, call onLogin if you want to lift state up
      if (onLogin) onLogin(email, password);
    } catch (err) {
      setError("Invalid credentials or server error.");
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
        <h2 className="text-2xl font-bold text-blue-800 text-center">Login to Clinic System</h2>
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
        {error && <div className="text-red-600 text-sm text-center">{error}</div>}
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded transition"
          disabled={loading}
        >
          {loading ? "Logging in..." : "Login"}
        </button>
        <p className="text-center text-sm mt-2">
          New user? <Link to="/signup" className="text-blue-600 hover:underline">Sign up</Link>
        </p>
      </form>
    </div>
  );
}
