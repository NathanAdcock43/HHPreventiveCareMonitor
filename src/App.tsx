import React from "react";
import { useEffect, useState } from "react";

export default function App() {
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    fetch("/health")
        .then((r) => r.json())
        .then(setStatus)
        .catch((e) => setStatus({ error: String(e) }));
  }, []);

  return (
      <div style={{ fontFamily: "system-ui", padding: 24 }}>
        <h1>HHPreventiveCareMonitor</h1>
        <pre>{JSON.stringify(status, null, 2)}</pre>
      </div>
  );
}