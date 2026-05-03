import { useState, useEffect } from "react";
import { C, API_URL } from "../shared/constants";
import { Card, PageHeader } from "../shared/ui";
import { can } from "../shared/permissions";
import logo from "../assets/logo1.JPG";

const KPICard = ({ label, value, sub, color, icon }) => (
  <div style={{
    background: C.card, borderRadius: 14, padding: "20px 22px",
    border: `1px solid ${C.border}`, flex: 1, minWidth: 160,
    position: "relative", overflow: "hidden",
  }}>
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, height: 3,
      background: color, borderRadius: "14px 14px 0 0"
    }} />
    <div style={{
      width: 40, height: 40, borderRadius: 10, marginBottom: 12,
      background: color + "15", display: "flex", alignItems: "center", justifyContent: "center"
    }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={icon} />
      </svg>
    </div>
    <div style={{ fontSize: 28, fontWeight: 900, color: C.text, lineHeight: 1 }}>{value}</div>
    <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
    {sub && <div style={{ fontSize: 10, color: color, fontWeight: 600, marginTop: 2 }}>{sub}</div>}
  </div>
);

const BarChart = ({ data, color }) => {
  const max = Math.max(...data.map(d => d.val), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 60 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{
            width: "100%", borderRadius: 4,
            height: Math.max((d.val / max) * 52, 4),
            background: i === data.length - 1 ? color : color + "50",
            transition: "height 0.5s ease"
          }} />
          <div style={{ fontSize: 9, color: C.muted, fontWeight: 500 }}>{d.label}</div>
        </div>
      ))}
    </div>
  );
};

const MODULE_ICONS = {
  servicios:     "M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z",
  horarios:      "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  vehiculos:     "M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0zM13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10",
  personal:      "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  roles:         "M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z",
  referencias:   "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  configuracion: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  nomina:        "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z",
  reportes:      "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  kpis:          "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
};

const MODULES = [
  { id: "servicios",     title: "Servicio Tecnico",   sub: "Inspecciones y ordenes",  color: "#06D6A0", ok: true },
  { id: "horarios",      title: "Control Horarios",   sub: "Asistencia y turnos",     color: "#F59E0B", ok: true },
  { id: "vehiculos",     title: "Gestion de Flota",   sub: "Vehiculos registrados",   color: "#F59E0B", ok: true },
  { id: "personal",      title: "Personal",           sub: "Empleados y tecnicos",    color: "#8B5CF6", ok: true },
  { id: "roles",         title: "Roles y Perfiles",   sub: "Permisos y accesos",      color: "#22C55E", ok: true },
  { id: "referencias",   title: "Referencias",        sub: "Catalogo de equipos",     color: "#EC4899", ok: true },
  { id: "configuracion", title: "Configuracion",      sub: "Parametros de nomina",    color: "#2563EB", ok: true },
  { id: "nomina",        title: "Nomina Quincenal",   sub: "Procesos y liquidacion",  color: "#14B8A6", ok: true },
  { id: "reportes",      title: "Reportes",           sub: "Estadisticas y KPIs",     color: "#2563EB", ok: true },
];

const DIAS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Hoy"];

const Dashboard = ({ onNavigate, user }) => {
  const [stats, setStats] = useState({ ordenes_hoy: 0, personal_activo: 0, vehiculos_activos: 0, novedades: 0 });

  useEffect(() => {
    fetch(`${API_URL}/stats`).then(r => r.json()).then(d => {
      if (d && typeof d === "object") setStats({
        ordenes_hoy:       d.ordenes_hoy       || d.servicios_hoy    || 0,
        personal_activo:   d.personal_activo   || 0,
        vehiculos_activos: d.vehiculos_activos || d.vehiculos_en_ruta || 0,
        novedades:         d.novedades         || d.novedades_hoy     || 0,
      });
    }).catch(() => {});
  }, []);

  const barData = DIAS.map((label, i) => ({
    label,
    val: i === 6 ? stats.ordenes_hoy : Math.max(0, stats.ordenes_hoy - Math.floor(Math.random() * 3))
  }));

  const eficiencia = stats.ordenes_hoy > 0
    ? Math.min(100, Math.round((stats.ordenes_hoy / (stats.ordenes_hoy + stats.novedades + 1)) * 100))
    : 0;

  const fecha = new Date().toLocaleDateString("es-CO", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });

  const visibleModules = MODULES.filter(m => m.ok ? can(user, m.id, "access") : true);

  return (
    <div style={{ fontFamily: "'Poppins', sans-serif", position: "relative" }}>

      {/* MARCA DE AGUA */}
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        opacity: 0.03, pointerEvents: "none", userSelect: "none", zIndex: 0
      }}>
        <img src={logo} alt="" style={{ width: 480, filter: "grayscale(100%)" }} />
      </div>

      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, position: "relative", zIndex: 1 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>
            Bienvenido, {user?.nombre?.split(" ")[0] || "Admin"}
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2, textTransform: "capitalize" }}>{fecha}</div>
        </div>
        <img src={logo} alt="APEX" style={{ height: 32, objectFit: "contain", opacity: 0.8 }} />
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12, marginBottom: 20, flexWrap: "wrap", position: "relative", zIndex: 1 }}>
        <KPICard
          label="Servicios Hoy" value={stats.ordenes_hoy} color="#2563EB"
          sub="ordenes activas"
          icon="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"
        />
        <KPICard
          label="Personal Activo" value={stats.personal_activo} color="#8B5CF6"
          sub="en jornada"
          icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
        />
        <KPICard
          label="Vehiculos en Ruta" value={stats.vehiculos_activos} color="#F59E0B"
          sub="flota activa"
          icon="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0zM13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10"
        />
        <KPICard
          label="Novedades" value={stats.novedades} color="#EF4444"
          sub="requieren atencion"
          icon="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </div>

      {/* GRAFICOS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14, marginBottom: 20, position: "relative", zIndex: 1 }}>

        {/* Grafico servicios semana */}
        <Card style={{ padding: "18px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Servicios esta semana</div>
              <div style={{ fontSize: 10, color: C.muted }}>Actividad diaria</div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#2563EB" }}>{stats.ordenes_hoy}</div>
          </div>
          <BarChart data={barData} color="#2563EB" />
        </Card>

        {/* Eficiencia */}
        <Card style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 4 }}>Eficiencia del equipo</div>
          <div style={{ fontSize: 10, color: C.muted, marginBottom: 16 }}>Servicios completados vs novedades</div>
          <div style={{ position: "relative", marginBottom: 10 }}>
            <div style={{ height: 10, background: C.border, borderRadius: 10, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 10,
                width: eficiencia + "%",
                background: eficiencia > 70 ? "#06D6A0" : eficiencia > 40 ? "#F59E0B" : "#EF4444",
                transition: "width 1s ease"
              }} />
            </div>
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: eficiencia > 70 ? "#06D6A0" : eficiencia > 40 ? "#F59E0B" : "#EF4444" }}>
            {eficiencia}%
          </div>
          <div style={{ fontSize: 10, color: C.muted }}>
            {eficiencia > 70 ? "Rendimiento excelente" : eficiencia > 40 ? "Rendimiento aceptable" : "Requiere atencion"}
          </div>
        </Card>
      </div>

      {/* MODULOS */}
      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1, marginBottom: 12, position: "relative", zIndex: 1 }}>
        MODULOS DEL SISTEMA
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
        gap: 12, position: "relative", zIndex: 1
      }}>
        {visibleModules.map(m => (
          <div key={m.id} onClick={m.ok ? () => onNavigate(m.id) : null}
            style={{
              background: C.card, borderRadius: 14, padding: "16px",
              border: `1px solid ${C.border}`, cursor: m.ok ? "pointer" : "default",
              opacity: m.ok ? 1 : 0.4, transition: "all 0.2s ease",
              position: "relative", overflow: "hidden",
            }}
            onMouseEnter={e => { if (m.ok) e.currentTarget.style.borderColor = m.color; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 4px 16px ${m.color}20`; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
          >
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: m.color, borderRadius: "0 0 14px 14px" }} />
            <div style={{
              width: 38, height: 38, borderRadius: 10, marginBottom: 10,
              background: m.color + "15", display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke={m.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={MODULE_ICONS[m.id] || MODULE_ICONS.reportes} />
              </svg>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 2 }}>{m.title}</div>
            <div style={{ fontSize: 10, color: C.muted }}>{m.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
