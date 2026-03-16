import { useState } from "react";
import { API_URL, C } from "./shared/constants";
import { Login } from "./shared/ui";
import Layout from "./components/Layout_Colapsable";
import Dashboard     from "./components/Dashboard";
import Personal      from "./components/Personal";
import Horarios      from "./components/Horarios";
import MapaOperarios from "./components/MapaOperarios";
import Vehiculos     from "./components/Vehiculos";
import Servicios     from "./components/Servicios";
import Referencias   from "./components/Referencias";
import Reportes      from "./components/Reportes";

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

  if (!user) {
    return <Login onLogin={u => { setUser(u); setPage("dashboard"); }} />;
  }

  const pages = {
    dashboard:   <Dashboard    onNavigate={setPage} user={user} />,
    personal:    <Personal     onBack={() => setPage("dashboard")} />,
    servicios:   <Servicios    onBack={() => setPage("dashboard")} user={user} />,
    vehiculos:   <Vehiculos    onBack={() => setPage("dashboard")} />,
    referencias: <Referencias  onBack={() => setPage("dashboard")} />,
    horarios:    <Horarios     onBack={() => setPage("dashboard")} user={user} />,
    reportes:    <Reportes     onBack={() => setPage("dashboard")} />,
  };

  return (
    <DataProvider>
      <Layout
        user={user}
        onLogout={() => { setUser(null); setPage("dashboard"); }}
        activePage={page}
        onNavigate={setPage}
      >
        {pages[page] || pages.dashboard}
      </Layout>
    </DataProvider>
  );
}
