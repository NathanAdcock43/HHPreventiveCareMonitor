import { useEffect, useState } from "react";

export default function App() {
    const [member, setMember] = useState("M0002");
    const [alerts, setAlerts] = useState<any[]>([]);
    const [summary, setSummary] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchAlerts = async () => {
        setLoading(true); setError(null);
        try {
            const res = await fetch(`/members/${member}/alerts`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setAlerts(await res.json());
        } catch (e: any) {
            setError(e.message || "Request failed");
        } finally {
            setLoading(false);
        }
    };

    const fetchSummary = async () => {
        try {
            const res = await fetch(`/alerts?type=A1C_OVERDUE`);
            const data = await res.json();
            setSummary(data.summary || []);
        } catch {}
    };

    const refresh = async () => {
        await fetchAlerts();
        await fetchSummary();
    };

    const createMember = async () => {
        setMsg(null); setError(null);
        const r = await fetch(`/simulate?action=member`, { method: "POST" });
        const d = await r.json();
        if (!r.ok) return setError(d.message || "member create failed");
        if (d.public_id) setMember(d.public_id);
        setMsg(`Member created: ${d.public_id}`);
        await refresh();
    };

    const createLabRecent = async () => {
        setMsg(null); setError(null);
        const r = await fetch(`/simulate?action=lab_recent&publicId=${encodeURIComponent(member)}`, { method: "POST" });
        const d = await r.json();
        if (!r.ok) return setError(d.message || "lab create failed");
        setMsg(`A1C added (${member})`);
        await refresh();
    };

    const createLabOld = async () => {
        setMsg(null); setError(null);
        const r = await fetch(`/simulate?action=lab_old&publicId=${encodeURIComponent(member)}`, { method: "POST" });
        const d = await r.json();
        if (!r.ok) return setError(d.message || "lab create failed");
        setMsg(`Old A1C added (${member})`);
        await refresh();
    };

    const createFluRecent = async () => {
        setMsg(null); setError(null);
        const r = await fetch(`/simulate?action=flu_recent&publicId=${encodeURIComponent(member)}`, { method: "POST" });
        const d = await r.json();
        if (!r.ok) return setError(d.message || "immunization failed");
        setMsg(`Flu (recent) added (${member})`);
        await refresh();
    };

    const createFluOld = async () => {
        setMsg(null); setError(null);
        const r = await fetch(`/simulate?action=flu_old&publicId=${encodeURIComponent(member)}`, { method: "POST" });
        const d = await r.json();
        if (!r.ok) return setError(d.message || "immunization failed");
        setMsg(`Flu (old) added (${member})`);
        await refresh();
    };

    useEffect(() => { refresh(); }, []);

    return (
        <div style={{ padding: 24 }}>
            <h1>HH Preventive Care Monitor</h1>

            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
                <label>Member:&nbsp;</label>
                <input value={member} onChange={(e) => setMember(e.target.value)} />
                <button onClick={fetchAlerts}>Load Alerts</button>
                <button onClick={createMember}>+ Member</button>
                <button onClick={createLabRecent}>+ A1C (recent ~90d)</button>
                <button onClick={createLabOld}>+ A1C (old ~250d)</button>
                <button onClick={createFluRecent}>+ Flu (recent ~200d)</button>
                <button onClick={createFluOld}>+ Flu (old ~400d)</button>
            </div>

            {msg && <p style={{ color: "green" }}>{msg}</p>}
            {loading && <p>Loading…</p>}
            {error && <p role="alert" style={{ color: "crimson" }}>Error: {error}</p>}

            <h2>Member Alerts</h2>
            {alerts.length === 0 ? (
                <p>No active alerts.</p>
            ) : (
                <ul>
                    {alerts.map((a) => (
                        <li key={`${a.type}-${a.detected_at}`}>
                            <b>{a.type}</b> — {a.status} (updated {new Date(a.updated_at).toLocaleString()})
                        </li>
                    ))}
                </ul>
            )}

            <h2>Summary (A1C_OVERDUE)</h2>
            <ul>
                {summary.map((s: any) => (
                    <li key={s.status}>{s.status}: {s.count}</li>
                ))}
            </ul>
        </div>
    );
}