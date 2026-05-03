import React, { useEffect, useState } from "react";
import { API_URL } from "./shared/constants";
import { Login } from "./shared/ui";
import Layout from "./components/Layout_Colapsable";
import Dashboard     from "./components/Dashboard";
import Personal      from "./components/Personal";
import Horarios      from "./components/Horarios";
import Vehiculos     from "./components/Vehiculos";
import Servicios     from "./components/Servicios";
import Referencias   from "./components/Referencias";
import Reportes      from "./components/Reportes";
import Roles         from "./components/Roles";
import ConfiguracionNomina from "./components/ConfiguracionNomina";
import Nomina        from "./components/Nomina";
import { can, firstAllowedPage } from "./shared/permissions";

// ============================================================
// IMPORTAR CONTEXT API PARA CACHÉ DE DATOS
// ============================================================
import { DataProvider } from "./context/DataContext";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) { console.error("APEX Error:", error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", background: "#111111", display: "flex",
          alignItems: "center", justifyContent: "center", fontFamily: "'Poppins', sans-serif" }}>
          <div style={{ textAlign: "center", color: "#fff" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Algo salio mal</div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 24 }}>
              La plataforma encontro un error inesperado
            </div>
            <button onClick={() => window.location.reload()}
              style={{ background: "#2563EB", color: "#fff", border: "none",
                padding: "12px 24px", borderRadius: 10, fontSize: 13,
                fontFamily: "'Poppins', sans-serif", cursor: "pointer", fontWeight: 600 }}>
              Recargar plataforma
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================================================
// CARGAR LEAFLET (para mapas)
// ============================================================
if (!document.getElementById("leaflet-css")) {
  const link = document.createElement("link");
  link.id = "leaflet-css"; 
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  document.head.appendChild(link);
  
  const script = document.createElement("script");
  script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
  document.head.appendChild(script);
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("dashboard");

  useEffect(() => {
    const checkSession = () => {
      const token = sessionStorage.getItem("apex_token");
      if (!token && user) {
        setUser(null);
      }
    };
    const interval = setInterval(checkSession, 60000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    window.__APEX_ACTIVE_USER__ = user;
  }, [user]);

  useEffect(() => {
    const handleSessionExpired = () => {
      sessionStorage.removeItem("apex_token");
      window.__APEX_ACTIVE_USER__ = null;
      setUser(null);
      setPage("dashboard");
    };
    window.addEventListener("apex:session-expired", handleSessionExpired);
    return () => window.removeEventListener("apex:session-expired", handleSessionExpired);
  }, []);

  useEffect(() => {
    if (window.__APEX_FETCH_PATCHED__) return;

    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input, init = {}) => {
      const currentUser = window.__APEX_ACTIVE_USER__;
      const url = typeof input === "string" ? input : input?.url || "";
      const shouldInject =
        Boolean(currentUser?.id) &&
        (url.startsWith(API_URL) || url.startsWith("/") || !/^https?:\/\//i.test(url));

      if (!shouldInject) {
        return nativeFetch(input, init);
      }

      const headers = new Headers(init.headers || (input instanceof Request ? input.headers : {}));
      headers.set("X-User-Id", String(currentUser.id));
      const token = sessionStorage.getItem("apex_token") || "";
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const response = await nativeFetch(input, { ...init, headers });
      if (response.status === 401) {
        window.dispatchEvent(new Event("apex:session-expired"));
      }
      return response;
    };

    window.__APEX_FETCH_PATCHED__ = true;
  }, []);

  if (!user) {
    return (
      <ErrorBoundary>
        <Login onLogin={u => {
          window.__APEX_ACTIVE_USER__ = u;
          setUser(u);
          setPage(firstAllowedPage(u));
        }} />
      </ErrorBoundary>
    );
  }

  const safePage = can(user, page, "access") ? page : firstAllowedPage(user);

  const pages = {
    dashboard:   <Dashboard    onNavigate={setPage} user={user} />,
    personal:    <Personal     onBack={() => setPage("dashboard")} user={user} />,
    roles:       <Roles        onBack={() => setPage("dashboard")} user={user} />,
    servicios:   <Servicios    onBack={() => setPage("dashboard")} user={user} />,
    vehiculos:   <Vehiculos    onBack={() => setPage("dashboard")} user={user} />,
    referencias: <Referencias  onBack={() => setPage("dashboard")} user={user} />,
    horarios:    <Horarios     onBack={() => setPage("dashboard")} user={user} />,
    configuracion: <ConfiguracionNomina onBack={() => setPage("dashboard")} user={user} />,
    nomina:      <Nomina       onBack={() => setPage("dashboard")} user={user} />,
    reportes:    <Reportes     onBack={() => setPage("dashboard")} user={user} />,
  };

  return (
    <ErrorBoundary>
      <DataProvider>
        <Layout
          user={user}
          onLogout={() => {
            sessionStorage.removeItem("apex_token");
            window.__APEX_ACTIVE_USER__ = null;
            setUser(null);
            setPage("dashboard");
          }}
          activePage={safePage}
          onNavigate={setPage}
        >
          {pages[safePage] || pages.dashboard}
        </Layout>
      </DataProvider>
    </ErrorBoundary>
  );
}
