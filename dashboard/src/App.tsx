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
        } catch {/* ignore */}
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

    const refresh = async () => {
        await Promise.all([fetchAlerts(), fetchSummary(), fetchOpenAlerts()]);
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
        await refresh();
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
    async function pickRandomMember(current: string): Promise<string | null> {
        try {
            const res = await fetch(`/alerts/open?limit=500&offset=0`);
            if (res.ok) {
                const data = await res.json();
                const ids: string[] = (data.items || []).map((x: any) => x.public_id);
                if (ids.length > 0) {
                    return ids[Math.floor(Math.random() * ids.length)];
                }
            }
        } catch {/* ignore */}
        return current || null;
    }

    /** Single “Random Event” button logic */
    const runRandomEvent = async () => {
        setMsg(null);
        setError(null);

        const actions = ["lab_recent", "lab_old", "flu_recent", "flu_old"] as const;

        // renamed prettyMap -> messageMap for clarity
        const messageMap: Record<typeof actions[number], string> = {
            lab_recent: "Member file for new A1C Lab",
            lab_old: "Member file for outdated A1C Lab",
            flu_recent: "Member received recent Flu imunization",
            flu_old: "Oudated member Flu imunization records received",
        };

        const action = actions[Math.floor(Math.random() * actions.length)];
        let target = (await pickRandomMember(member)) || member;

        let r = await simulate(action, target);

        // auto-create a member if target doesn't exist
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
        await Promise.all([fetchAlerts(target), fetchSummary(), fetchOpenAlerts()]);

        // determine if an alert was closed for this member
        const closedNow = (type: string) =>
            alerts.some((a: any) => a.type === type && a.status === "CLOSED");

        const msgClosed =
            (action === "lab_recent" && closedNow("A1C_OVERDUE")) ||
            (action === "flu_recent" && closedNow("FLU_OVERDUE"));

        setMsg(`${msgClosed ? "Alert Closed: " : ""}${messageMap[action]} (${target})`);
    };

    useEffect(() => {
        refresh();
    }, []);

    return (
        <div className="app">
            <h1 className="header">Preventive Care Internal DashBoard</h1>

            <div className="toolbar">
                <label>Member:&nbsp;</label>
                <input
                    className="input"
                    value={member}
                    onChange={(e) => setMember(e.target.value)}
                />
                <button className="btn" onClick={() => fetchAlerts(member)}>
                    Load Alerts
                </button>
            </div>

            {loading && <p>Loading…</p>}
            {error && (
                <p role="alert" className="err">
                    Error: {error}
                </p>
            )}

            {/* Member-specific alerts */}
            <h2 className="section-title">Member Alerts</h2>
            {alerts.length === 0 ? (
                <p className="meta">No active alerts.</p>
            ) : (
                <ul>
                    {alerts.map((a) => (
                        <li key={`${a.type}-${a.detected_at}`}>
                            <b>{a.type}</b> — {a.status} (updated{" "}
                            {new Date(a.updated_at).toLocaleString()})
                        </li>
                    ))}
                </ul>
            )}

            <h2 className="section-title">Members with Open Alerts</h2>
            <div className="meta">Open: {openTotal}</div>

            <div className="center-wrap">
                <div className="card">
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
            </div>

            <h2 className="section-title">Simulate System Events</h2>
            <button className="btn" onClick={createMember}>
                Member Enrollment
            </button>
            <button className="btn" onClick={runRandomEvent}>
                Random Medical Event
            </button>
            {msg && <p className="msg">{msg}</p>}
        </div>
    );
}
