import { useState, useEffect } from "react";
import { C, API_URL } from "../shared/constants";
import { Card, PageHeader, KPI } from "../shared/ui";
import logo from "../assets/logo_scj.png";
import { can } from "../shared/permissions";


const Dashboard = ({ onNavigate, user }) => {
  const [stats, setStats] = useState({ ordenes_hoy:0, personal_activo:0, vehiculos_activos:0, novedades:0 });
  useEffect(() => {
    fetch(`${API_URL}/stats`).then(r=>r.json()).then(d=>{
      if (d && typeof d==="object") setStats({
        ordenes_hoy:       d.ordenes_hoy       || d.servicios_hoy   || 0,
        personal_activo:   d.personal_activo   || 0,
        vehiculos_activos: d.vehiculos_activos || d.vehiculos_en_ruta || 0,
        novedades:         d.novedades         || d.novedades_hoy    || 0,
      });
    }).catch(()=>{});
  }, []);
  const modules = [
    { id: "servicios",   icon: "Servicios", title: "Servicio Tecnico",  sub: "Inspecciones y ordenes",  color: C.accent,   ok: true },
    { id: "horarios",    icon: "Horarios", title: "Control Horarios",  sub: "Asistencia y turnos",     color: C.success,  ok: true },
    { id: "vehiculos",   icon: "Vehiculos", title: "Gestion de Flota",  sub: "Vehiculos registrados",   color: C.warning,  ok: true },
    { id: "personal",    icon: "Personal", title: "Personal",          sub: "Empleados y tecnicos",    color: "#8B5CF6",  ok: true },
    { id: "roles",       icon: "Roles", title: "Roles y Perfiles",     sub: "Permisos y accesos",      color: "#22C55E",  ok: true },
    { id: "referencias", icon: "Referencias", title: "Referencias",       sub: "Catalogo de equipos",     color: "#EC4899",  ok: true },
    { id: "configuracion", icon: "Cfg", title: "Configuracion",       sub: "Parametros de nomina",    color: "#2563EB",  ok: true },
    { id: "nomina",      icon: "Nomina", title: "Nomina Quincenal",   sub: "Procesos y liquidacion",   color: "#14B8A6",  ok: true },
    { id: "reportes",    icon: "Reportes", title: "Reportes",          sub: "Estadisticas y KPIs",     color: C.accent,   ok: true },
    { id: "kpis",        icon: "kpi", title: "KPIs Avanzados",    sub: "Proximamente",            color: C.muted,    ok: false },
  ];

  const fecha = new Date().toLocaleDateString("es-CO", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
  const visibleModules = modules.filter(m => m.ok ? can(user, m.id, "access") : true);

  return (
    <div style={{ position: "relative" }}>
      <div style={{
        position: "absolute", right: 24, bottom: 24, opacity: 0.06,
        pointerEvents: "none", userSelect: "none", zIndex: 0
      }}>
        <img src={logo} alt="" style={{ height: 80, filter: "grayscale(100%)" }} />
      </div>
      <PageHeader title="Dashboard" subtitle={"Hoy, " + fecha} />
      <div style={{ display: "flex", gap: 14, marginBottom: 28, flexWrap: "wrap" }}>
        <KPI label="SERVICIOS HOY"     value={stats.ordenes_hoy}       icon="Servicios" color={C.accent} />
        <KPI label="PERSONAL ACTIVO"   value={stats.personal_activo}   icon="Personal"  color="#8B5CF6" />
        <KPI label="VEHICULOS EN RUTA" value={stats.vehiculos_activos} icon="Vehiculos" color={C.warning} />
        <KPI label="NOVEDADES"         value={stats.novedades}         icon="!"         color={C.danger} />
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1, marginBottom: 14 }}>
        MODULOS DEL SISTEMA
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 14 }}>
        {visibleModules.map(m => (
          <Card
            key={m.id}
            onClick={m.ok ? () => onNavigate(m.id) : null}
            style={{ opacity: m.ok ? 1 : 0.45, position: "relative", overflow: "hidden" }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 12, marginBottom: 12,
              background: m.color + "18", border: "1px solid " + m.color + "25",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", background: m.color }} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 4 }}>{m.title}</div>
            <div style={{ fontSize: 11, color: m.ok ? C.muted : C.warning }}>{m.sub}</div>
            {m.ok && (
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                height: 3, background: m.color, borderRadius: "0 0 14px 14px"
              }} />
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};

// ============================================================
// MODULO PERSONAL
// ============================================================

export default Dashboard;
