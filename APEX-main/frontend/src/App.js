import { useEffect, useState } from "react";
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
    window.__APEX_ACTIVE_USER__ = user;
  }, [user]);

  useEffect(() => {
    if (window.__APEX_FETCH_PATCHED__) return;

    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init = {}) => {
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
      return nativeFetch(input, { ...init, headers });
    };

    window.__APEX_FETCH_PATCHED__ = true;
  }, []);

  if (!user) {
    return <Login onLogin={u => {
      window.__APEX_ACTIVE_USER__ = u;
      setUser(u);
      setPage(firstAllowedPage(u));
    }} />;
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
    <DataProvider>
      <Layout
        user={user}
        onLogout={() => {
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
  );
}
