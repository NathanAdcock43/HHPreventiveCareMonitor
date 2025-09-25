import { useEffect, useState } from "react";
import "./App.css";

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
            const res = await fetch(`/members/${id ?? member}/alerts`);
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
        } catch {
            /* ignore */
        }
    };

    const fetchOpenAlerts = async () => {
        try {
            const res = await fetch(`/alerts/open?limit=200&offset=0`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setOpenItems(data.items || []);
            setOpenTotal(data.total || 0);
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
        const r = await fetch(`/simulate?action=member`, { method: "POST" });
        const d = await r.json();
        if (!r.ok) {
            setError(d.message || "member create failed");
            return null;
        }
        if (d.public_id) setMember(d.public_id);
        setMsg(`New member enrolled: ${d.public_id}`);
        await refresh(d.public_id);
        return d.public_id as string;
    };

    const simulate = async (action: string, targetPublicId: string) => {
        const url = `/simulate?action=${encodeURIComponent(
            action
        )}&publicId=${encodeURIComponent(targetPublicId)}`;
        const r = await fetch(url, { method: "POST" });
        const d = await r.json();
        return { ok: r.ok, data: d };
    };

    /** Prefer a random member with open alerts; fall back to current. */
    async function pickRandomMember(current: string): Promise<string> {
        try {
            const res = await fetch(`/alerts/open?limit=500&offset=0`);
            if (res.ok) {
                const data = await res.json();
                const ids: string[] = (data.items || []).map((x: any) => x.public_id);
                if (ids.length > 0) {
                    return ids[Math.floor(Math.random() * ids.length)];
                }
            }
        } catch {
            /* ignore */
        }
        return current;
    }

    // Map API action keys to the exact user-facing messages (as provided)
    const messageMap: Record<
        "lab_recent" | "lab_old" | "flu_recent" | "flu_old",
        string
    > = {
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
        if (!r.ok && r.data?.error === "not_found") {
            const pid = await createMember();
            if (!pid) {
                setError("Could not create member to run event.");
                return;
            }
            target = pid;
            r = await simulate(action, target);
        }

        if (!r.ok) {
            setError(r.data?.message || "simulate failed");
            return;
        }

        // update UI to that member and force alerts refresh for it
        setMember(target);
        setMsg(`${messageMap[action]} (${target})`);
        await refresh(target);
    };

    useEffect(() => {
        refresh();
    }, []);

    return (
        <div className="container">
            <div className="cushion">
                <h1 className="header">Preventive Care Internal Dashboard</h1>
            </div>

            <div className="card" style={{marginTop: "10px"}}>
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
                                <td colSpan={4} className="meta" style={{padding: 12}}>
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
                        <input
                            className="input"
                            value={member}
                            onChange={(e) => setMember(e.target.value)}
                        />
                        <button className="btn" onClick={() => fetchAlerts(member)}>
                            Load
                        </button>
                    </div>

                    {/* Member Alerts (softer heading, no bullets) */}
                    <div className="member-alert">
                        Member Notifications
                    </div>
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
                    <div className="toolbar" style={{gap: "8px"}}>
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