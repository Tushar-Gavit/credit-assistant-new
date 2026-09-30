import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { api, getToken, setSession } from "./api";
import Dashboard from "./Dashboard.jsx";

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("register");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const body = mode === "register" ? form : { email: form.email, password: form.password };
      const data = await api(`/auth/${mode}`, { method: "POST", body });
      setSession(data.access_token);
      onAuth(data.user);
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-md content-center px-5">
      <div className="mb-6 flex items-center gap-2 text-xl font-bold"><ShieldCheck className="text-saffron" /> Credit Assistant</div>
      <form onSubmit={submit} className="panel space-y-3">
        <h1 className="text-lg font-semibold">{mode === "register" ? "Create your account" : "Sign in"}</h1>
        {mode === "register" && <input className="input" placeholder="Full name" value={form.name} onChange={set("name")} required minLength={2} />}
        <input className="input" type="email" placeholder="Email" value={form.email} onChange={set("email")} required />
        <input className="input" type="password" placeholder="Password (8+ characters)" value={form.password} onChange={set("password")} required minLength={8} />
        {err && <p role="alert" className="text-sm text-risk">{err}</p>}
        <button className="btn w-full" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{mode === "register" ? "Create account" : "Sign in"}</button>
        <button type="button" className="w-full text-sm underline" onClick={() => setMode(mode === "register" ? "login" : "register")}>
          {mode === "register" ? "I already have an account" : "Create a new account"}
        </button>
      </form>
    </main>
  );
}

export default function App() {
  const [user, setUser] = useState(() => (getToken() ? {} : null));
  if (!user) return <AuthScreen onAuth={setUser} />;
  return <Dashboard onLogout={() => { setSession(null); setUser(null); }} />;
}
