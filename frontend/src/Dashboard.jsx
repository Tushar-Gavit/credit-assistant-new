import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AlertTriangle, CreditCard, Gauge, Landmark, Loader2, LogOut, Minus, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { api } from "./api";

const DTI_TARGET = 35, CUR_TARGET = 30;
const MILESTONES = [{ y: 650, label: "Fair" }, { y: 700, label: "Good" }, { y: 750, label: "Excellent" }];
const inr = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
const bandColor = { Excellent: "text-good", Good: "text-good", Fair: "text-saffron", "Needs Attention": "text-risk" };
const sevColor = { high: "bg-risk", medium: "bg-saffron", low: "bg-good" };
const EMPTY = { cibil_score: "", monthly_income: "", total_emi: "", card_limit: "", card_balance: "" };

function Kpi({ icon: Icon, label, value, sub, tone }) {
  return (
    <div className="panel">
      <div className="flex items-center gap-2 text-sm text-ink/70"><Icon className="h-4 w-4" />{label}</div>
      <div className={`mt-2 text-3xl font-bold ${tone || ""}`}>{value}</div>
      <div className="mt-1 text-sm text-ink/70">{sub}</div>
    </div>
  );
}

function Delta({ d }) {
  if (d == null) return <span>First entry</span>;
  if (d === 0) return <span className="inline-flex items-center gap-1"><Minus className="h-4 w-4" />No change</span>;
  const up = d > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return <span className={`inline-flex items-center gap-1 font-semibold ${up ? "text-good" : "text-risk"}`}><Icon className="h-4 w-4" />{up ? "+" : ""}{d} since last entry</span>;
}

export default function Dashboard({ onLogout }) {
  const [history, setHistory] = useState([]);
  const [advisory, setAdvisory] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [advising, setAdvising] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const h = await api("/metrics");
    setHistory(h);
    if (h.length) {
      const l = h[h.length - 1];
      setForm({ cibil_score: l.cibil_score, monthly_income: l.monthly_income, total_emi: l.total_emi, card_limit: l.card_limit, card_balance: l.card_balance });
      api("/advisory/latest").then(setAdvisory).catch(() => setAdvisory(null));
    }
  }, []);

  useEffect(() => { load().catch((e) => setErr(e.message)).finally(() => setLoading(false)); }, [load]);

  const latest = history[history.length - 1];

  async function submit(e) {
    e.preventDefault();
    setSaving(true); setErr(""); setNotice("");
    try {
      const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, Number(v)]));
      const saved = await api("/metrics", { method: "POST", body });
      setHistory((h) => [...h, saved]);
      setNotice(saved.score_delta == null ? "First entry saved." : `Entry saved. Score change: ${saved.score_delta > 0 ? "+" : ""}${saved.score_delta}.`);
    } catch (e2) { setErr(e2.message); } finally { setSaving(false); }
  }

  async function advise() {
    setAdvising(true); setErr("");
    try { setAdvisory(await api("/advisory", { method: "POST" })); }
    catch (e2) { setErr(e2.message); } finally { setAdvising(false); }
  }

  const chartData = useMemo(() => history.map((m) => ({
    date: new Date(m.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    score: m.cibil_score,
  })), [history]);

  const yDomain = useMemo(() => {
    const min = Math.min(...chartData.map((d) => d.score), 650);
    return [Math.max(300, Math.floor((min - 40) / 50) * 50), 850];
  }, [chartData]);

  const donut = latest ? [
    { name: "Used", value: latest.card_balance },
    { name: "Available", value: Math.max(latest.card_limit - latest.card_balance, 0) },
  ] : [];
  const curOk = latest && latest.cur_ratio < CUR_TARGET;
  const dtiOk = latest && latest.dti_ratio < DTI_TARGET;
  const num = (k) => ({ value: form[k], onChange: (e) => setForm({ ...form, [k]: e.target.value }), required: true, type: "number", step: "any", className: "input" });

  if (loading) return <div className="grid min-h-screen place-items-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Credit Assistant</h1>
        <button className="inline-flex items-center gap-2 text-sm underline" onClick={onLogout}><LogOut className="h-4 w-4" />Sign out</button>
      </header>

      {latest && (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi icon={Gauge} label="CIBIL score" value={latest.cibil_score} tone={bandColor[latest.score_band]} sub={<><b className={bandColor[latest.score_band]}>{latest.score_band}</b> · <Delta d={latest.score_delta} /></>} />
          <Kpi icon={Landmark} label="Debt-to-income" value={`${latest.dti_ratio}%`} tone={dtiOk ? "text-good" : "text-risk"} sub={`Target under ${DTI_TARGET}% · EMIs ${inr(latest.total_emi)}`} />
          <Kpi icon={CreditCard} label="Credit utilization" value={`${latest.cur_ratio}%`} tone={curOk ? "text-good" : "text-risk"} sub={`Target under ${CUR_TARGET}% · ${inr(latest.card_balance)} of ${inr(latest.card_limit)}`} />
          <Kpi icon={TrendingUp} label="Entries tracked" value={history.length} sub={`Last update ${new Date(latest.created_at).toLocaleDateString("en-IN")}`} />
        </section>
      )}

      <section className="grid gap-5 lg:grid-cols-3">
        <div className="panel lg:col-span-2">
          <h2 className="mb-3 font-semibold">CIBIL score progression</h2>
          {chartData.length ? (
            <div className="h-72">
              <ResponsiveContainer>
                <LineChart data={chartData} margin={{ top: 8, right: 56, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="#D5DEDB" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis domain={yDomain} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  {MILESTONES.map((m) => (
                    <ReferenceLine key={m.y} y={m.y} stroke="#E39A1B" strokeDasharray="5 4" label={{ value: `${m.y} ${m.label}`, position: "right", fontSize: 11, fill: "#10302E" }} />
                  ))}
                  <Line type="monotone" dataKey="score" name="CIBIL" stroke="#10302E" strokeWidth={2.5} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-sm text-ink/70">Add your first entry to start the chart.</p>}
        </div>

        <div className="panel">
          <h2 className="mb-3 font-semibold">Card utilization</h2>
          {latest ? (
            <div className="relative h-56">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={donut} dataKey="value" innerRadius={62} outerRadius={88} startAngle={90} endAngle={-270} stroke="none">
                    <Cell fill={curOk ? "#2F8F6B" : "#C8452F"} />
                    <Cell fill="#D5DEDB" />
                  </Pie>
                  <Tooltip formatter={(v) => inr(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                <div><div className="text-2xl font-bold">{latest.cur_ratio}%</div><div className="text-xs text-ink/70">of limit used</div></div>
              </div>
            </div>
          ) : <p className="text-sm text-ink/70">No data yet.</p>}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <form onSubmit={submit} className="panel space-y-3">
          <h2 className="font-semibold">{latest ? "Update your numbers" : "Enter your financial details"}</h2>
          <label className="block text-sm">CIBIL score (300–900)<input {...num("cibil_score")} min={300} max={900} /></label>
          <label className="block text-sm">Monthly net in-hand income (₹)<input {...num("monthly_income")} min={1} /></label>
          <label className="block text-sm">Total active monthly EMIs (₹)<input {...num("total_emi")} min={0} /></label>
          <label className="block text-sm">Total credit card limit (₹)<input {...num("card_limit")} min={0} /></label>
          <label className="block text-sm">Card balance used (₹)<input {...num("card_balance")} min={0} /></label>
          {err && <p role="alert" className="text-sm text-risk">{err}</p>}
          {notice && <p role="status" className="text-sm text-good">{notice}</p>}
          <button className="btn w-full" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Save entry</button>
        </form>

        <div className="panel lg:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-semibold">Your improvement roadmap</h2>
            <button className="btn" onClick={advise} disabled={!latest || advising}>
              {advising ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {advisory ? "Refresh advice" : "Get advice"}
            </button>
          </div>
          {!advisory ? (
            <p className="text-sm text-ink/70">Save an entry, then select Get advice for a plan based on your latest numbers.</p>
          ) : (
            <div className="space-y-5">
              <p className="text-sm leading-relaxed">{advisory.summary}</p>
              <div className="space-y-2">
                {advisory.bottlenecks.map((b, i) => (
                  <div key={i} className="flex gap-3 text-sm">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-saffron" />
                    <div><span className="font-semibold">{b.issue}</span> <span className={`ml-1 rounded px-1.5 py-0.5 text-xs text-white ${sevColor[b.severity]}`}>{b.severity}</span><p className="text-ink/80">{b.detail}</p></div>
                  </div>
                ))}
              </div>
              <ol className="space-y-3 border-l-2 border-rule pl-4">
                {advisory.roadmap.map((s) => (
                  <li key={s.step} className="text-sm">
                    <div className="font-semibold">Step {s.step}: {s.title}</div>
                    <p>{s.action}</p>
                    <p className="text-ink/70">{s.timeline} · {s.expected_impact}</p>
                  </li>
                ))}
              </ol>
              <p className="text-xs text-ink/60">Educational guidance, not regulated financial advice. Bureau changes usually show in 30–45 days.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
