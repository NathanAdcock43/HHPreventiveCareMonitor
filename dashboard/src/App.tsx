import { useEffect, useState } from "react";
import "./App.css";

// API helper
const RAW_BASE = (process.env.REACT_APP_API_BASE || "").trim();
export const API_BASE = RAW_BASE.endsWith("/") ? RAW_BASE.slice(0, -1) : RAW_BASE;

async function apiFetch(path: string, init?: RequestInit) {
    const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
    const res = await fetch(url, init);
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`);
    }
    const ct = res.headers.get("content-type") || "";
    return ct.includes("application/json") ? res.json() : res.text();
}


type OpenAlertRow = {
    public_id: string;
    sex: "F" | "M" | "U" | null;
    alert_types: string[];
    last_updated: string;
};

export default function App() {
    const [member, setMember] = useState("M0001");
    const [alerts, setAlerts] = useState<any[]>([]);
    const [summary, setSummary] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [openItems, setOpenItems] = useState<OpenAlertRow[]>([]);
    const [openTotal, setOpenTotal] = useState<number>(0);

    /** Load alerts for a specific member (defaults to current). */
    const fetchAlerts = async (id?: string) => {
        setLoading(true);
        setError(null);
        try {
            const data = await apiFetch(`/members/${id ?? member}/alerts`);
            setAlerts(data);
        } catch (e: any) {
            setError(e.message || "Request failed");
        } finally {
            setLoading(false);
        }
    };

    const fetchSummary = async () => {
        try {
            const data = await apiFetch(`/alerts?type=A1C_OVERDUE`);
            setSummary((data as any).summary || []);
        } catch {
            /* ignore */
        }
    };

    const fetchOpenAlerts = async () => {
        try {
            const data = await apiFetch(`/alerts/open?limit=200&offset=0`);
            setOpenItems((data as any).items || []);
            setOpenTotal((data as any).total || 0);
        } catch (e: any) {
            setError(e.message || "Failed to load open alerts");
        }
    };

    const refresh = async (id?: string) => {
        await Promise.all([fetchAlerts(id), fetchSummary(), fetchOpenAlerts()]);
    };

    const createMember = async () => {
        setMsg(null);
        setError(null);
        try {
            const d: any = await apiFetch(`/simulate?action=member`, { method: "POST" });
            if (d.public_id) setMember(d.public_id);
            setMsg(`New member enrolled: ${d.public_id}`);
            await refresh(d.public_id);
            return d.public_id as string;
        } catch (e: any) {
            setError(e.message || "member create failed");
            return null;
        }
    };

    const simulate = async (action: string, targetPublicId: string) => {
        const url = `/simulate?action=${encodeURIComponent(action)}&publicId=${encodeURIComponent(
            targetPublicId
        )}`;
        try {
            const d = await apiFetch(url, { method: "POST" });
            return { ok: true, data: d };
        } catch (e: any) {
            return { ok: false, data: { message: e.message } };
        }
    };

    /** Prefer a random member with open alerts; fall back to current. */
    async function pickRandomMember(current: string): Promise<string> {
        try {
            const data: any = await apiFetch(`/alerts/open?limit=500&offset=0`);
            const ids: string[] = (data.items || []).map((x: any) => x.public_id);
            if (ids.length > 0) return ids[Math.floor(Math.random() * ids.length)];
        } catch {
            /* ignore */
        }
        return current;
    }

    // Map API action keys to the exact user-facing messages (as provided)
    const messageMap: Record<"lab_recent" | "lab_old" | "flu_recent" | "flu_old", string> = {
        lab_recent: "Member record for new A1C Lab received",
        lab_old: "Member record for outdated A1C Lab received",
        flu_recent: "Recent member Flu immunization record received",
        flu_old: "Outdated member Flu immunization records received",
    };

    /** Single “Random Event” button (no member creation as an event) */
    const runRandomEvent = async () => {
        setMsg(null);
        setError(null);

        const actions = ["lab_recent", "lab_old", "flu_recent", "flu_old"] as const;
        const action = actions[Math.floor(Math.random() * actions.length)];

        // choose a random member to target (prefer open alerts)
        let target = await pickRandomMember(member);

        // try once on the chosen target
        let r = await simulate(action, target);

        // if that member doesn't exist, create one and retry once
        if (!r.ok && (r.data as any)?.error === "not_found") {
            const pid = await createMember();
            if (!pid) {
                setError("Could not create member to run event.");
                return;
            }
            target = pid;
            r = await simulate(action, target);
        }

        if (!r.ok) {
            setError((r.data as any)?.message || "simulate failed");
            return;
        }

        // update UI to that member and force alerts refresh for it
        setMember(target);
        setMsg(`${messageMap[action]} (${target})`);
        await refresh(target);
    };

    useEffect(() => {
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="container">
            <div className="cushion">
                <h1 className="header">Preventive Care Internal Dashboard</h1>
                {/* Helpful during deploy/debug: show which API we're using */}
                {API_BASE && <div className="meta">API: {API_BASE}</div>}
            </div>

            <div className="card" style={{ marginTop: "10px" }}>
                <div className="cushion">
                    <div className="section-title">Members with open alerts</div>
                </div>
                <div className="fl-container">
                    <div className="fl-box"></div>
                    <div className="fl-box">
                        <div className="meta">Open: {openTotal}</div>
                    </div>
                    <div className="fl-box"></div>
                </div>

                <div className="grid-wrap">
                    <table className="open-grid">
                        <thead>
                        <tr>
                            <th>Member</th>
                            <th>Sex</th>
                            <th>Alert Types</th>
                            <th>Last Updated</th>
                        </tr>
                        </thead>
                        <tbody>
                        {openItems.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="meta" style={{ padding: 12 }}>
                                    No members with open alerts.
                                </td>
                            </tr>
                        ) : (
                            openItems.map((row) => (
                                <tr key={row.public_id}>
                                    <td>{row.public_id}</td>
                                    <td>{row.sex ?? "—"}</td>
                                    <td>
                                        {row.alert_types.map((t) => (
                                            <span key={t} className="badge">
                          {t}
                        </span>
                                        ))}
                                    </td>
                                    <td>{new Date(row.last_updated).toLocaleString()}</td>
                                </tr>
                            ))
                        )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex-container">
                <div className="flex-box">
                    {/* Member Select */}
                    <div className="cushion">
                        <h2 className="section-title">Member Select</h2>
                    </div>
                    <div className="toolbar">
                        <label className="label">Member ID:&nbsp;</label>
                        <input className="input" value={member} onChange={(e) => setMember(e.target.value)} />
                        <button className="btn" onClick={() => fetchAlerts(member)}>
                            Load
                        </button>
                    </div>

                    {/* Member Alerts */}
                    <div className="member-alert">Member Notifications</div>
                    {alerts.length === 0 ? (
                        <p className="meta">No active alerts.</p>
                    ) : (
                        <ul className="alert-list">
                            {alerts.map((a) => (
                                <li className="alert-row" key={`${a.type}-${a.detected_at}`}>
                                    <span>{a.status} ALERT (</span>
                                    <span className="alert-type">{a.type})</span>
                                    <span className="alert-meta">
                    (updated {new Date(a.updated_at).toLocaleString()})
                  </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="flex-box">
                    <div className="cushion">
                        <h2 className="section-title">Simulate Incoming SQS Events</h2>
                    </div>
                    <div className="toolbar" style={{ gap: "8px" }}>
                        <button className="btn" onClick={createMember}>
                            New Member Enrollment
                        </button>
                        <button className="btn primary" onClick={runRandomEvent}>
                            Random Medical Event
                        </button>
                    </div>

                    {msg && <p className="msg">{msg}</p>}
                    {error && (
                        <p role="alert" className="err">
                            Error: {error}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
