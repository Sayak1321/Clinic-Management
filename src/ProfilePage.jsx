import { useState, useEffect } from "react";
import PocketBase from "pocketbase";
import { useNavigate } from "react-router-dom";

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [avatar, setAvatar] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const pb = new PocketBase("http://127.0.0.1:8090");
    const authUser = pb.authStore.model;
    if (!authUser) {
      navigate("/login");
      return;
    }
    setUser(authUser);
    setName(authUser.name || "");
    setRole(authUser.role || "");
    setEmail(authUser.email || "");
    if (authUser.avatar) {
      setAvatarUrl(pb.files.getUrl(authUser, authUser.avatar));
    }
    // If receptionist, fetch phone from staff collection
    if ((authUser.role === "Receptionist" || authUser.role === "receptionist") && authUser.id) {
      pb.collection("staff").getFullList({ filter: `user = '${authUser.id}'` })
        .then(staffList => {
          if (staffList.length > 0 && staffList[0].phone) {
            setPhone(staffList[0].phone);
          } else {
            setPhone(authUser.phone || "");
          }
        })
        .catch(() => setPhone(authUser.phone || ""))
        .finally(() => setLoading(false));
    } else {
      setPhone(authUser.phone || "");
      setLoading(false);
    }
  }, [navigate]);

  const handleAvatarChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setAvatar(e.target.files[0]);
      setAvatarUrl(URL.createObjectURL(e.target.files[0]));
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const pb = new PocketBase("http://127.0.0.1:8090");
      const formData = new FormData();
      formData.append("name", name);
      formData.append("role", role);
      if (avatar) formData.append("avatar", avatar);
      formData.append("phone", phone);
      formData.append("email", email);

      // If user is a Receptionist, update or create their record in staff collection
      if (role === "Receptionist") {
        const staffData = { name, role, user: user.id, phone, email };
        if (avatar) staffData.avatar = avatar;
        try {
          // Try to find an existing staff record for this user
          const staffList = await pb.collection("staff").getFullList({ filter: `user = '${user.id}'` });
          if (staffList.length > 0) {
            // Try to update, but if not found, create
            try {
              await pb.collection("staff").update(staffList[0].id, staffData);
            } catch (err) {
              if (err?.status === 404) {
                await pb.collection("staff").create(staffData);
              } else {
                throw err;
              }
            }
          } else {
            // Create new staff record
            await pb.collection("staff").create(staffData);
          }
        } catch (err) {
          // If getFullList or update fails, fallback to create
          await pb.collection("staff").create(staffData);
        }
      }

      // If user is a Doctor, update or create their record in doctors collection
      if (role === "Doctor") {
        const doctorData = { name, user: user.id, email };
        if (avatar) doctorData.avatar = avatar;
        try {
          // Try to find an existing doctor record for this user
          const doctorList = await pb.collection("doctors").getFullList({ filter: `user = '${user.id}'` });
          if (doctorList.length > 0) {
            // Try to update, but if not found, create
            try {
              await pb.collection("doctors").update(doctorList[0].id, doctorData);
            } catch (err) {
              if (err?.status === 404) {
                await pb.collection("doctors").create(doctorData);
              } else {
                throw err;
              }
            }
          } else {
            // Create new doctor record
            await pb.collection("doctors").create(doctorData);
          }
        } catch (err) {
          // If getFullList or update fails, fallback to create
          await pb.collection("doctors").create(doctorData);
        }
      }

      setEditing(false);
      window.location.reload();
    } catch (err) {
      setError("Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-8">Loading...</div>;
  if (!user) return null;

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-xl shadow mt-8">
      <h2 className="text-2xl font-bold text-blue-800 mb-4">Edit Profile</h2>
      <div className="flex flex-col items-center gap-2 mb-4">
        <img
          src={avatarUrl || "https://ui-avatars.com/api/?name=" + encodeURIComponent(name)}
          alt="Profile"
          className="w-24 h-24 rounded-full object-cover border-2 border-blue-300"
        />
        {editing && <input type="file" accept="image/*" onChange={handleAvatarChange} className="mt-2" />}
      </div>
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <label className="block">
          <span className="text-blue-800 font-medium">Name</span>
          <input
            type="text"
            className="border border-blue-200 rounded px-4 py-2 w-full mt-1"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            readOnly={!editing}
          />
        </label>
        <label className="block">
          <span className="text-blue-800 font-medium">Role</span>
          <select
            className="border border-blue-200 rounded px-4 py-2 w-full mt-1"
            value={role}
            onChange={e => setRole(e.target.value)}
            required
            disabled={!editing}
          >
            <option value="Doctor">Doctor</option>
            <option value="Receptionist">Receptionist</option>
          </select>
        </label>
        {role === "Receptionist" && (
          <label className="block">
            <span className="text-blue-800 font-medium">Phone</span>
            <input
              type="tel"
              className="border border-blue-200 rounded px-4 py-2 w-full mt-1"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              required={role === "Receptionist"}
              readOnly={!editing}
            />
          </label>
        )}
        <label className="block">
          <span className="text-blue-800 font-medium">Email</span>
          <input
            type="email"
            className="border border-blue-200 rounded px-4 py-2 w-full mt-1"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            readOnly={!editing}
          />
        </label>
        {error && <div className="text-red-600 text-sm text-center">{error}</div>}
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded transition"
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
