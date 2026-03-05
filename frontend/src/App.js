import { useState, useEffect, useRef } from "react";
import logo from "./assets/logo_scj.png";


// Load Leaflet dynamically
if (!document.getElementById('leaflet-css')) {
  const link = document.createElement('link');
  link.id = 'leaflet-css';
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);
  const script = document.createElement('script');
  script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  document.head.appendChild(script);
}

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

// ============================================================
// SISTEMA DE COLORES APEX
// ============================================================
const C = {
  dark: "#0D1B2A",
  accent: "#00B4D8",
  success: "#06D6A0",
  warning: "#F59E0B",
  danger: "#EF4444",
  bg: "#F0F4F8",
  card: "#FFFFFF",
  border: "#DDE6EF",
  text: "#0D1B2A",
  muted: "#6B7A8D",
  brand: "#00B4D8",
  brandDark: "#0077A8",
};

// ============================================================
// COMPONENTES BASE REUTILIZABLES
// ============================================================
const Badge = ({ children, color = C.success }) => (
  <span style={{
    background: color + "18", color, fontSize: 10, fontWeight: 700,
    padding: "3px 10px", borderRadius: 20, letterSpacing: 1,
    border: "1px solid " + color + "30", whiteSpace: "nowrap"
  }}>{children}</span>
);

const Card = ({ children, style = {}, onClick }) => (
  <div
    onClick={onClick}
    style={{
      background: C.card, borderRadius: 14, border: "1px solid " + C.border,
      padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      cursor: onClick ? "pointer" : "default",
      transition: "all 0.15s ease", ...style
    }}
    onMouseEnter={e => { if (onClick) e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.10)"; }}
    onMouseLeave={e => { if (onClick) e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)"; }}
  >{children}</div>
);

const Btn = ({ children, onClick, variant = "primary", style = {}, disabled = false }) => {
  const variants = {
    primary: { background: C.dark, color: "#fff", border: "none" },
    ghost:   { background: "transparent", color: C.muted, border: "1px solid " + C.border },
    danger:  { background: C.danger + "12", color: C.danger, border: "1px solid " + C.danger + "30" },
    success: { background: C.success + "12", color: C.success, border: "1px solid " + C.success + "30" },
    warning: { background: C.warning + "12", color: C.warning, border: "1px solid " + C.warning + "30" },
  };
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        ...variants[variant],
        padding: "10px 20px", borderRadius: 10, fontSize: 12,
        fontWeight: 700, letterSpacing: 0.5, cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1, transition: "all 0.1s",
        fontFamily: "inherit", ...style
      }}
    >{children}</button>
  );
};

const Input = ({ label, value, onChange, type = "text", placeholder, error }) => (
  <div style={{ marginBottom: 14 }}>
    {label && (
      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1, marginBottom: 6 }}>
        {label}
      </div>
    )}
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%", padding: "11px 14px", borderRadius: 10, fontSize: 14,
        border: "1px solid " + (error ? C.danger : C.border),
        background: "#FAFBFD", outline: "none",
        fontFamily: "inherit", boxSizing: "border-box", color: C.text,
      }}
    />
    {error && <div style={{ fontSize: 11, color: C.danger, marginTop: 4 }}>{error}</div>}
  </div>
);

const Sel = ({ label, value, onChange, options }) => (
  <div style={{ marginBottom: 14 }}>
    {label && (
      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1, marginBottom: 6 }}>
        {label}
      </div>
    )}
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: "100%", padding: "11px 14px", borderRadius: 10, fontSize: 14,
        border: "1px solid " + C.border, background: "#FAFBFD", outline: "none",
        fontFamily: "inherit", boxSizing: "border-box", color: C.text,
      }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

const PageHeader = ({ title, subtitle, onBack, action }) => (
  <div style={{ marginBottom: 28 }}>
    {onBack && (
      <button
        onClick={onBack}
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: C.muted, fontSize: 12, fontWeight: 600, letterSpacing: 1,
          padding: "0 0 12px 0", display: "flex", alignItems: "center", gap: 6
        }}
      >
        &#8592; VOLVER
      </button>
    )}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0, letterSpacing: -0.5 }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: 13, color: C.muted, margin: "4px 0 0 0" }}>{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  </div>
);

const KPI = ({ label, value, icon, color = C.accent }) => (
  <Card style={{ flex: 1, minWidth: 130 }}>
    <div style={{
      width: 36, height: 36, borderRadius: 10, background: color + "18",
      display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4
    }}>
      <div style={{ width: 14, height: 14, borderRadius: "50%", background: color }} />
    </div>
    <div style={{ fontSize: 26, fontWeight: 800, color, margin: "6px 0 2px" }}>{value}</div>
    <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: 0.5 }}>{label}</div>
  </Card>
);

const Toast = ({ msg, type = "success", onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  const bg = type === "success" ? C.success : type === "error" ? C.danger : C.warning;
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, background: bg, color: "#fff",
      padding: "12px 20px", borderRadius: 12, fontSize: 13, fontWeight: 600,
      zIndex: 9999, boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
      display: "flex", gap: 10, alignItems: "center", maxWidth: 360
    }}>
      <span>{msg}</span>
      <button
        onClick={onClose}
        style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 18, lineHeight: 1 }}
      >x</button>
    </div>
  );
};

const Spinner = () => (
  <div style={{ textAlign: "center", padding: 48, color: C.muted, fontSize: 14 }}>
    Cargando...
  </div>
);

// ============================================================
// LAYOUT CON SIDEBAR
// ============================================================
const Layout = ({ children, user, onLogout, activePage, onNavigate }) => {
  const nav = [
    { id: "dashboard",   icon: "OO", label: "Dashboard" },
    { id: "servicios",   icon: "WR", label: "Servicios" },
    { id: "horarios",    icon: "TM", label: "Horarios" },
    { id: "vehiculos",   icon: "VH", label: "Vehiculos" },
    { id: "personal",    icon: "PS", label: "Personal" },
    { id: "referencias", icon: "RF", label: "Referencias" },
    { id: "reportes",    icon: "RP", label: "Reportes" },
  ];

  const iconMap = {
    "OO": "[ ]", "WR": "[ ]", "TM": "[ ]",
    "VH": "[ ]", "PS": "[ ]", "RF": "[ ]", "RP": "[ ]"
  };

  const labelMap = {
    "OO": "Dashboard", "WR": "Servicios", "TM": "Horarios",
    "VH": "Vehiculos", "PS": "Personal", "RF": "Referencias", "RP": "Reportes"
  };

  const dotColor = {
    "OO": "#00B4D8", "WR": "#06D6A0", "TM": "#F59E0B",
    "VH": "#F59E0B", "PS": "#8B5CF6", "RF": "#EC4899", "RP": "#00B4D8"
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: C.bg, fontFamily: "'Segoe UI', sans-serif" }}>
      {/* SIDEBAR */}
      <div style={{
        width: 220, background: "#0D1B2A", display: "flex", flexDirection: "column",
        padding: "24px 0", flexShrink: 0, overflowY: "auto"
      }}>
        <div style={{ padding: "0 20px 28px" }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", letterSpacing: 2 }}>APEX</div>
          <div style={{ fontSize: 10, color: "#4A90D9", letterSpacing: 3, fontWeight: 600 }}>SCJ - ERP</div>
        </div>

        <div style={{ flex: 1 }}>
          {nav.map(item => (
            <div
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                padding: "11px 20px", display: "flex", alignItems: "center", gap: 12,
                background: activePage === item.id ? "rgba(0,180,216,0.12)" : "transparent",
                borderLeft: activePage === item.id ? "3px solid " + (dotColor[item.icon]||C.accent) : "3px solid transparent",
                cursor: "pointer", transition: "all 0.15s"
              }}
            >
              <div style={{
                width: 8, height: 8, borderRadius: "50%",
                background: activePage === item.id ? (dotColor[item.icon]||C.accent) : "#8892A4",
                transition: "all 0.15s", flexShrink: 0
              }} />
              <span style={{
                fontSize: 12, fontWeight: activePage === item.id ? 700 : 500,
                color: activePage === item.id ? "#fff" : "#8892A4",
                letterSpacing: 0.3
              }}>{item.label}</span>
            </div>
          ))}
        </div>

        <div style={{ padding: "20px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ fontSize: 11, color: "#8892A4", marginBottom: 4 }}>Conectado como</div>
          <div style={{ fontSize: 13, color: "#fff", fontWeight: 700 }}>
            {user && (user.nombre || user.username)}
          </div>
          <div style={{ fontSize: 10, color: C.accent, fontWeight: 600, marginBottom: 10, textTransform: "uppercase" }}>
            {user && user.rol}
          </div>
          <button
            onClick={onLogout}
            style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              color: "#8892A4", fontSize: 11, padding: "7px 14px", borderRadius: 8,
              cursor: "pointer", fontWeight: 600, width: "100%", fontFamily: "inherit"
            }}
          >CERRAR SESION</button>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div style={{ flex: 1, overflow: "auto", padding: 32 }}>{children}</div>
    </div>
  );
};

// ============================================================
// LOGIN
// ============================================================
const Login = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      setError("Completa todos los campos");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(API_URL + "/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok && data.usuario) {
        onLogin(data.usuario);
      } else {
        setError(data.detail || "Credenciales incorrectas");
      }
    } catch {
      // Modo demo si no hay backend conectado aun
      if (password === "1234") {
        onLogin({ id: 1, nombre: username, username, rol: "admin" });
      } else {
        setError("Error de conexion. Demo: usa contrasena 1234");
      }
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0D1B2A",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Segoe UI', sans-serif", position: "relative", overflow: "hidden"
    }}>
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse at 20% 30%, rgba(0,180,216,0.20) 0%, transparent 55%), radial-gradient(ellipse at 80% 75%, rgba(6,214,160,0.10) 0%, transparent 50%)"
      }} />
      <div style={{ width: "100%", maxWidth: 400, padding: 20 }}>
        <div style={{ textAlign: "center", marginBottom: 36, position: "relative", zIndex: 1 }}>
          <div style={{
            background: "rgba(255,255,255,0.97)", borderRadius: 24, padding: "18px 24px",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginBottom: 22, boxShadow: "0 0 0 1px rgba(0,180,216,0.3), 0 20px 60px rgba(0,0,0,0.5)"
          }}>
            <img src={logo} alt="SCJ Logo" style={{ height: 70, display: "block" }} />
          </div>
          <div style={{ fontSize: 38, fontWeight: 900, color: "#fff", letterSpacing: 8, textShadow: "0 0 40px rgba(0,180,216,0.4)" }}>APEX</div>
          <div style={{ fontSize: 10, color: C.accent, letterSpacing: 5, fontWeight: 700, marginTop: 6 }}>SCJ SOLUCIONES LOGISTICAS</div>
        </div>
        <Card style={{ padding: 36, position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>Bienvenido de vuelta</div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>Ingresa tus credenciales</div>
          <Input label="USUARIO" value={username} onChange={setUsername} placeholder="Tu ID de acceso" />
          <Input label="CONTRASENA" value={password} onChange={setPassword} type="password" placeholder="--------" />
          {error && (
            <div style={{
              background: C.danger + "12", color: C.danger,
              padding: "10px 14px", borderRadius: 8, fontSize: 12, marginBottom: 16
            }}>{error}</div>
          )}
          <Btn onClick={handleLogin} disabled={loading} style={{ width: "100%", padding: 13, fontSize: 13 }}>
            {loading ? "VERIFICANDO..." : "INGRESAR AL SISTEMA"}
          </Btn>
          <div style={{ fontSize: 11, color: C.muted, textAlign: "center", marginTop: 16 }}>
            Demo sin backend: cualquier usuario, contrasena <strong>1234</strong>
          </div>
        </Card>
      </div>
    </div>
  );
};

// ============================================================
// DASHBOARD
// ============================================================
const Dashboard = ({ onNavigate }) => {
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
    { id: "referencias", icon: "Referencias", title: "Referencias",       sub: "Catalogo de equipos",     color: "#EC4899",  ok: true },
    { id: "reportes",    icon: "Reportes", title: "Reportes",          sub: "Estadisticas y KPIs",     color: C.accent,   ok: true },
    { id: "nomina",      icon: "nom", title: "Nomina",            sub: "Proximamente",            color: C.muted,    ok: false },
    { id: "kpis",        icon: "kpi", title: "KPIs Avanzados",    sub: "Proximamente",            color: C.muted,    ok: false },
  ];

  const fecha = new Date().toLocaleDateString("es-CO", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });

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
        {modules.map(m => (
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
const Personal = ({ onBack }) => {
  const [vista, setVista]       = useState("lista");
  const [rolSel, setRolSel]     = useState(null);
  const [lista, setLista]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [toast, setToast]       = useState(null);
  const [filtroRol, setFiltroRol] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [empSel, setEmpSel]     = useState(null); // para detalle/edicion
  const [modoEdicion, setModoEdicion] = useState(false);
  const [form, setForm] = useState({
    nombre: "", doc: "", pass: "", empresa: "Apex", costo: "", salario: "", extra: ""
  });

  const cargar = async () => {
    setLoading(true);
    try {
      const r = await fetch(API_URL + "/personal");
      const d = await r.json();
      setLista(Array.isArray(d) ? d : []);
    } catch {
      setLista([]);
    }
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const nuevoId = (() => {
    const activos = lista.filter(p => p.rol === rolSel).length;
    const n = String(activos + 1).padStart(3, "0");
    if (rolSel === "tecnico")  return "APXTEC" + n;
    if (rolSel === "empleado") return "APXEMP" + n;
    return "APXADM" + n;
  })();

  const guardar = async () => {
    if (!form.nombre) { setToast({ msg: "El nombre es obligatorio", type: "error" }); return; }
    try {
      if (modoEdicion && empSel) {
        await fetch(API_URL + "/personal/" + empSel.id, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: form.nombre, doc: form.doc,
            user: empSel.username, pass: form.pass || "1234",
            rol: empSel.rol, id_interno: empSel.id_interno,
            empresa: form.empresa,
            costo: parseFloat(form.costo || 0),
            salario: parseFloat(form.salario || 0),
            extra: parseFloat(form.extra || 0),
          }),
        });
        setToast({ msg: "Usuario actualizado correctamente", type: "success" });
      } else {
        await fetch(API_URL + "/personal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: form.nombre, doc: form.doc,
            user: nuevoId, pass: form.pass || "1234",
            rol: rolSel, id_interno: nuevoId,
            empresa: form.empresa,
            costo: parseFloat(form.costo || 0),
            salario: parseFloat(form.salario || 0),
            extra: parseFloat(form.extra || 0),
          }),
        });
        setToast({ msg: "Usuario creado: " + nuevoId, type: "success" });
      }
    } catch { setToast({ msg: "Error al guardar", type: "error" }); }
    setTimeout(() => {
      setVista("lista"); setModoEdicion(false); setEmpSel(null);
      cargar();
      setForm({ nombre:"",doc:"",pass:"",empresa:"Apex",costo:"",salario:"",extra:"" });
    }, 1400);
  };

  const toggleEstado = async (emp) => {
    try {
      await fetch(`${API_URL}/personal/${emp.id}/estado?activo=${!emp.activo}`, { method: "PATCH" });
      setLista(prev => prev.map(p => p.id === emp.id ? { ...p, activo: !emp.activo } : p));
      setEmpSel(prev => prev ? { ...prev, activo: !prev.activo } : null);
    } catch {}
  };

  const abrirEdicion = (emp) => {
    setEmpSel(emp);
    setModoEdicion(true);
    setRolSel(emp.rol);
    setForm({
      nombre: emp.nombre || "",
      doc: emp.documento || "",
      pass: "",
      empresa: emp.empresa || "Apex",
      costo: emp.costo_servicio || "",
      salario: emp.salario_base || "",
      extra: emp.tasa_extra || ""
    });
    setVista("form");
  };

  const rolColor = { tecnico: C.accent, empleado: C.success, admin: "#8B5CF6" };
  const rolLabel = { tecnico: "TECNICO", empleado: "EMPLEADO", admin: "ADMIN" };

  const listaFiltrada = (Array.isArray(lista) ? lista : []).filter(p => {
    if (filtroRol && p.rol !== filtroRol) return false;
    if (filtroEstado === "activo" && !p.activo) return false;
    if (filtroEstado === "inactivo" && p.activo !== false) return false;
    return true;
  });

  // ---- VISTA DETALLE ----
  if (vista === "detalle" && empSel) return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <PageHeader title="Detalle Empleado" onBack={() => { setVista("lista"); setEmpSel(null); }} />
      <div style={{ maxWidth: 560 }}>
        <Card style={{ marginBottom: 16 }}>
          {/* Header tarjeta */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: (rolColor[empSel.rol] || C.accent) + "20",
              border: `3px solid ${rolColor[empSel.rol] || C.accent}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, fontWeight: 900, color: rolColor[empSel.rol] || C.accent
            }}>
              {empSel.nombre?.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{empSel.nombre}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                <span style={{
                  padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: (rolColor[empSel.rol] || C.accent) + "20",
                  color: rolColor[empSel.rol] || C.accent
                }}>{rolLabel[empSel.rol] || empSel.rol?.toUpperCase()}</span>
                <span style={{
                  padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: empSel.activo !== false ? "#06D6A015" : "#EF444415",
                  color: empSel.activo !== false ? "#06D6A0" : "#EF4444"
                }}>{empSel.activo !== false ? "ACTIVO" : "INACTIVO"}</span>
              </div>
            </div>
          </div>

          {/* Info grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            {[
              { label: "ID INTERNO",    value: empSel.id_interno },
              { label: "DOCUMENTO",     value: empSel.documento || "-" },
              { label: "USUARIO",       value: empSel.username },
              { label: "EMPRESA",       value: empSel.empresa || "-" },
              { label: "SALARIO BASE",  value: empSel.salario_base ? `$${Number(empSel.salario_base).toLocaleString()}` : "-" },
              { label: "VALOR H. EXTRA",value: empSel.tasa_extra ? `$${Number(empSel.tasa_extra).toLocaleString()}` : "-" },
            ].map(f => (
              <div key={f.label} style={{
                padding: "10px 14px", background: C.bg, borderRadius: 8, border: `1px solid ${C.border}`
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, marginBottom: 3 }}>{f.label}</div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{f.value}</div>
              </div>
            ))}
          </div>

          {/* Acciones */}
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={() => abrirEdicion(empSel)} style={{ flex: 1 }}>EDITAR</Btn>
            <Btn variant="ghost"
              onClick={() => toggleEstado(empSel)}
              style={{ color: empSel.activo !== false ? C.danger : "#06D6A0", borderColor: empSel.activo !== false ? C.danger : "#06D6A0" }}>
              {empSel.activo !== false ? "DESACTIVAR" : "ACTIVAR"}
            </Btn>
          </div>
        </Card>
      </div>
    </div>
  );

  // ---- VISTA FORM (crear o editar) ----
  if (vista === "form" && rolSel) return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <PageHeader
        title={modoEdicion ? "Editar " + (rolLabel[rolSel] || rolSel) : "Nuevo " + (rolLabel[rolSel] || rolSel)}
        onBack={() => { setVista(modoEdicion ? "detalle" : "roles"); setModoEdicion(false); }} />
      <div style={{ maxWidth: 480 }}>
        <Card>
          {!modoEdicion && (
            <div style={{
              background: C.dark, borderRadius: 10, padding: "16px 20px",
              marginBottom: 20, textAlign: "center"
            }}>
              <div style={{ fontSize: 10, color: "#8892A4", letterSpacing: 1 }}>ID GENERADO</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: 2 }}>{nuevoId}</div>
            </div>
          )}
          <Input label="NOMBRE COMPLETO" value={form.nombre} onChange={v => setForm({ ...form, nombre: v })} />
          <Input label="DOCUMENTO"       value={form.doc}    onChange={v => setForm({ ...form, doc: v })} />
          <Input label="CONTRASENA"      value={form.pass}   onChange={v => setForm({ ...form, pass: v })} type="password"
            placeholder={modoEdicion ? "Dejar vacio para no cambiar" : "Minimo 4 caracteres"} />
          {(rolSel === "tecnico") && (
            <>
              <Sel label="EMPRESA" value={form.empresa} onChange={v => setForm({ ...form, empresa: v })}
                options={[{ value: "Apex", label: "Apex" }, { value: "Externo", label: "Externo" }]} />
              <Input label="COSTO SERVICIO ($)" value={form.costo} onChange={v => setForm({ ...form, costo: v })} />
            </>
          )}
          {(rolSel === "empleado" || rolSel === "tecnico") && (
            <>
              <Input label="SALARIO BASE ($)"      value={form.salario} onChange={v => setForm({ ...form, salario: v })} />
              <Input label="VALOR HORA EXTRA ($)"  value={form.extra}   onChange={v => setForm({ ...form, extra: v })} />
            </>
          )}
          <Btn onClick={guardar} style={{ marginTop: 8, width: "100%" }}>
            {modoEdicion ? "GUARDAR CAMBIOS" : "CREAR USUARIO"}
          </Btn>
        </Card>
      </div>
    </div>
  );

  // ---- VISTA SELECCION ROL ----
  if (vista === "roles") return (
    <div>
      <PageHeader title="Nuevo Usuario" subtitle="Selecciona el perfil" onBack={() => setVista("lista")} />
      <div style={{ maxWidth: 480 }}>
        {[
          { rol: "admin",    label: "Administrador", desc: "Acceso total al sistema",    icon: "adm" },
          { rol: "tecnico",  label: "Tecnico",        desc: "Servicios e inspecciones",   icon: "tec" },
          { rol: "empleado", label: "Empleado",       desc: "Operaciones y horarios",     icon: "usr" },
        ].map(r => (
          <Card key={r.rol} onClick={() => { setRolSel(r.rol); setVista("form"); }}
            style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10, background: C.bg,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 12, color: C.muted, border: `1px solid ${C.border}`
              }}>{r.icon}</div>
              <div>
                <div style={{ fontWeight: 700 }}>{r.label}</div>
                <div style={{ fontSize: 12, color: C.muted }}>{r.desc}</div>
              </div>
            </div>
            <span style={{ color: C.muted, fontSize: 18 }}>-&gt;</span>
          </Card>
        ))}
      </div>
    </div>
  );

  // ---- VISTA LISTA PRINCIPAL ----
  return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Gestion de Personal</h2>
          <p style={{ margin: 0, fontSize: 13, color: C.muted }}>
            {listaFiltrada.length} de {lista.length} colaboradores
          </p>
        </div>
        <Btn onClick={() => setVista("roles")}>+ NUEVO USUARIO</Btn>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { value: "", label: "Todos" },
          { value: "admin", label: "Admin" },
          { value: "tecnico", label: "Tecnicos" },
          { value: "empleado", label: "Empleados" },
        ].map(f => (
          <div key={f.value} onClick={() => setFiltroRol(f.value)} style={{
            padding: "6px 16px", borderRadius: 20, cursor: "pointer", fontSize: 12, fontWeight: 700,
            background: filtroRol === f.value ? C.accent : C.bg,
            color: filtroRol === f.value ? "#fff" : C.muted,
            border: `1px solid ${filtroRol === f.value ? C.accent : C.border}`
          }}>{f.label}</div>
        ))}
        <div style={{ width: 1, background: C.border, margin: "0 4px" }} />
        {[
          { value: "", label: "Activos e inactivos" },
          { value: "activo", label: "Solo activos" },
          { value: "inactivo", label: "Solo inactivos" },
        ].map(f => (
          <div key={f.value} onClick={() => setFiltroEstado(f.value)} style={{
            padding: "6px 16px", borderRadius: 20, cursor: "pointer", fontSize: 12, fontWeight: 700,
            background: filtroEstado === f.value ? C.dark : C.bg,
            color: filtroEstado === f.value ? "#fff" : C.muted,
            border: `1px solid ${filtroEstado === f.value ? C.dark : C.border}`
          }}>{f.label}</div>
        ))}
      </div>

      {/* Grid de empleados */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: C.muted }}>Cargando...</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {listaFiltrada.map((p, i) => (
            <Card key={i}
              onClick={() => { setEmpSel(p); setVista("detalle"); }}
              style={{
                cursor: "pointer", opacity: p.activo === false ? 0.6 : 1,
                borderLeft: `4px solid ${rolColor[p.rol] || C.border}`,
                transition: "transform 0.15s, box-shadow 0.15s"
              }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
                  background: (rolColor[p.rol] || C.accent) + "20",
                  border: `2px solid ${rolColor[p.rol] || C.accent}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 900, color: rolColor[p.rol] || C.accent
                }}>
                  {p.nombre?.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{p.nombre}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{p.id_interno}</div>
                  {p.empresa && <div style={{ fontSize: 11, color: C.muted }}>{p.empresa}</div>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <span style={{
                    padding: "3px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700,
                    background: (rolColor[p.rol] || C.accent) + "20",
                    color: rolColor[p.rol] || C.accent
                  }}>{rolLabel[p.rol] || p.rol?.toUpperCase()}</span>
                  <span style={{
                    padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700,
                    background: p.activo !== false ? "#06D6A015" : "#EF444415",
                    color: p.activo !== false ? "#06D6A0" : "#EF4444"
                  }}>{p.activo !== false ? "ACTIVO" : "INACTIVO"}</span>
                </div>
              </div>
              {(p.salario_base > 0 || p.tasa_extra > 0) && (
                <div style={{
                  marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}`,
                  display: "flex", justifyContent: "space-between"
                }}>
                  {p.salario_base > 0 && (
                    <div>
                      <div style={{ fontSize: 9, color: C.muted, fontWeight: 700 }}>SALARIO</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: C.text }}>${Number(p.salario_base).toLocaleString()}</div>
                    </div>
                  )}
                  {p.tasa_extra > 0 && (
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 9, color: C.muted, fontWeight: 700 }}>H. EXTRA</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: C.text }}>${Number(p.tasa_extra).toLocaleString()}</div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};


const Alert = ({ tipo, texto, onClose }) => (
  <div style={{
    padding: "12px 16px", borderRadius: 10, marginBottom: 16,
    background: tipo === "ok" ? "#06D6A015" : "#EF444415",
    border: `1px solid ${tipo === "ok" ? "#06D6A040" : "#EF444440"}`,
    display: "flex", justifyContent: "space-between", alignItems: "center"
  }}>
    <span style={{ fontSize: 13, color: tipo === "ok" ? "#06D6A0" : "#EF4444", fontWeight: 600 }}>{texto}</span>
    <span onClick={onClose} style={{ cursor: "pointer", color: "#6B7A8D", fontSize: 16, marginLeft: 12 }}>x</span>
  </div>
);

const ESTADO_ORDEN = {
  pendiente:   { color:"#94A3B8", label:"Pendiente",   bg:"#94A3B815" },
  en_curso:    { color:"#F59E0B", label:"En Curso",    bg:"#F59E0B15" },
  inspeccion:  { color:"#00B4D8", label:"Inspeccion",  bg:"#00B4D815" },
  ejecucion:   { color:"#8B5CF6", label:"Ejecucion",   bg:"#8B5CF615" },
  cerrada:     { color:"#06D6A0", label:"Cerrada",     bg:"#06D6A015" },
};

// ============================================================
// MODULO CONTROL DE HORARIOS - Reemplazar componente Horarios
// en App.js (buscar "const Horarios" y reemplazar hasta el );
// ============================================================

const Horarios = ({ onBack, user }) => {
  const [vista, setVista] = useState("menu");

  // ---- ESTADOS COMPARTIDOS ----
  const [rutas, setRutas]                   = useState([]);
  const [personal, setPersonal]             = useState([]);
  const [vehiculos, setVehiculos]           = useState([]);
  const [novedadesTipo, setNovedadesTipo]   = useState([]);
  const [loading, setLoading]               = useState(false);
  const [msg, setMsg]                       = useState(null);

  // ---- ESTADOS MARCACION ----
  const [marcForm, setMarcForm]             = useState({ usuario: user?.nombre || "", vehiculo_placa: "", ruta_id: "", novedad_tipo_id: "", novedad_descripcion: "" });
  const [showNovedad, setShowNovedad]       = useState(false);
  const [resultMarca, setResultMarca]       = useState(null);
  const [ultimaMarca, setUltimaMarca]       = useState(null);
  const [cargandoUltima, setCargandoUltima] = useState(false);

  // Secuencia bloqueante: solo la siguiente en la cadena queda habilitada
  const ORDEN_MARCAS = ["INGRESO", "ALMUERZO", "RETORNO", "CIERRE"];
  const marcaHabilitada = (tipo) => {
    if (ultimaMarca === null) return tipo === "INGRESO";
    if (ultimaMarca === "CIERRE") return false; // jornada completa
    const idx = ORDEN_MARCAS.indexOf(ultimaMarca);
    return tipo === ORDEN_MARCAS[idx + 1];
  };
  const proximaMarca = ultimaMarca === null ? "INGRESO"
    : ultimaMarca === "CIERRE" ? null
    : ORDEN_MARCAS[ORDEN_MARCAS.indexOf(ultimaMarca) + 1];

  // ---- ESTADOS PLANEACION ----
  const [rutaForm, setRutaForm]             = useState({ fecha: new Date().toISOString().split("T")[0], placa: "", empleados: [], notas: "" });
  const [empSeleccionados, setEmpSeleccionados] = useState([]);

  // ---- ESTADOS MONITOR ----
  const [monitorRutas, setMonitorRutas]     = useState([]);
  const [monitorFecha, setMonitorFecha]     = useState(new Date().toISOString().split("T")[0]);
  const [monitorInterval, setMonitorInterval] = useState(null);

  const MARCAS = [
    { tipo: "INGRESO",  label: "Inicio Jornada",  desc: "Registra tu entrada al trabajo",     color: "#06D6A0" },
    { tipo: "ALMUERZO", label: "Salida Almuerzo",  desc: "Registra tu salida a almorzar",      color: "#F59E0B" },
    { tipo: "RETORNO",  label: "Retorno Almuerzo", desc: "Registra tu regreso del almuerzo",   color: "#00B4D8" },
    { tipo: "CIERRE",   label: "Fin Jornada",      desc: "Registra tu salida al final del dia", color: "#8B5CF6" },
  ];

  // ---- CARGA INICIAL ----
  useEffect(() => {
    fetch(`${API_URL}/personal`).then(r=>r.json()).then(d=>setPersonal(Array.isArray(d)?d:[])).catch(()=>{});
    fetch(`${API_URL}/vehiculos`).then(r=>r.json()).then(d=>setVehiculos(Array.isArray(d)?d:[])).catch(()=>{});
    fetch(`${API_URL}/novedades-tipo`).then(r=>r.json()).then(d=>setNovedadesTipo(Array.isArray(d)?d:[])).catch(()=>{});
    fetch(`${API_URL}/rutas`).then(r=>r.json()).then(d=>setRutas(Array.isArray(d)?d:[])).catch(()=>{});
  }, []);

  // Cargar ultima marcacion del usuario desde el backend (persiste entre recargas)
  useEffect(() => {
    if (!user?.nombre) return;
    setCargandoUltima(true);
    fetch(`${API_URL}/asistencia?usuario=${encodeURIComponent(user.nombre)}&hoy=1`)
      .then(r=>r.json())
      .then(d => {
        const hoy = Array.isArray(d) ? d : [];
        if (hoy.length > 0) {
          // La mas reciente del dia
          const ultima = hoy.sort((a,b) => new Date(b.hora||b.created_at||0) - new Date(a.hora||a.created_at||0))[0];
          setUltimaMarca(ultima.tipo_marca || null);
        }
      })
      .catch(()=>{})
      .finally(()=>setCargandoUltima(false));
  }, [user?.nombre]);

  // ---- GPS ----
  const obtenerGPS = () => new Promise((res) => {
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => res({ lat: pos.coords.latitude, lon: pos.coords.longitude, precision: pos.coords.accuracy }),
      () => res(null),
      { timeout: 8000, maximumAge: 30000 }
    );
  });

  // ---- MARCACION ----
  const realizarMarcacion = async (tipo) => {
    if (!marcaHabilitada(tipo)) return;
    if (!marcForm.usuario) { setMsg({ tipo: "error", texto: "Selecciona un empleado" }); return; }
    setLoading(true); setMsg(null);
    const gps = await obtenerGPS();
    const payload = { ...marcForm, tipo_marca: tipo, latitud: gps?.lat || null, longitud: gps?.lon || null };
    try {
      const r = await fetch(`${API_URL}/marcaciones`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await r.json();
      setResultMarca({ ...data, tipo, gps, hora: new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }) });
      setUltimaMarca(tipo);
      if (data.alerta) setShowNovedad(true);
      else setMsg({ tipo: "success", texto: `${tipo} registrado exitosamente` });
    } catch { setMsg({ tipo: "error", texto: "Error al registrar marcacion" }); }
    setLoading(false);
  };

  const guardarNovedad = async () => {
    setLoading(true);
    try {
      await fetch(`${API_URL}/marcaciones`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...marcForm, tipo_marca: resultMarca?.tipo, latitud: resultMarca?.gps?.lat, longitud: resultMarca?.gps?.lon })
      });
      setShowNovedad(false);
      setMsg({ tipo: "success", texto: "Marcacion y novedad guardadas" });
    } catch { setMsg({ tipo: "error", texto: "Error guardando novedad" }); }
    setLoading(false);
  };

  // ---- PLANEACION ----
  const crearRuta = async () => {
    if (!rutaForm.placa) { setMsg({ tipo: "error", texto: "Selecciona un vehiculo" }); return; }
    if (empSeleccionados.length === 0) { setMsg({ tipo: "error", texto: "Agrega al menos un empleado" }); return; }
    setLoading(true);
    try {
      await fetch(`${API_URL}/rutas`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...rutaForm, empleados: empSeleccionados })
      });
      setMsg({ tipo: "success", texto: "Ruta creada exitosamente" });
      setRutaForm({ fecha: new Date().toISOString().split("T")[0], placa: "", empleados: [], notas: "" });
      setEmpSeleccionados([]);
    } catch { setMsg({ tipo: "error", texto: "Error al crear ruta" }); }
    setLoading(false);
  };

  // ---- MONITOR ----
  const cargarMonitor = () => {
    fetch(`${API_URL}/monitor/rutas?fecha=${monitorFecha}`)
      .then(r=>r.json())
      .then(d=>setMonitorRutas(Array.isArray(d)?d:[]))
      .catch(()=>{});
  };

  useEffect(() => {
    if (vista !== "monitor") return;
    cargarMonitor();
    const iv = setInterval(cargarMonitor, 60000);
    setMonitorInterval(iv);
    return () => clearInterval(iv);
  }, [vista, monitorFecha]);

  // ---- MAPA GPS ----
  if (vista === "mapa") return (
    <div>
      <PageHeader title="Mapa GPS" subtitle="Seguimiento en vivo e historico" onBack={() => setVista("menu")} />
      <MapaOperarios user={user} />
    </div>
  );

  // ---- MONITOR EN VIVO ----
  if (vista === "monitor") return (
    <div>
      <PageHeader title="Monitor en Vivo" subtitle="Estado actual de rutas y personal" onBack={() => setVista("menu")} />
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
        <input type="date" value={monitorFecha} onChange={e => setMonitorFecha(e.target.value)}
          style={{ padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13 }} />
        <Btn onClick={cargarMonitor}>ACTUALIZAR</Btn>
        <span style={{ fontSize: 12, color: C.muted }}>{monitorRutas.length} ruta(s) encontrada(s)</span>
      </div>
      {monitorRutas.length === 0 && (
        <Card style={{ textAlign: "center", padding: 40, color: C.muted }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}></div>
          <div>No hay rutas para esta fecha</div>
        </Card>
      )}
      {monitorRutas.map(ruta => (
        <Card key={ruta.id} style={{ marginBottom: 16, borderLeft: `4px solid #00B4D8` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{ruta.placa}</div>
              <div style={{ fontSize: 12, color: C.muted }}>{ruta.hora_inicio} - {ruta.hora_fin} | Viaticos: ${(ruta.viaticos||0).toLocaleString()}</div>
            </div>
            <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700,
              background: ruta.activos > 0 ? "#06D6A020" : "#EF444420",
              color: ruta.activos > 0 ? "#06D6A0" : "#EF4444" }}>
              {ruta.activos || 0}/{ruta.total || 0} activos
            </span>
          </div>
          {(ruta.empleados || []).map(emp => {
            const cfg = {
              "INGRESO":  { color:"#06D6A0", label:"En Jornada",  icon:"" },
              "ALMUERZO": { color:"#F59E0B", label:"Almuerzo",    icon:"" },
              "RETORNO":  { color:"#00B4D8", label:"Trabajando",  icon:"" },
              "CIERRE":   { color:"#8B5CF6", label:"Finalizo",    icon:"" },
              "SIN":      { color:"#94A3B8", label:"Sin Iniciar", icon:"" },
            }[emp.ultima_marca || "SIN"] || { color:"#94A3B8", label: emp.ultima_marca, icon:"?" };
            return (
              <div key={emp.nombre} style={{ padding: "10px 14px", borderRadius: 10, marginBottom: 8,
                background: cfg.color + "10", border: `1px solid ${cfg.color}30` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{emp.nombre}</span>
                  <span style={{ padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700,
                    background: cfg.color + "20", color: cfg.color }}>{cfg.label}</span>
                </div>
                {/* Timeline de marcaciones del dia */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {["INGRESO","ALMUERZO","RETORNO","CIERRE"].map(tipo => {
                    const marca = (emp.marcaciones || []).find(m => m.tipo_marca === tipo);
                    const cfgT = { "INGRESO":{ color:"#06D6A0", label:"Inicio" }, "ALMUERZO":{ color:"#F59E0B", label:"Almuerzo" }, "RETORNO":{ color:"#00B4D8", label:"Retorno" }, "CIERRE":{ color:"#8B5CF6", label:"Cierre" } }[tipo];
                    return (
                      <div key={tipo} style={{ display:"flex", alignItems:"center", gap:4, padding:"3px 8px",
                        borderRadius:8, fontSize:10, fontWeight:600,
                        background: marca ? cfgT.color+"20" : C.bg,
                        border: `1px solid ${marca ? cfgT.color+"60" : C.border}`,
                        color: marca ? cfgT.color : C.muted }}>
                        <span>{cfgT.label}</span>
                        {marca && <span style={{ fontWeight:800 }}>{marca.hora?.substring(0,5)}</span>}
                        {marca?.latitud && (
                          <span onClick={() => window.open(`https://www.google.com/maps?q=${marca.latitud},${marca.longitud}&z=16`, "_blank")}
                            style={{ cursor:"pointer", color:cfgT.color, fontWeight:800, marginLeft:2 }} title="Ver en mapa"></span>
                        )}
                        {!marca && <span style={{ opacity:0.4 }}>--:--</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </Card>
      ))}
    </div>
  );

  // ---- MARCACION ----
  if (vista === "marcacion") return (
    <div>
      <PageHeader title="Marcacion de Personal" subtitle="Registra tu jornada laboral" onBack={() => setVista("menu")} />
      {msg && <Alert tipo={msg.tipo} texto={msg.texto} onClose={() => setMsg(null)} />}

      {/* Selector empleado y vehiculo */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 13 }}>DATOS DE LA MARCACION</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, display: "block", marginBottom: 4 }}>EMPLEADO</label>
            <select value={marcForm.usuario}
              onChange={e => { setMarcForm(f => ({ ...f, usuario: e.target.value })); setUltimaMarca(null); setResultMarca(null); }}
              style={{ width: "100%", padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, background: C.bg }}>
              <option value="">Seleccionar empleado</option>
              {personal.map(p => <option key={p.nombre} value={p.nombre}>{p.nombre}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, display: "block", marginBottom: 4 }}>VEHICULO</label>
            <select value={marcForm.vehiculo_placa}
              onChange={e => setMarcForm(f => ({ ...f, vehiculo_placa: e.target.value }))}
              style={{ width: "100%", padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, background: C.bg }}>
              <option value="">Seleccionar vehiculo</option>
              {vehiculos.map(v => <option key={v.placa} value={v.placa}>{v.placa} - {v.modelo}</option>)}
            </select>
          </div>
        </div>
      </Card>

      {/* Estado jornada actual */}
      {marcForm.usuario && (
        <Card style={{ marginBottom: 16, background: ultimaMarca === "CIERRE" ? "#8B5CF620" : ultimaMarca ? "#06D6A010" : "#00B4D810",
          border: `1px solid ${ultimaMarca === "CIERRE" ? "#8B5CF640" : ultimaMarca ? "#06D6A040" : "#00B4D840"}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 28 }}>
              {ultimaMarca === null ? "" : ultimaMarca === "INGRESO" ? "" : ultimaMarca === "ALMUERZO" ? "" : ultimaMarca === "RETORNO" ? "" : ""}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 13 }}>
                {cargandoUltima ? "Cargando estado..." :
                 ultimaMarca === null ? "Sin marcaciones hoy  Registra tu INGRESO" :
                 ultimaMarca === "CIERRE" ? "Jornada completa " :
                 `Ultima: ${ultimaMarca}  Siguiente: ${proximaMarca}`}
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                {ultimaMarca !== "CIERRE" && proximaMarca && `Puedes registrar: ${proximaMarca}`}
              </div>
            </div>
          </div>
          {/* Mini timeline */}
          <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
            {ORDEN_MARCAS.map((tipo, i) => {
              const yaHizo = ultimaMarca && ORDEN_MARCAS.indexOf(ultimaMarca) >= i;
              const esProxima = tipo === proximaMarca;
              const cfg = { "INGRESO":{ color:"#06D6A0" }, "ALMUERZO":{ color:"#F59E0B" }, "RETORNO":{ color:"#00B4D8" }, "CIERRE":{ color:"#8B5CF6" } }[tipo];
              return (
                <div key={tipo} style={{ display:"flex", alignItems:"center", gap:4, padding:"3px 10px", borderRadius:20,
                  fontSize:10, fontWeight:700,
                  background: yaHizo ? cfg.color+"20" : esProxima ? cfg.color+"30" : C.bg,
                  border: `1px solid ${yaHizo || esProxima ? cfg.color : C.border}`,
                  color: yaHizo ? cfg.color : esProxima ? cfg.color : C.muted }}>
                  {yaHizo ? " " : esProxima ? " " : ""}{tipo}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Botones de marcacion  solo la proxima habilitada */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
        {MARCAS.map(m => {
          const habilitada = marcaHabilitada(m.tipo);
          const yaHizo = ultimaMarca && ORDEN_MARCAS.indexOf(ultimaMarca) >= ORDEN_MARCAS.indexOf(m.tipo);
          return (
            <Card key={m.tipo}
              onClick={() => habilitada && !loading ? realizarMarcacion(m.tipo) : null}
              style={{
                borderLeft: `4px solid ${habilitada ? m.color : C.border}`,
                opacity: habilitada ? 1 : 0.45,
                cursor: habilitada && !loading ? "pointer" : "not-allowed",
                background: habilitada ? m.color + "08" : C.card,
                transition: "all 0.2s",
                position: "relative",
              }}>
              {yaHizo && (
                <div style={{ position:"absolute", top:8, right:8, width:20, height:20, borderRadius:"50%",
                  background: m.color, display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:11, color:"white", fontWeight:900 }}></div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width:48, height:48, borderRadius:12,
                  background: (habilitada ? m.color : C.muted) + "20",
                  display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <div style={{ width:18, height:18, borderRadius:"50%", background: habilitada ? m.color : C.muted }} />
                </div>
                <div>
                  <div style={{ fontWeight:700, fontSize:14, color: habilitada ? "inherit" : C.muted }}>{m.label}</div>
                  <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>
                    {yaHizo ? "Ya registrado" : habilitada ? m.desc : "No disponible aun"}
                  </div>
                </div>
              </div>
              {loading && habilitada && (
                <div style={{ fontSize:11, color:C.muted, marginTop:8, display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ display:"inline-block", width:8, height:8, borderRadius:"50%", background:m.color, animation:"pulse 1s infinite" }}/>
                  Capturando ubicacion GPS...
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Resultado marcacion */}
      {resultMarca && !showNovedad && (
        <Card style={{ marginTop: 20, borderLeft: `4px solid #06D6A0`, background: "#06D6A008" }}>
          <div style={{ fontWeight:800, fontSize:14, color:"#06D6A0", marginBottom:8 }}>
             {resultMarca.tipo} REGISTRADO
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, fontSize:12 }}>
            <div>
              <span style={{ color:C.muted }}>Empleado: </span>
              <strong>{resultMarca.usuario || marcForm.usuario}</strong>
            </div>
            <div>
              <span style={{ color:C.muted }}>Hora: </span>
              <strong>{resultMarca.hora || new Date().toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit"})}</strong>
            </div>
            <div>
              <span style={{ color:C.muted }}>Vehiculo: </span>
              <strong>{marcForm.vehiculo_placa || ""}</strong>
            </div>
            <div>
              <span style={{ color:C.muted }}>Estado: </span>
              <strong style={{ color:"#06D6A0" }}>Guardado </strong>
            </div>
          </div>
          {/* GPS / Google Maps */}
          {resultMarca.gps?.lat ? (
            <div style={{ marginTop:10, display:"flex", alignItems:"center", gap:10,
              padding:"8px 12px", background:"#00B4D810", borderRadius:8, border:"1px solid #00B4D830" }}>
              <span style={{ fontSize:16 }}></span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#00B4D8" }}>UBICACION GPS CAPTURADA</div>
                <div style={{ fontSize:10, color:C.muted }}>
                  {resultMarca.gps.lat.toFixed(6)}, {resultMarca.gps.lon.toFixed(6)}
                  {resultMarca.gps.precision && ` (${Math.round(resultMarca.gps.precision)}m)`}
                </div>
              </div>
              <div onClick={() => window.open(`https://www.google.com/maps?q=${resultMarca.gps.lat},${resultMarca.gps.lon}&z=16`,"_blank")}
                style={{ padding:"6px 14px", borderRadius:8, background:"#00B4D8", color:"white",
                  fontSize:11, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>
                VER EN MAPA 
              </div>
            </div>
          ) : (
            <div style={{ marginTop:10, padding:"8px 12px", background:"#F59E0B10",
              borderRadius:8, border:"1px solid #F59E0B30", fontSize:11, color:"#F59E0B" }}>
               Sin ubicacion GPS  permite el acceso al GPS para registrar coordenadas
            </div>
          )}
        </Card>
      )}

      {/* Modal novedad hora extra */}
      {showNovedad && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)",
          display:"flex", alignItems:"center", justifyContent:"center", zIndex:999 }}>
          <Card style={{ maxWidth:480, width:"90%", padding:28 }}>
            <div style={{ fontSize:16, fontWeight:800, marginBottom:4, color:C.danger }}>
              ALERTA: Marcacion fuera de horario
            </div>
            <div style={{ fontSize:13, color:C.muted, marginBottom:20 }}>
              Detectamos {resultMarca?.minutos_extra || 0} minutos de hora extra. Indica el motivo.
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:11, fontWeight:600, color:C.muted, display:"block", marginBottom:6 }}>MOTIVO *</label>
              <select value={marcForm.novedad_tipo_id || ""}
                onChange={e => { const s=novedadesTipo.find(n=>n.id===parseInt(e.target.value)); setMarcForm(f=>({...f,novedad_tipo_id:parseInt(e.target.value),_novedad:s})); }}
                style={{ width:"100%", padding:"10px 12px", border:`1px solid ${C.border}`, borderRadius:8, fontSize:13 }}>
                <option value="">Seleccionar motivo</option>
                {novedadesTipo.map(n=><option key={n.id} value={n.id}>{n.nombre}</option>)}
              </select>
            </div>
            {marcForm._novedad?.requiere_texto && (
              <div style={{ marginBottom:16 }}>
                <label style={{ fontSize:11, fontWeight:600, color:C.muted, display:"block", marginBottom:6 }}>DESCRIPCION *</label>
                <textarea value={marcForm.novedad_descripcion}
                  onChange={e=>setMarcForm(f=>({...f,novedad_descripcion:e.target.value}))}
                  rows={3} placeholder="Describe la situacion..."
                  style={{ width:"100%", padding:"10px 12px", border:`1px solid ${C.border}`, borderRadius:8, fontSize:13, resize:"vertical" }} />
              </div>
            )}
            <div style={{ display:"flex", gap:10 }}>
              <Btn onClick={guardarNovedad} style={{ flex:1 }} disabled={loading}>GUARDAR NOVEDAD</Btn>
              <Btn variant="ghost" onClick={()=>setShowNovedad(false)}>CANCELAR</Btn>
            </div>
          </Card>
        </div>
      )}
    </div>
  );

  // ---- PLANEACION DE RUTAS ----
  if (vista === "planeacion") return (
    <div>
      <PageHeader title="Planeacion de Rutas" subtitle="Crear y asignar rutas del dia" onBack={() => setVista("menu")} />
      {msg && <Alert tipo={msg.tipo} texto={msg.texto} onClose={() => setMsg(null)} />}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontWeight:700, marginBottom:12, fontSize:13 }}>NUEVA RUTA</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:12 }}>
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:C.muted, display:"block", marginBottom:4 }}>FECHA</label>
            <input type="date" value={rutaForm.fecha} onChange={e=>setRutaForm(f=>({...f,fecha:e.target.value}))}
              style={{ width:"100%", padding:"10px 12px", border:`1px solid ${C.border}`, borderRadius:8, fontSize:13 }} />
          </div>
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:C.muted, display:"block", marginBottom:4 }}>VEHICULO</label>
            <select value={rutaForm.placa} onChange={e=>setRutaForm(f=>({...f,placa:e.target.value}))}
              style={{ width:"100%", padding:"10px 12px", border:`1px solid ${C.border}`, borderRadius:8, fontSize:13, background:C.bg }}>
              <option value="">Seleccionar</option>
              {vehiculos.map(v=><option key={v.placa} value={v.placa}>{v.placa} - {v.modelo}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:C.muted, display:"block", marginBottom:4 }}>NOTAS</label>
            <input value={rutaForm.notas} onChange={e=>setRutaForm(f=>({...f,notas:e.target.value}))}
              placeholder="Observaciones opcionales"
              style={{ width:"100%", padding:"10px 12px", border:`1px solid ${C.border}`, borderRadius:8, fontSize:13 }} />
          </div>
        </div>
        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:11, fontWeight:600, color:C.muted, display:"block", marginBottom:8 }}>EMPLEADOS</label>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(160px,1fr))", gap:8 }}>
            {personal.map(p => {
              const sel = empSeleccionados.includes(p.nombre);
              return (
                <div key={p.nombre} onClick={()=>setEmpSeleccionados(s=>sel?s.filter(x=>x!==p.nombre):[...s,p.nombre])}
                  style={{ padding:"8px 12px", borderRadius:8, cursor:"pointer", fontSize:12, fontWeight:600,
                    background: sel ? "#06D6A020" : C.bg,
                    border: `1px solid ${sel ? "#06D6A0" : C.border}`,
                    color: sel ? "#06D6A0" : "inherit" }}>
                  {sel ? " " : ""}{p.nombre}
                </div>
              );
            })}
          </div>
        </div>
        <Btn onClick={crearRuta} disabled={loading}>CREAR RUTA</Btn>
      </Card>
      {rutas.length > 0 && (
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:12 }}>RUTAS RECIENTES</div>
          {rutas.slice(0,5).map(r=>(
            <Card key={r.id} style={{ marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontWeight:700, fontSize:13 }}>{r.placa}  {r.fecha}</div>
                <div style={{ fontSize:11, color:C.muted }}>{(r.empleados||[]).join(", ")}</div>
              </div>
              <span style={{ padding:"3px 10px", borderRadius:12, fontSize:11, fontWeight:700,
                background:"#06D6A020", color:"#06D6A0" }}>Activa</span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  // ---- MENU PRINCIPAL ----
  return (
    <div>
      <PageHeader title="Control de Horarios" subtitle="Gestion de tiempos y rutas" onBack={onBack} />
      {msg && <Alert tipo={msg.tipo} texto={msg.texto} onClose={() => setMsg(null)} />}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(220px, 1fr))", gap:16 }}>
        {[
          { id:"marcacion",  label:"Marcacion",          desc:"Registrar ingreso, almuerzo, retorno o cierre",     color:"#06D6A0" },
          { id:"planeacion", label:"Planeacion de Rutas", desc:"Crear y asignar rutas del dia o semana",            color:"#00B4D8" },
          { id:"monitor",    label:"Monitor en Vivo",     desc:"Ver estado actual de todas las rutas del dia",      color:"#F59E0B" },
          { id:"mapa",       label:"Mapa GPS",            desc:"Seguimiento en vivo e historico de operarios",      color:"#8B5CF6" },
        ].map(item => (
          <Card key={item.id} onClick={() => setVista(item.id)}
            style={{ cursor:"pointer", borderBottom:`3px solid ${item.color}`, transition:"transform 0.15s" }}>
            <div style={{ width:40, height:40, borderRadius:10, background:item.color+"20",
              display:"flex", alignItems:"center", justifyContent:"center", marginBottom:12 }}>
              <div style={{ width:16, height:16, borderRadius:"50%", background:item.color }} />
            </div>
            <div style={{ fontWeight:800, fontSize:14, marginBottom:4 }}>{item.label}</div>
            <div style={{ fontSize:11, color:C.muted, lineHeight:1.4 }}>{item.desc}</div>
          </Card>
        ))}
      </div>
      {/* Estado rapido del usuario */}
      {user && (
        <Card style={{ marginTop:20, background: C.card, border:`1px solid ${C.border}` }}>
          <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:8 }}>TU ESTADO HOY</div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {ORDEN_MARCAS.map((tipo, i) => {
              const cfg = { "INGRESO":{ color:"#06D6A0" }, "ALMUERZO":{ color:"#F59E0B" }, "RETORNO":{ color:"#00B4D8" }, "CIERRE":{ color:"#8B5CF6" } }[tipo];
              const done = ultimaMarca && ORDEN_MARCAS.indexOf(ultimaMarca) >= i;
              const next = tipo === proximaMarca;
              return (
                <div key={tipo} style={{ display:"flex", alignItems:"center", gap:4, padding:"4px 12px",
                  borderRadius:20, fontSize:11, fontWeight:700,
                  background: done ? cfg.color+"20" : next ? cfg.color+"15" : C.bg,
                  border:`1px solid ${done||next ? cfg.color : C.border}`,
                  color: done||next ? cfg.color : C.muted }}>
                  {done ? " " : next ? " " : ""}{tipo}
                </div>
              );
            })}
          </div>
          {proximaMarca && (
            <div style={{ marginTop:8, fontSize:12, color:C.muted }}>
              Siguiente marcacion pendiente: <strong style={{ color:"#06D6A0" }}>{proximaMarca}</strong>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

const TruckIcon = ({ tipo, color = "#00B4D8", size = 80 }) => {
  const c = color;
  // Liviano (NHR, NKR, NPR, NNR, NQR) - camion pequeno
  if (["NHR","NKR","NPR","NNR","NQR"].includes(tipo)) return (
    <svg width={size} height={size*0.6} viewBox="0 0 120 72" fill="none">
      <rect x="38" y="18" width="70" height="36" rx="4" fill={c} opacity="0.15" stroke={c} strokeWidth="2"/>
      <rect x="38" y="18" width="70" height="36" rx="4" fill={c} opacity="0.1"/>
      <path d="M38 24 L12 24 L8 36 L8 48 L38 48 Z" fill={c} opacity="0.2" stroke={c} strokeWidth="2"/>
      <rect x="14" y="26" width="18" height="14" rx="2" fill={c} opacity="0.4"/>
      <circle cx="22" cy="56" r="8" fill={c} opacity="0.3" stroke={c} strokeWidth="2"/>
      <circle cx="22" cy="56" r="4" fill={c}/>
      <circle cx="90" cy="56" r="8" fill={c} opacity="0.3" stroke={c} strokeWidth="2"/>
      <circle cx="90" cy="56" r="4" fill={c}/>
      <rect x="8" y="44" width="100" height="4" rx="1" fill={c} opacity="0.3"/>
    </svg>
  );
  // Turbo / Sencillo - camion mediano
  if (["TURBO","SENCILLO"].includes(tipo)) return (
    <svg width={size} height={size*0.6} viewBox="0 0 130 72" fill="none">
      <rect x="42" y="14" width="78" height="40" rx="4" fill={c} opacity="0.15" stroke={c} strokeWidth="2"/>
      <path d="M42 22 L10 22 L6 38 L6 52 L42 52 Z" fill={c} opacity="0.2" stroke={c} strokeWidth="2"/>
      <rect x="12" y="24" width="22" height="16" rx="2" fill={c} opacity="0.4"/>
      <circle cx="24" cy="60" r="9" fill={c} opacity="0.3" stroke={c} strokeWidth="2"/>
      <circle cx="24" cy="60" r="4.5" fill={c}/>
      <circle cx="95" cy="60" r="9" fill={c} opacity="0.3" stroke={c} strokeWidth="2"/>
      <circle cx="95" cy="60" r="4.5" fill={c}/>
      <circle cx="112" cy="60" r="9" fill={c} opacity="0.3" stroke={c} strokeWidth="2"/>
      <circle cx="112" cy="60" r="4.5" fill={c}/>
      <rect x="6" y="48" width="114" height="4" rx="1" fill={c} opacity="0.3"/>
      <rect x="80" y="30" width="12" height="8" rx="1" fill={c} opacity="0.5"/>
    </svg>
  );
  // Dobletroque / Cuatro manos - camion pesado rigido
  if (["DOBLETROQUE","CUATRO MANOS"].includes(tipo)) return (
    <svg width={size} height={size*0.6} viewBox="0 0 140 72" fill="none">
      <rect x="44" y="10" width="88" height="46" rx="4" fill={c} opacity="0.15" stroke={c} strokeWidth="2"/>
      <path d="M44 18 L8 18 L4 38 L4 56 L44 56 Z" fill={c} opacity="0.2" stroke={c} strokeWidth="2"/>
      <rect x="10" y="20" width="24" height="18" rx="2" fill={c} opacity="0.4"/>
      <circle cx="20" cy="63" r="8" fill={c} opacity="0.3" stroke={c} strokeWidth="2"/>
      <circle cx="20" cy="63" r="4" fill={c}/>
      <circle cx="38" cy="63" r="8" fill={c} opacity="0.3" stroke={c} strokeWidth="2"/>
      <circle cx="38" cy="63" r="4" fill={c}/>
      <circle cx="104" cy="63" r="8" fill={c} opacity="0.3" stroke={c} strokeWidth="2"/>
      <circle cx="104" cy="63" r="4" fill={c}/>
      <circle cx="122" cy="63" r="8" fill={c} opacity="0.3" stroke={c} strokeWidth="2"/>
      <circle cx="122" cy="63" r="4" fill={c}/>
      <rect x="4" y="52" width="128" height="4" rx="1" fill={c} opacity="0.3"/>
    </svg>
  );
  // Minimula / Tractomula - articulado
  if (["MINIMULA","TRACTOMULA"].includes(tipo)) return (
    <svg width={size*1.4} height={size*0.6} viewBox="0 0 180 72" fill="none">
      {/* Cabezote */}
      <rect x="4" y="18" width="50" height="38" rx="4" fill={c} opacity="0.25" stroke={c} strokeWidth="2"/>
      <rect x="8" y="22" width="22" height="18" rx="2" fill={c} opacity="0.4"/>
      <circle cx="18" cy="62" r="8" fill={c} opacity="0.3" stroke={c} strokeWidth="2"/>
      <circle cx="18" cy="62" r="4" fill={c}/>
      <circle cx="44" cy="62" r="8" fill={c} opacity="0.3" stroke={c} strokeWidth="2"/>
      <circle cx="44" cy="62" r="4" fill={c}/>
      {/* Union */}
      <rect x="52" y="38" width="10" height="8" rx="2" fill={c} opacity="0.5"/>
      {/* Trailer */}
      <rect x="60" y="14" width="114" height="42" rx="3" fill={c} opacity="0.12" stroke={c} strokeWidth="2"/>
      <line x1="80" y1="14" x2="80" y2="56" stroke={c} strokeWidth="1" opacity="0.3"/>
      <line x1="106" y1="14" x2="106" y2="56" stroke={c} strokeWidth="1" opacity="0.3"/>
      <line x1="132" y1="14" x2="132" y2="56" stroke={c} strokeWidth="1" opacity="0.3"/>
      <circle cx="118" cy="62" r="8" fill={c} opacity="0.3" stroke={c} strokeWidth="2"/>
      <circle cx="118" cy="62" r="4" fill={c}/>
      <circle cx="138" cy="62" r="8" fill={c} opacity="0.3" stroke={c} strokeWidth="2"/>
      <circle cx="138" cy="62" r="4" fill={c}/>
      <circle cx="158" cy="62" r="8" fill={c} opacity="0.3" stroke={c} strokeWidth="2"/>
      <circle cx="158" cy="62" r="4" fill={c}/>
    </svg>
  );
  // Volqueta
  if (tipo === "VOLQUETA") return (
    <svg width={size} height={size*0.6} viewBox="0 0 130 72" fill="none">
      <rect x="42" y="20" width="78" height="28" rx="3" fill={c} opacity="0.15" stroke={c} strokeWidth="2"/>
      <path d="M42 24 L46 14 L116 14 L120 24" fill={c} opacity="0.2" stroke={c} strokeWidth="1.5"/>
      <path d="M10 22 L42 22 L42 52 L10 52 Z" fill={c} opacity="0.2" stroke={c} strokeWidth="2"/>
      <rect x="14" y="26" width="20" height="14" rx="2" fill={c} opacity="0.4"/>
      <circle cx="24" cy="60" r="9" fill={c} opacity="0.3" stroke={c} strokeWidth="2"/>
      <circle cx="24" cy="60" r="4.5" fill={c}/>
      <circle cx="96" cy="60" r="9" fill={c} opacity="0.3" stroke={c} strokeWidth="2"/>
      <circle cx="96" cy="60" r="4.5" fill={c}/>
      <circle cx="114" cy="60" r="9" fill={c} opacity="0.3" stroke={c} strokeWidth="2"/>
      <circle cx="114" cy="60" r="4.5" fill={c}/>
    </svg>
  );
  // Carro tanque
  if (tipo === "CARRO TANQUE") return (
    <svg width={size} height={size*0.6} viewBox="0 0 130 72" fill="none">
      <ellipse cx="90" cy="34" rx="36" ry="20" fill={c} opacity="0.15" stroke={c} strokeWidth="2"/>
      <rect x="54" y="34" width="72" height="10" fill={c} opacity="0.1"/>
      <path d="M10 22 L54 22 L54 52 L10 52 Z" fill={c} opacity="0.2" stroke={c} strokeWidth="2"/>
      <rect x="14" y="26" width="20" height="14" rx="2" fill={c} opacity="0.4"/>
      <circle cx="14" cy="28" r="4" fill={c} opacity="0.6"/>
      <circle cx="24" cy="60" r="9" fill={c} opacity="0.3" stroke={c} strokeWidth="2"/>
      <circle cx="24" cy="60" r="4.5" fill={c}/>
      <circle cx="96" cy="60" r="9" fill={c} opacity="0.3" stroke={c} strokeWidth="2"/>
      <circle cx="96" cy="60" r="4.5" fill={c}/>
      <circle cx="114" cy="60" r="9" fill={c} opacity="0.3" stroke={c} strokeWidth="2"/>
      <circle cx="114" cy="60" r="4.5" fill={c}/>
    </svg>
  );
  // Default / Otro
  return (
    <svg width={size} height={size*0.6} viewBox="0 0 120 72" fill="none">
      <rect x="30" y="20" width="82" height="34" rx="4" fill={c} opacity="0.15" stroke={c} strokeWidth="2"/>
      <path d="M30 26 L8 26 L6 40 L6 52 L30 52 Z" fill={c} opacity="0.2" stroke={c} strokeWidth="2"/>
      <rect x="10" y="28" width="16" height="12" rx="2" fill={c} opacity="0.4"/>
      <circle cx="20" cy="58" r="8" fill={c} opacity="0.3" stroke={c} strokeWidth="2"/>
      <circle cx="20" cy="58" r="4" fill={c}/>
      <circle cx="86" cy="58" r="8" fill={c} opacity="0.3" stroke={c} strokeWidth="2"/>
      <circle cx="86" cy="58" r="4" fill={c}/>
    </svg>
  );
};

// Clasificacion oficial Colombia - Resolucion 004100/2004 Ministerio de Transporte
const TIPOS_VEHICULO = [
  // ---- CAMIONES RIGIDOS LIVIANOS (C2) ----
  {
    tipo: "NHR", codigo: "C2", categoria: "Camion Liviano",
    marcas: "Chevrolet / Isuzu",
    capacidad: "Hasta 2 ton", pbv: "3.5 ton",
    ejes: 2, combustible: "Diesel", cilindraje: "2.8L / 4JB1",
    motor: "Isuzu 4JB1 Turbo Diesel - 94 HP",
    alto: "2.10 m", ancho: "1.90 m", largo: "4.70 m",
    licencia: "C1", descripcion: "Camioneta de carga urbana. Ideal para entregas en ciudad.",
    color_cat: "#06D6A0"
  },
  {
    tipo: "NKR", codigo: "C2", categoria: "Camion Liviano",
    marcas: "Chevrolet / Isuzu",
    capacidad: "Hasta 3 ton", pbv: "5.5 ton",
    ejes: 2, combustible: "Diesel", cilindraje: "2.8L / 4JB1",
    motor: "Isuzu 4JB1 Turbo Diesel - 94 HP",
    alto: "2.10 m", ancho: "2.00 m", largo: "5.20 m",
    licencia: "C1", descripcion: "Camion liviano para distribucion urbana y regional.",
    color_cat: "#06D6A0"
  },
  {
    tipo: "NPR", codigo: "C2", categoria: "Camion Liviano",
    marcas: "Chevrolet / Isuzu",
    capacidad: "Hasta 4.8 ton", pbv: "7.5 ton",
    ejes: 2, combustible: "Diesel", cilindraje: "4.5L / 4HK1",
    motor: "Isuzu 4HK1-TCN Turbo Intercooler - 153 HP",
    alto: "2.20 m", ancho: "2.10 m", largo: "5.98 m",
    licencia: "C1", descripcion: "El mas comercializado en Colombia. Distribucion regional y urbana.",
    color_cat: "#06D6A0"
  },
  {
    tipo: "NNR", codigo: "C2", categoria: "Camion Liviano",
    marcas: "Chevrolet / Isuzu",
    capacidad: "Hasta 4 ton", pbv: "6.3 ton",
    ejes: 2, combustible: "Diesel", cilindraje: "3.0L / 4JJ1",
    motor: "Isuzu 4JJ1 TC Turbo Intercooler - 122 HP",
    alto: "2.20 m", ancho: "2.10 m", largo: "6.10 m",
    licencia: "C1", descripcion: "Camion liviano de capacidad intermedia entre NKR y NPR.",
    color_cat: "#06D6A0"
  },
  {
    tipo: "NQR", codigo: "C2", categoria: "Camion Liviano",
    marcas: "Chevrolet / Isuzu",
    capacidad: "Hasta 5.5 ton", pbv: "8.5 ton",
    ejes: 2, combustible: "Diesel", cilindraje: "4.5L / 4HG1T",
    motor: "Isuzu 4HG1T - 120 HP",
    alto: "2.20 m", ancho: "2.10 m", largo: "5.85 m",
    licencia: "C2", descripcion: "Camion liviano-mediano. Carga regional con terreno dificil.",
    color_cat: "#06D6A0"
  },
  // ---- TURBO (C2) ----
  {
    tipo: "TURBO", codigo: "C2", categoria: "Camion Mediano",
    marcas: "Hino / Foton / JMC / JAC",
    capacidad: "4.5 - 8.5 ton", pbv: "10 ton",
    ejes: 2, combustible: "Diesel", cilindraje: "4.0L - 5.0L",
    motor: "Diesel Turbo 4 cilindros - 130-180 HP",
    alto: "2.20 m", ancho: "2.10 m", largo: "5.00 m",
    licencia: "C2", descripcion: "Camion mediano muy usado en distribucion regional y carga moderada.",
    color_cat: "#00B4D8"
  },
  // ---- SENCILLO (C2) ----
  {
    tipo: "SENCILLO", codigo: "C2", categoria: "Camion Mediano",
    marcas: "Freightliner / Kenworth / Hino / Internacional",
    capacidad: "8 - 10 ton", pbv: "17 ton",
    ejes: 2, combustible: "Diesel", cilindraje: "6.0L - 8.0L",
    motor: "Diesel 6 cilindros - 200-280 HP",
    alto: "2.40 m", ancho: "2.40 m", largo: "6.50 m",
    licencia: "C2", descripcion: "Camion de 2 ejes. Carga intermedia nacional.",
    color_cat: "#00B4D8"
  },
  // ---- DOBLETROQUE (C3) ----
  {
    tipo: "DOBLETROQUE", codigo: "C3", categoria: "Camion Pesado",
    marcas: "Kenworth / Freightliner / Volvo / Hino",
    capacidad: "Hasta 17 ton", pbv: "28.5 ton",
    ejes: 3, combustible: "Diesel", cilindraje: "8.0L - 12.0L",
    motor: "Diesel 6 cilindros Turbo - 280-380 HP",
    alto: "2.40 m", ancho: "2.40 m", largo: "7.20 m",
    licencia: "C3", descripcion: "Camion rigido de 3 ejes. Carga pesada nacional.",
    color_cat: "#F59E0B"
  },
  // ---- CUATRO MANOS (C4) ----
  {
    tipo: "CUATRO MANOS", codigo: "C4", categoria: "Camion Pesado",
    marcas: "Kenworth / Freightliner / Internacional",
    capacidad: "Hasta 24 ton", pbv: "36 ton",
    ejes: 4, combustible: "Diesel", cilindraje: "12.0L - 15.0L",
    motor: "Diesel 6 cilindros Turbo - 350-450 HP",
    alto: "2.40 m", ancho: "2.40 m", largo: "7.60 m",
    licencia: "C3", descripcion: "Camion rigido de 4 ejes. Carga muy pesada.",
    color_cat: "#F59E0B"
  },
  // ---- ARTICULADOS ----
  {
    tipo: "MINIMULA", codigo: "C2S2", categoria: "Articulado",
    marcas: "Kenworth / Freightliner / Volvo / Mack",
    capacidad: "Hasta 20 ton", pbv: "32 ton",
    ejes: 4, combustible: "Diesel", cilindraje: "12.0L+",
    motor: "Diesel 6 cilindros Turbo - 350-480 HP",
    alto: "2.40 m", ancho: "2.40 m", largo: "12.5 m",
    licencia: "C3", descripcion: "Tractocamion con semirremolque de 2 ejes. Distancias intermedias.",
    color_cat: "#8B5CF6"
  },
  {
    tipo: "TRACTOMULA", codigo: "C3S3", categoria: "Articulado",
    marcas: "Kenworth / Freightliner / Volvo / Mack / International",
    capacidad: "Hasta 35 ton", pbv: "52 ton",
    ejes: 6, combustible: "Diesel", cilindraje: "12.0L - 15.0L",
    motor: "Diesel 6 cilindros Turbo - 430-600 HP",
    alto: "2.40 m", ancho: "2.40 m", largo: "18.50 m",
    licencia: "C3", descripcion: "Mayor capacidad de carga del pais. Transporte de larga distancia.",
    color_cat: "#8B5CF6"
  },
  // ---- ESPECIALES ----
  {
    tipo: "VOLQUETA", codigo: "C2/C3", categoria: "Especial",
    marcas: "Mack / Kenworth / Hino / Chevrolet",
    capacidad: "8 - 17 ton", pbv: "28.5 ton",
    ejes: 2, combustible: "Diesel", cilindraje: "6.0L - 12.0L",
    motor: "Diesel Turbo - 200-380 HP",
    alto: "2.40 m", ancho: "2.40 m", largo: "6.50 m",
    licencia: "C2/C3", descripcion: "Carga en obra, materiales a granel. Carroceria volcable.",
    color_cat: "#EF4444"
  },
  {
    tipo: "CARRO TANQUE", codigo: "C2/C3", categoria: "Especial",
    marcas: "Varios / Carroceria especializada",
    capacidad: "5.000 - 20.000 L", pbv: "28.5 ton",
    ejes: 2, combustible: "Diesel", cilindraje: "6.0L+",
    motor: "Diesel Turbo - 200-380 HP",
    alto: "2.40 m", ancho: "2.40 m", largo: "6.50 m",
    licencia: "C2/C3", descripcion: "Transporte de liquidos: combustible, agua, quimicos.",
    color_cat: "#EF4444"
  },
  {
    tipo: "OTRO", codigo: "--", categoria: "Otro",
    marcas: "", capacidad: "", pbv: "",
    ejes: 0, combustible: "Diesel", cilindraje: "",
    motor: "", alto: "", ancho: "", largo: "",
    licencia: "C1", descripcion: "Otro tipo de vehiculo no listado.",
    color_cat: "#6B7A8D"
  },
];

// ==================== GPS TRACKING HOOK ====================
const useGPSTracking = (user, intervaloMin = 5) => {
  const [posicion, setPosicion] = useState(null);
  const [gpsError, setGpsError] = useState(null);
  const [gpsActivo, setGpsActivo] = useState(false);

  const enviarPing = (coords) => {
    if (!user) return;
    fetch(`${API_URL}/gps/ping`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: user.username || user.user,
        nombre: user.nombre || user.username,
        lat: coords.latitude,
        lng: coords.longitude,
        precision: coords.accuracy
      })
    }).catch(() => {});
  };

  useEffect(() => {
    if (!navigator.geolocation) { setGpsError("GPS no disponible"); return; }
    setGpsActivo(true);
    // Ping inmediato
    navigator.geolocation.getCurrentPosition(
      pos => { setPosicion(pos.coords); enviarPing(pos.coords); setGpsError(null); },
      err => { setGpsError("Permiso GPS denegado"); setGpsActivo(false); }
    );
    // Ping cada N minutos
    const iv = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        pos => { setPosicion(pos.coords); enviarPing(pos.coords); setGpsError(null); },
        () => {}
      );
    }, intervaloMin * 60 * 1000);
    return () => clearInterval(iv);
  }, [user?.username]);

  return { posicion, gpsError, gpsActivo };
};

// ==================== MAPA OPERARIOS ====================
const MapaOperarios = ({ user }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});
  const [operarios, setOperarios] = useState([]);
  const [selOp, setSelOp] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [recorrido, setRecorrido] = useState([]);
  const [recorridoOp, setRecorridoOp] = useState(null);
  const recorridoLayerRef = useRef(null);
  // Historico GPS
  const [modoMapa, setModoMapa]             = useState("vivo");
  const [histFecha, setHistFecha]           = useState(new Date(Date.now()-86400000).toISOString().split("T")[0]);
  const [histNombre, setHistNombre]         = useState("");
  const [histPlaca, setHistPlaca]           = useState("");
  const [histResultados, setHistResultados] = useState([]);
  const [histLoading, setHistLoading]       = useState(false);
  const histLayersRef                       = useRef([]);
  const [personalGps, setPersonalGps]       = useState([]);
  const [vehiculosGps, setVehiculosGps]     = useState([]);
  useEffect(() => {
    fetch(`${API_URL}/personal`).then(r=>r.json()).then(d=>setPersonalGps(Array.isArray(d)?d:[])).catch(()=>{});
    fetch(`${API_URL}/vehiculos`).then(r=>r.json()).then(d=>setVehiculosGps(Array.isArray(d)?d:[])).catch(()=>{});
  }, []);
  const { posicion, gpsError, gpsActivo } = useGPSTracking(user, 5);

  const estadoConfig = {
    "INGRESO":    { color: "#06D6A0", label: "En Jornada",  pulse: true  },
    "ALMUERZO":   { color: "#F59E0B", label: "Almuerzo",    pulse: false },
    "RETORNO":    { color: "#00B4D8", label: "Trabajando",  pulse: true  },
    "CIERRE":     { color: "#8B5CF6", label: "Finalizo",    pulse: false },
    "SIN MARCAR": { color: "#94A3B8", label: "Sin iniciar", pulse: false },
  };

  const MARCA_CONFIG = {
    "INGRESO":  { color: "#06D6A0", label: "Ingreso"  },
    "ALMUERZO": { color: "#F59E0B", label: "Almuerzo" },
    "RETORNO":  { color: "#00B4D8", label: "Retorno"  },
    "CIERRE":   { color: "#8B5CF6", label: "Cierre"   },
  };

  const cargarOperarios = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/gps/activos`);
      const d = await r.json();
      setOperarios(Array.isArray(d) ? d : []);
      setLastUpdate(new Date());
    } catch {}
    setLoading(false);
  };

  // Init Leaflet map
  useEffect(() => {
    if (mapInstanceRef.current) return;
    const L = window.L;
    if (!L || !mapRef.current) return;

    const map = L.map(mapRef.current, {
      center: [4.711, -74.0721], zoom: 12,
      zoomControl: true, attributionControl: false
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19
    }).addTo(map);

    // Dark overlay for style
    L.tileLayer("https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png", {
      maxZoom: 19, opacity: 0.6
    }).addTo(map);

    mapInstanceRef.current = map;
    cargarOperarios();
  }, []);

  // Update markers when operarios change
  useEffect(() => {
    const L = window.L;
    const map = mapInstanceRef.current;
    if (!L || !map || operarios.length === 0) return;

    // Remove old markers
    Object.values(markersRef.current).forEach(m => map.removeLayer(m));
    markersRef.current = {};

    const bounds = [];

    operarios.forEach(op => {
      if (!op.lat || !op.lng) return;
      const cfg = estadoConfig[op.ultima_marca] || estadoConfig["SIN MARCAR"];
      const color = cfg.color;
      const initials = (op.nombre || "??").split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase();

      const iconHtml = `
        <div style="
          width:42px; height:42px; border-radius:50%;
          background:${color}; border:3px solid white;
          box-shadow:0 2px 12px ${color}80;
          display:flex; align-items:center; justify-content:center;
          font-weight:900; font-size:12px; color:white;
          font-family:sans-serif; position:relative;
          ${cfg.pulse ? `animation:pulse-marker 2s infinite;` : ""}
        ">
          ${initials}
          <div style="
            position:absolute; bottom:-4px; right:-4px;
            width:14px; height:14px; border-radius:50%;
            background:${color}; border:2px solid white;
          "></div>
        </div>
      `;

      const icon = L.divIcon({
        html: iconHtml, className: "", iconSize: [42, 42], iconAnchor: [21, 21]
      });

      const mins = op.timestamp ? Math.floor((Date.now() - new Date(op.timestamp)) / 60000) : null;
      const popup = L.popup({ maxWidth: 220, className: "apex-popup" }).setContent(`
        <div style="font-family:sans-serif; padding:4px;">
          <div style="font-weight:900; font-size:14px;">${op.nombre || op.username}</div>
          <div style="display:inline-block; padding:2px 8px; border-radius:10px;
            background:${color}20; color:${color}; font-size:11px; font-weight:700; margin:4px 0;">
            ${cfg.label}
          </div>
          ${op.ultima_hora ? `<div style="font-size:11px; color:#6B7A8D;">Ultima marca: ${op.ultima_hora}</div>` : ""}
          ${mins !== null ? `<div style="font-size:11px; color:#6B7A8D;">Actualizado hace ${mins < 1 ? "menos de 1 min" : mins + " min"}</div>` : ""}
          ${op.precision ? `<div style="font-size:10px; color:#94A3B8;">Precision: ${Math.round(op.precision)}m</div>` : ""}
          <div style="margin-top:8px;">
            <a href="https://www.google.com/maps?q=${op.lat},${op.lng}" target="_blank"
              style="font-size:11px; color:#00B4D8; text-decoration:none; font-weight:600;">
              Ver en Google Maps
            </a>
          </div>
        </div>
      `);

      const marker = L.marker([op.lat, op.lng], { icon }).addTo(map).bindPopup(popup);
      marker.on("click", () => setSelOp(op));
      markersRef.current[op.username] = marker;
      bounds.push([op.lat, op.lng]);
    });

    if (bounds.length > 0) {
      try { map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 }); } catch {}
    }
  }, [operarios]);

  // Auto refresh every 5 min
  useEffect(() => {
    const iv = setInterval(cargarOperarios, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, []);

  const activos = operarios.filter(o => ["INGRESO","RETORNO"].includes(o.ultima_marca));
  const enAlmuerzo = operarios.filter(o => o.ultima_marca === "ALMUERZO");
  const finalizados = operarios.filter(o => o.ultima_marca === "CIERRE");

  const COLORES_OP = ["#06D6A0","#00B4D8","#F59E0B","#8B5CF6","#EF4444","#EC4899","#14B8A6","#F97316"];

  const limpiarRecorrido = () => {
    const map = mapInstanceRef.current;
    if (recorridoLayerRef.current && map) {
      recorridoLayerRef.current.forEach(l => { try { map.removeLayer(l); } catch {} });
      recorridoLayerRef.current = null;
    }
    setRecorrido([]); setRecorridoOp(null);
  };

  const limpiarHistorico = () => {
    const map = mapInstanceRef.current;
    if (histLayersRef.current?.length && map) {
      histLayersRef.current.forEach(l => { try { map.removeLayer(l); } catch {} });
      histLayersRef.current = [];
    }
    setHistResultados([]);
  };

  const dibujarHistorico = (grupos) => {
    const L = window.L; const map = mapInstanceRef.current;
    if (!L || !map) return;
    const allLayers = [], allBounds = [];
    grupos.forEach((grupo, gi) => {
      const color = COLORES_OP[gi % COLORES_OP.length];
      const puntos = grupo.marcaciones || [];
      if (!puntos.length) return;
      const coords = puntos.map(p => [p.lat, p.lng]);
      const poly = L.polyline(coords, { color, weight:3, opacity:0.85, dashArray:"8,5" }).addTo(map);
      allLayers.push(poly);
      coords.forEach(c => allBounds.push(c));
      puntos.forEach((p, i) => {
        const mc = MARCA_CONFIG[p.tipo] || { color:"#94A3B8", label: p.tipo };
        const icon = L.divIcon({ html:`<div style="width:30px;height:30px;border-radius:50%;background:${mc.color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:11px;color:white;">${i+1}</div>`, className:"", iconSize:[30,30], iconAnchor:[15,15] });
        const marker = L.marker([p.lat,p.lng],{icon}).addTo(map).bindPopup(
          `<div style="font-family:sans-serif;padding:4px;min-width:160px"><div style="font-weight:800;color:${color}">${grupo.nombre}</div><span style="display:inline-block;padding:2px 8px;border-radius:8px;background:${mc.color}20;color:${mc.color};font-size:11px;font-weight:700">${mc.label}</span><div style="font-size:11px;color:#6B7A8D;margin-top:4px">Hora: ${p.hora}</div>${p.placa?`<div style="font-size:11px;color:#6B7A8D">Vehiculo: ${p.placa}</div>`:""}<a href="https://maps.google.com/?q=${p.lat},${p.lng}" target="_blank" style="font-size:11px;color:#00B4D8;font-weight:600;display:block;margin-top:4px">Ver en Google Maps</a></div>`
        );
        allLayers.push(marker);
      });
    });
    histLayersRef.current = allLayers;
    if (allBounds.length) { try { map.fitBounds(allBounds,{padding:[40,40],maxZoom:15}); } catch {} }
  };

  const buscarHistorico = async () => {
    setHistLoading(true); limpiarHistorico();
    try {
      const params = new URLSearchParams({ fecha: histFecha });
      if (histNombre) params.append("nombre", histNombre);
      if (histPlaca)  params.append("placa",  histPlaca);
      const r = await fetch(`${API_URL}/gps/historico?${params}`);
      const d = await r.json();
      const res = Array.isArray(d) ? d : [];
      setHistResultados(res);
      dibujarHistorico(res);
    } catch {}
    setHistLoading(false);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 120px)", gap:0 }}>

      {/* CSS animations */}
      <style>{`
        @keyframes pulse-marker {
          0%,100% { box-shadow: 0 2px 12px rgba(0,0,0,0.3); transform: scale(1); }
          50% { box-shadow: 0 4px 24px rgba(0,0,0,0.5); transform: scale(1.08); }
        }
        .leaflet-popup-content-wrapper {
          border-radius: 12px !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.15) !important;
        }
        .leaflet-popup-tip { display:none; }
      `}</style>

      {/* Modo vivo / historico */}
      <div style={{ display:"flex", gap:8, marginBottom:14 }}>
        {[["vivo","EN VIVO","#06D6A0"],["historico","HISTORICO","#8B5CF6"]].map(([k,l,col])=>(
          <div key={k} onClick={()=>{ setModoMapa(k); limpiarHistorico(); limpiarRecorrido(); setTimeout(()=>mapInstanceRef.current?.invalidateSize(),100); }}
            style={{ padding:"7px 18px",borderRadius:20,cursor:"pointer",fontWeight:700,fontSize:12,
              background:modoMapa===k?col:C.bg, color:modoMapa===k?"#fff":C.muted,
              border:`1px solid ${modoMapa===k?col:C.border}` }}>
            {k==="vivo"&&<span style={{marginRight:5}}>&#9679;</span>}{l}
          </div>
        ))}
      </div>

      {/* Panel historico */}
      {modoMapa==="historico" && (
        <div style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 16px",marginBottom:14 }}>
          <div style={{ fontSize:11,fontWeight:700,color:"#8B5CF6",marginBottom:10 }}>CONSULTA HISTORICA DE RECORRIDOS</div>
          <div style={{ display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-end" }}>
            <div>
              <div style={{ fontSize:10,fontWeight:700,color:C.muted,marginBottom:4 }}>FECHA</div>
              <input type="date" value={histFecha} onChange={e=>setHistFecha(e.target.value)}
                style={{ padding:"8px 12px",border:`1px solid ${C.border}`,borderRadius:8,fontSize:13 }}/>
            </div>
            <div>
              <div style={{ fontSize:10,fontWeight:700,color:C.muted,marginBottom:4 }}>OPERARIO</div>
              <select value={histNombre} onChange={e=>setHistNombre(e.target.value)}
                style={{ padding:"8px 12px",border:`1px solid ${C.border}`,borderRadius:8,fontSize:13,background:C.bg,minWidth:160 }}>
                <option value="">Todos</option>
                {personalGps.map(p=><option key={p.nombre} value={p.nombre}>{p.nombre}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize:10,fontWeight:700,color:C.muted,marginBottom:4 }}>VEHICULO</div>
              <select value={histPlaca} onChange={e=>setHistPlaca(e.target.value)}
                style={{ padding:"8px 12px",border:`1px solid ${C.border}`,borderRadius:8,fontSize:13,background:C.bg,minWidth:130 }}>
                <option value="">Todos</option>
                {vehiculosGps.map(v=><option key={v.placa} value={v.placa}>{v.placa}</option>)}
              </select>
            </div>
            <button onClick={buscarHistorico} disabled={histLoading}
              style={{ padding:"9px 20px",borderRadius:8,background:"#8B5CF6",color:"#fff",border:"none",fontWeight:700,fontSize:12,cursor:"pointer" }}>
              {histLoading?"BUSCANDO...":"BUSCAR"}
            </button>
            {histResultados.length>0 && (
              <button onClick={limpiarHistorico}
                style={{ padding:"9px 16px",borderRadius:8,background:C.bg,color:"#EF4444",border:`1px solid #EF444440`,fontWeight:700,fontSize:12,cursor:"pointer" }}>
                LIMPIAR
              </button>
            )}
          </div>
          {histResultados.length>0 && (
            <div style={{ marginTop:10,display:"flex",gap:8,flexWrap:"wrap" }}>
              {histResultados.map((g,i)=>(
                <div key={g.nombre} style={{ display:"flex",alignItems:"center",gap:6,padding:"4px 10px",borderRadius:20,
                  background:COLORES_OP[i%COLORES_OP.length]+"15",border:`1px solid ${COLORES_OP[i%COLORES_OP.length]}40` }}>
                  <div style={{ width:10,height:10,borderRadius:"50%",background:COLORES_OP[i%COLORES_OP.length] }}/>
                  <span style={{ fontSize:11,fontWeight:700 }}>{g.nombre}</span>
                  <span style={{ fontSize:10,color:C.muted }}>{g.marcaciones?.length||0} marcas</span>
                </div>
              ))}
            </div>
          )}
          {histResultados.length===0 && !histLoading && (
            <div style={{ marginTop:8,fontSize:12,color:C.muted }}>Selecciona fecha y filtros, luego presiona Buscar.</div>
          )}
        </div>
      )}

      {/* KPI Bar - solo en vivo */}
      {modoMapa==="vivo" && (<div style={{
        display:"flex", gap:12, padding:"12px 0", marginBottom:12, flexWrap:"wrap"
      }}>
        {[
          { label:"EN CAMPO", val:activos.length, color:"#06D6A0", icon:"[act]" },
          { label:"ALMUERZO", val:enAlmuerzo.length, color:"#F59E0B", icon:"[alm]" },
          { label:"FINALIZADO", val:finalizados.length, color:"#8B5CF6", icon:"[fin]" },
          { label:"RASTREADOS", val:operarios.length, color:"#00B4D8", icon:"[tot]" },
        ].map(k => (
          <div key={k.label} style={{
            flex:1, minWidth:100, padding:"10px 16px", borderRadius:10,
            background:`${k.color}10`, border:`1px solid ${k.color}30`,
            display:"flex", alignItems:"center", gap:10
          }}>
            <div style={{ fontSize:24, fontWeight:900, color:k.color }}>{k.val}</div>
            <div style={{ fontSize:10, fontWeight:700, color:k.color, lineHeight:1.3 }}>{k.label}</div>
          </div>
        ))}
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{
            width:10, height:10, borderRadius:"50%",
            background: gpsActivo ? "#06D6A0" : "#EF4444",
            boxShadow: gpsActivo ? "0 0 8px #06D6A0" : "none"
          }}/>
          <span style={{ fontSize:11, color:C.muted }}>
            {gpsActivo ? "Tu GPS activo" : gpsError || "GPS inactivo"}
          </span>
          {lastUpdate && (
            <span style={{ fontSize:10, color:C.muted }}>
              - Act: {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          <button onClick={cargarOperarios}
            style={{ padding:"6px 12px", borderRadius:8, border:`1px solid ${C.border}`,
              background:C.bg, fontSize:11, cursor:"pointer", fontWeight:600 }}>
            {loading ? "..." : "ACTUALIZAR"}
          </button>
        </div>
      </div>)}

      {/* Main content: sidebar + map */}
      <div style={{ display:"flex", gap:14, flex:1, minHeight:0 }}>

        {/* Sidebar operarios */}
        <div style={{
          width:260, flexShrink:0, display:"flex", flexDirection:"column", gap:8,
          overflowY:"auto", paddingRight:4
        }}>
          {operarios.length === 0 && !loading && (
            <div style={{ textAlign:"center", padding:40, color:C.muted }}>
              <div style={{ fontSize:32, marginBottom:8 }}></div>
              <div style={{ fontSize:13 }}>Sin operarios rastreados hoy</div>
              <div style={{ fontSize:11, marginTop:4 }}>Los operarios deben tener GPS activo en su navegador</div>
            </div>
          )}
          {operarios.map(op => {
            const cfg = estadoConfig[op.ultima_marca] || estadoConfig["SIN MARCAR"];
            const mins = op.timestamp ? Math.floor((Date.now() - new Date(op.timestamp)) / 60000) : null;
            const isSelected = selOp?.username === op.username;
            return (
              <div key={op.username}
                onClick={() => {
                  setSelOp(op);
                  const map = mapInstanceRef.current;
                  const marker = markersRef.current[op.username];
                  if (map && marker) { map.setView([op.lat, op.lng], 16); marker.openPopup(); }
                }}
                style={{
                  padding:"12px 14px", borderRadius:10, cursor:"pointer",
                  background: isSelected ? cfg.color+"15" : C.card,
                  border:`1px solid ${isSelected ? cfg.color : C.border}`,
                  transition:"all 0.2s"
                }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{
                    width:38, height:38, borderRadius:"50%", flexShrink:0,
                    background:cfg.color+"20", border:`2px solid ${cfg.color}`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontWeight:900, fontSize:12, color:cfg.color
                  }}>
                    {(op.nombre||"??").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:13, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                      {op.nombre || op.username}
                    </div>
                    <div style={{ fontSize:10, fontWeight:700, color:cfg.color }}>{cfg.label}</div>
                  </div>
                  <div style={{
                    width:8, height:8, borderRadius:"50%", background:cfg.color, flexShrink:0,
                    boxShadow: cfg.pulse ? `0 0 6px ${cfg.color}` : "none"
                  }}/>
                </div>
                {mins !== null && (
                  <div style={{ fontSize:10, color:C.muted, marginTop:6, paddingLeft:48 }}>
                    Hace {mins < 1 ? "menos de 1 min" : `${mins} min`}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Mapa */}
        <div style={{ flex:1, borderRadius:14, overflow:"hidden", border:`1px solid ${C.border}`,
          position:"relative", minHeight:400 }}>
          <div ref={mapRef} style={{ width:"100%", height:"100%" }} />
          {operarios.length === 0 && (
            <div style={{
              position:"absolute", inset:0, display:"flex", flexDirection:"column",
              alignItems:"center", justifyContent:"center",
              background:"rgba(13,27,42,0.7)", color:"white", borderRadius:14
            }}>
              <div style={{ fontSize:48, marginBottom:12 }}></div>
              <div style={{ fontSize:16, fontWeight:700 }}>Sin senales GPS activas</div>
              <div style={{ fontSize:12, opacity:0.7, marginTop:4 }}>
                Esperando que los operarios activen su ubicacion
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


const Vehiculos = ({ onBack }) => {
  const [vista, setVista]       = useState("lista");
  const [lista, setLista]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [toast, setToast]       = useState(null);
  const [vehSel, setVehSel]     = useState(null);
  const [tipoSel, setTipoSel]   = useState(null);
  const [paso, setPaso]         = useState(1); // 1=tipo, 2=datos
  const [form, setForm]         = useState({
    placa:"", modelo:"", tipo:"", marca:"", anio: new Date().getFullYear(),
    color:"", cilindraje:"", capacidad_carga:"", combustible:"",
    kilometraje:"", num_serie:"", num_motor:"",
    soat_vence:"", tecnomecanica_vence:"", seguro_vence:"",
    propietario:"", observaciones:"", estado:"activo"
  });

  const cargar = async () => {
    setLoading(true);
    try {
      const r = await fetch(API_URL + "/vehiculos");
      const d = await r.json();
      setLista(Array.isArray(d) ? d : []);
    } catch { setLista([]); }
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const seleccionarTipo = (t) => {
    setTipoSel(t);
    setForm(f => ({
      ...f,
      tipo: t.tipo,
      marca: f.marca || "",
      combustible: t.combustible,
      cilindraje: t.cilindraje,
      capacidad_carga: t.capacidad,
      modelo: f.modelo || t.tipo
    }));
    setPaso(2);
  };

  const guardar = async () => {
    if (!form.placa) { setToast({ msg: "La placa es obligatoria", type: "error" }); return; }
    try {
      const url = vehSel ? `${API_URL}/vehiculos/${vehSel.id}` : `${API_URL}/vehiculos`;
      const method = vehSel ? "PUT" : "POST";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, kilometraje: parseInt(form.kilometraje || 0), anio: parseInt(form.anio) })
      });
      if (res.ok) {
        setToast({ msg: vehSel ? "Vehiculo actualizado" : "Vehiculo registrado exitosamente", type: "success" });
        setTimeout(() => { setVista("lista"); setVehSel(null); setPaso(1); setTipoSel(null); cargar(); }, 1400);
      } else {
        const e = await res.json();
        setToast({ msg: e.detail || "Error al guardar", type: "error" });
      }
    } catch { setToast({ msg: "Error de conexion", type: "error" }); }
  };

  const abrirEdicion = (v) => {
    setVehSel(v);
    setForm({
      placa: v.placa||"", modelo: v.modelo||"", tipo: v.tipo||"",
      marca: v.marca||"", anio: v.anio||new Date().getFullYear(),
      color: v.color||"", cilindraje: v.cilindraje||"",
      capacidad_carga: v.capacidad_carga||"", combustible: v.combustible||"",
      kilometraje: v.kilometraje||"", num_serie: v.num_serie||"",
      num_motor: v.num_motor||"", soat_vence: v.soat_vence||"",
      tecnomecanica_vence: v.tecnomecanica_vence||"",
      seguro_vence: v.seguro_vence||"", propietario: v.propietario||"",
      observaciones: v.observaciones||"", estado: v.estado||"activo"
    });
    const t = TIPOS_VEHICULO.find(t => t.tipo === v.tipo) || TIPOS_VEHICULO[TIPOS_VEHICULO.length-1];
    setTipoSel(t); setPaso(2); setVista("form");
  };

  const estadoColor = { activo: "#06D6A0", inactivo: "#EF4444", mantenimiento: "#F59E0B" };

  // ---- VISTA DETALLE ----
  if (vista === "detalle" && vehSel) return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <PageHeader title="Detalle Vehiculo" onBack={() => { setVista("lista"); setVehSel(null); }} />
      <div style={{ maxWidth: 640 }}>
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 16, marginBottom: 20, alignItems: "flex-start" }}>
            <div style={{
              width: 64, height: 64, borderRadius: 12, background: C.accent+"20",
              border: `2px solid ${C.accent}`, display: "flex", alignItems: "center",
              justifyContent: "center", fontWeight: 900, fontSize: 13, color: C.accent, flexShrink: 0
            }}>{vehSel.placa?.slice(0,3)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 22, fontWeight: 900 }}>{vehSel.placa}</div>
              <div style={{ fontSize: 13, color: C.muted }}>{vehSel.marca} {vehSel.modelo} {vehSel.anio ? `(${vehSel.anio})` : ""}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                <span style={{ padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700, background: C.accent+"20", color: C.accent }}>{vehSel.tipo || "Sin tipo"}</span>
                <span style={{ padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700, background: (estadoColor[vehSel.estado]||"#ccc")+"20", color: estadoColor[vehSel.estado]||C.muted }}>{(vehSel.estado||"activo").toUpperCase()}</span>
                {vehSel.color && <span style={{ padding:"3px 10px", borderRadius:20, fontSize:11, background:C.bg, border:`1px solid ${C.border}`, color:C.muted }}>{vehSel.color}</span>}
              </div>
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:16 }}>
            {[
              { icon:"[eng]", label:"CILINDRAJE",    val: vehSel.cilindraje||"-" },
              { icon:"[gas]", label:"COMBUSTIBLE",   val: vehSel.combustible||"-" },
              { icon:"[caja]", label:"CAPACIDAD",     val: vehSel.capacidad_carga||"-" },
              { icon:"[ruta]", label:"KILOMETRAJE",   val: vehSel.kilometraje ? `${Number(vehSel.kilometraje).toLocaleString()} km` : "-" },
              { icon:"[serie]", label:"N. SERIE",      val: vehSel.num_serie||"-" },
              { icon:"[motor]", label:"N. MOTOR",      val: vehSel.num_motor||"-" },
            ].map(f => (
              <div key={f.label} style={{ padding:"10px 12px", background:C.bg, borderRadius:8, border:`1px solid ${C.border}` }}>
                <div style={{ fontSize:16, marginBottom:4 }}>{f.icon}</div>
                <div style={{ fontSize:9, fontWeight:700, color:C.muted }}>{f.label}</div>
                <div style={{ fontSize:13, fontWeight:700 }}>{f.val}</div>
              </div>
            ))}
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:16 }}>
            {[
              { label:"SOAT VENCE",         val:vehSel.soat_vence, warn: vehSel.soat_vence && new Date(vehSel.soat_vence) < new Date() },
              { label:"TECNOMECANICA",      val:vehSel.tecnomecanica_vence, warn: vehSel.tecnomecanica_vence && new Date(vehSel.tecnomecanica_vence) < new Date() },
              { label:"SEGURO VENCE",       val:vehSel.seguro_vence, warn: vehSel.seguro_vence && new Date(vehSel.seguro_vence) < new Date() },
            ].map(f => (
              <div key={f.label} style={{ padding:"10px 12px", background: f.warn ? "#EF444410" : C.bg, borderRadius:8, border:`1px solid ${f.warn ? "#EF444440" : C.border}` }}>
                <div style={{ fontSize:9, fontWeight:700, color: f.warn ? "#EF4444" : C.muted }}>{f.label} {f.warn ? "VENCIDO" : ""}</div>
                <div style={{ fontSize:13, fontWeight:700, color: f.warn ? "#EF4444" : C.text }}>{f.val||"-"}</div>
              </div>
            ))}
          </div>

          {vehSel.propietario && (
            <div style={{ padding:"10px 14px", background:C.bg, borderRadius:8, border:`1px solid ${C.border}`, marginBottom:12 }}>
              <div style={{ fontSize:10, color:C.muted, fontWeight:700 }}>PROPIETARIO</div>
              <div style={{ fontWeight:700 }}>{vehSel.propietario}</div>
            </div>
          )}
          {vehSel.observaciones && (
            <div style={{ padding:"10px 14px", background:"#F59E0B10", borderRadius:8, border:"1px solid #F59E0B30", marginBottom:12 }}>
              <div style={{ fontSize:10, color:"#F59E0B", fontWeight:700 }}>OBSERVACIONES</div>
              <div style={{ fontSize:13 }}>{vehSel.observaciones}</div>
            </div>
          )}

          <div style={{ display:"flex", gap:10 }}>
            <Btn onClick={() => abrirEdicion(vehSel)} style={{ flex:1 }}>EDITAR</Btn>
          </div>
        </Card>
      </div>
    </div>
  );

  // ---- VISTA FORM ----
  if (vista === "form") return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <PageHeader
        title={vehSel ? "Editar Vehiculo" : paso === 1 ? "Tipo de Vehiculo" : `Registro: ${tipoSel?.tipo}`}
        onBack={() => {
          if (paso === 2 && !vehSel) { setPaso(1); setTipoSel(null); }
          else { setVista("lista"); setVehSel(null); setPaso(1); setTipoSel(null); }
        }} />

      {/* PASO 1: Seleccion de tipo */}
      {paso === 1 && (
        <div>
          <p style={{ color:C.muted, marginBottom:20 }}>Selecciona el tipo de vehiculo para precargar sus datos tecnicos</p>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))", gap:14 }}>
            {TIPOS_VEHICULO.map(t => (
              <Card key={t.tipo} onClick={() => seleccionarTipo(t)}
                style={{ cursor:"pointer", padding:0, overflow:"hidden",
                  border: tipoSel?.tipo === t.tipo ? `2px solid ${C.accent}` : `1px solid ${C.border}` }}>
                <div style={{
                  height:110, background:(t.color_cat||C.accent)+"12",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  borderBottom:`1px solid ${(t.color_cat||C.accent)}30`
                }}>
                  <TruckIcon tipo={t.tipo} color={t.color_cat||C.accent} size={80} />
                </div>
                <div style={{ padding:"12px 14px" }}>
                  <div style={{ fontWeight:800, fontSize:14 }}>{t.tipo}</div>
                  <div style={{ fontSize:11, color:C.muted }}>{t.marca}</div>
                  <div style={{ fontSize:11, color:C.accent, fontWeight:600 }}>{t.categoria}</div>
                  {t.capacidad && <div style={{ fontSize:10, color:C.muted, marginTop:4 }}>Cap: {t.capacidad}</div>}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* PASO 2: Datos del vehiculo */}
      {paso === 2 && (
        <div style={{ maxWidth:640 }}>
          {tipoSel && (
            <Card style={{ marginBottom:16, padding:0, overflow:"hidden", borderTop:`4px solid ${tipoSel.color_cat || C.accent}` }}>
              <div style={{ display:"flex", alignItems:"center", gap:0 }}>
                <div style={{ width:140, flexShrink:0, background: (tipoSel.color_cat||C.accent)+"15",
                  display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:12, minHeight:100 }}>
                  <TruckIcon tipo={tipoSel.tipo} color={tipoSel.color_cat || C.accent} size={90} />
                  <div style={{ fontSize:10, fontWeight:800, color: tipoSel.color_cat || C.accent, marginTop:4 }}>{tipoSel.codigo}</div>
                </div>
                <div style={{ padding:"16px 20px", flex:1 }}>
                  <div style={{ fontSize:18, fontWeight:900 }}>{tipoSel.tipo}</div>
                  <div style={{ fontSize:11, fontWeight:700, color: tipoSel.color_cat || C.accent }}>{tipoSel.categoria} - Codigo {tipoSel.codigo}</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginTop:8 }}>
                    {tipoSel.capacidad && <div><span style={{fontSize:9,color:C.muted}}>CAPACIDAD </span><strong style={{fontSize:12}}>{tipoSel.capacidad}</strong></div>}
                    {tipoSel.pbv && <div><span style={{fontSize:9,color:C.muted}}>PBV </span><strong style={{fontSize:12}}>{tipoSel.pbv}</strong></div>}
                    {tipoSel.licencia && <div><span style={{fontSize:9,color:C.muted}}>LICENCIA </span><strong style={{fontSize:12}}>{tipoSel.licencia}</strong></div>}
                    {tipoSel.ejes > 0 && <div><span style={{fontSize:9,color:C.muted}}>EJES </span><strong style={{fontSize:12}}>{tipoSel.ejes}</strong></div>}
                  </div>
                  {tipoSel.motor && <div style={{fontSize:11,color:C.muted,marginTop:4}}>{tipoSel.motor}</div>}
                </div>
              </div>
            </Card>
          )}

          <Card style={{ marginBottom:14 }}>
            <div style={{ fontWeight:700, fontSize:13, color:C.muted, marginBottom:12 }}>IDENTIFICACION</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <Input label="PLACA *" value={form.placa} onChange={v => setForm(f=>({...f, placa: v.toUpperCase()}))} placeholder="Ej: ABC123" />
              <Input label="ANo" value={String(form.anio)} onChange={v => setForm(f=>({...f, anio:v}))} placeholder={String(new Date().getFullYear())} />
              <Input label="MARCA" value={form.marca} onChange={v => setForm(f=>({...f, marca:v}))} />
              <Input label="MODELO" value={form.modelo} onChange={v => setForm(f=>({...f, modelo:v}))} />
              <Input label="COLOR" value={form.color} onChange={v => setForm(f=>({...f, color:v}))} placeholder="Ej: Blanco" />
              <Sel label="ESTADO" value={form.estado} onChange={v => setForm(f=>({...f, estado:v}))}
                options={[
                  {value:"activo",label:"Activo"},
                  {value:"inactivo",label:"Inactivo"},
                  {value:"mantenimiento",label:"En Mantenimiento"}
                ]} />
            </div>
          </Card>

          <Card style={{ marginBottom:14 }}>
            <div style={{ fontWeight:700, fontSize:13, color:C.muted, marginBottom:12 }}>DATOS TECNICOS</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <Sel label="COMBUSTIBLE" value={form.combustible} onChange={v => setForm(f=>({...f, combustible:v}))}
                options={["Diesel","Gasolina","Gas Natural","Electrico","Hibrido"].map(x=>({value:x,label:x}))} />
              <Input label="CILINDRAJE" value={form.cilindraje} onChange={v => setForm(f=>({...f, cilindraje:v}))} placeholder="Ej: 5.2L" />
              <Input label="CAPACIDAD DE CARGA" value={form.capacidad_carga} onChange={v => setForm(f=>({...f, capacidad_carga:v}))} placeholder="Ej: 3.5 ton" />
              <Input label="KILOMETRAJE ACTUAL" value={String(form.kilometraje)} onChange={v => setForm(f=>({...f, kilometraje:v}))} placeholder="km" />
              <Input label="NUMERO DE SERIE" value={form.num_serie} onChange={v => setForm(f=>({...f, num_serie:v}))} />
              <Input label="NUMERO DE MOTOR" value={form.num_motor} onChange={v => setForm(f=>({...f, num_motor:v}))} />
            </div>
          </Card>

          <Card style={{ marginBottom:14 }}>
            <div style={{ fontWeight:700, fontSize:13, color:C.muted, marginBottom:12 }}>DOCUMENTOS Y VENCIMIENTOS</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
              <Input label="SOAT VENCE" value={form.soat_vence} onChange={v => setForm(f=>({...f, soat_vence:v}))} type="date" />
              <Input label="TECNOMECANICA" value={form.tecnomecanica_vence} onChange={v => setForm(f=>({...f, tecnomecanica_vence:v}))} type="date" />
              <Input label="SEGURO VENCE" value={form.seguro_vence} onChange={v => setForm(f=>({...f, seguro_vence:v}))} type="date" />
            </div>
          </Card>

          <Card style={{ marginBottom:14 }}>
            <div style={{ fontWeight:700, fontSize:13, color:C.muted, marginBottom:12 }}>PROPIETARIO Y NOTAS</div>
            <Input label="PROPIETARIO / EMPRESA" value={form.propietario} onChange={v => setForm(f=>({...f, propietario:v}))} />
            <div style={{ marginTop:12 }}>
              <label style={{ fontSize:11, fontWeight:600, color:C.muted, display:"block", marginBottom:4 }}>OBSERVACIONES</label>
              <textarea value={form.observaciones} onChange={e => setForm(f=>({...f, observaciones:e.target.value}))}
                placeholder="Notas adicionales, condicion del vehiculo..."
                style={{ width:"100%", minHeight:80, padding:"10px 12px", border:`1px solid ${C.border}`,
                  borderRadius:8, fontSize:13, fontFamily:"inherit", resize:"vertical", background:C.bg }} />
            </div>
          </Card>

          <Btn onClick={guardar} style={{ width:"100%", padding:"14px" }}>
            {vehSel ? "GUARDAR CAMBIOS" : "REGISTRAR VEHICULO"}
          </Btn>
        </div>
      )}
    </div>
  );

  // ---- VISTA LISTA ----
  const estadoBadge = (e) => ({
    activo:        { label:"ACTIVO",         color:"#06D6A0" },
    inactivo:      { label:"INACTIVO",       color:"#EF4444" },
    mantenimiento: { label:"MANTENIMIENTO",  color:"#F59E0B" },
  }[e] || { label: (e||"ACTIVO").toUpperCase(), color: "#06D6A0" });

  const docVencida = (v) =>
    (v.soat_vence && new Date(v.soat_vence) < new Date()) ||
    (v.tecnomecanica_vence && new Date(v.tecnomecanica_vence) < new Date()) ||
    (v.seguro_vence && new Date(v.seguro_vence) < new Date());

  return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
        <div>
          <h2 style={{ margin:0, fontSize:22, fontWeight:800 }}>Flota de Vehiculos</h2>
          <p style={{ margin:0, fontSize:13, color:C.muted }}>{lista.length} vehiculo(s) registrado(s)</p>
        </div>
        <Btn onClick={() => { setPaso(1); setTipoSel(null); setVehSel(null);
          setForm({ placa:"",modelo:"",tipo:"",marca:"",anio:new Date().getFullYear(),color:"",
            cilindraje:"",capacidad_carga:"",combustible:"",kilometraje:"",num_serie:"",
            num_motor:"",soat_vence:"",tecnomecanica_vence:"",seguro_vence:"",
            propietario:"",observaciones:"",estado:"activo" });
          setVista("form"); }}>+ NUEVO VEHICULO</Btn>
      </div>

      {loading ? (
        <div style={{ textAlign:"center", padding:40, color:C.muted }}>Cargando...</div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(300px, 1fr))", gap:14 }}>
          {lista.map((v,i) => {
            const badge = estadoBadge(v.estado);
            const vencida = docVencida(v);
            return (
              <Card key={i} onClick={() => { setVehSel(v); setVista("detalle"); }}
                style={{ cursor:"pointer", borderLeft:`4px solid ${badge.color}`,
                  outline: vencida ? "2px solid #EF444440" : "none" }}>
                <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10 }}>
                  <div style={{
                    width:52, height:52, borderRadius:10, flexShrink:0,
                    background: C.accent+"20", border:`2px solid ${C.accent}`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontWeight:900, fontSize:11, color:C.accent
                  }}>{v.placa?.slice(0,3)}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:800, fontSize:15 }}>{v.placa}</div>
                    <div style={{ fontSize:12, color:C.muted }}>{v.marca} {v.modelo} {v.anio ? `(${v.anio})` : ""}</div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
                    <span style={{ padding:"3px 8px", borderRadius:20, fontSize:10, fontWeight:700, background: badge.color+"20", color: badge.color }}>{badge.label}</span>
                    {v.tipo && <span style={{ padding:"2px 8px", borderRadius:20, fontSize:10, background:C.bg, border:`1px solid ${C.border}`, color:C.muted }}>{v.tipo}</span>}
                  </div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
                  {v.combustible && (
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontSize:9, color:C.muted }}>COMBUSTIBLE</div>
                      <div style={{ fontSize:11, fontWeight:700 }}>{v.combustible}</div>
                    </div>
                  )}
                  {v.capacidad_carga && (
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontSize:9, color:C.muted }}>CAPACIDAD</div>
                      <div style={{ fontSize:11, fontWeight:700 }}>{v.capacidad_carga}</div>
                    </div>
                  )}
                  {v.kilometraje > 0 && (
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontSize:9, color:C.muted }}>KM</div>
                      <div style={{ fontSize:11, fontWeight:700 }}>{Number(v.kilometraje).toLocaleString()}</div>
                    </div>
                  )}
                </div>
                {vencida && (
                  <div style={{ marginTop:8, padding:"4px 8px", borderRadius:6, background:"#EF444415", border:"1px solid #EF444430", fontSize:10, fontWeight:700, color:"#EF4444" }}>
                    Documento(s) vencido(s) - Requiere atencion
                  </div>
                )}
              </Card>
            );
          })}
          {lista.length === 0 && (
            <div style={{ gridColumn:"1/-1", textAlign:"center", padding:40, color:C.muted }}>
              <div style={{ fontSize:40, marginBottom:12 }}>[camion]</div>
              <div>No hay vehiculos registrados</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};


const CATEGORIAS_REF = [
  { id: "muebles",      label: "Muebles",          icon: "MU" },
  { id: "closets",      label: "Closets",           icon: "CL" },
  { id: "escritorios",  label: "Escritorios",       icon: "ES" },
  { id: "cocinas",      label: "Cocinas",           icon: "CO" },
  { id: "bibliotecas",  label: "Bibliotecas",       icon: "BI" },
  { id: "camas",        label: "Camas y Camarotes", icon: "CA" },
  { id: "salas",        label: "Salas y Comedores", icon: "SC" },
  { id: "oficina",      label: "Mobiliario Oficina", icon: "OF" },
  { id: "otro",         label: "Otro",              icon: "OT" },
];

const Servicios = ({ onBack, user }) => {
  const [vista, setVista]       = useState("lista");
  const [ordenes, setOrdenes]   = useState([]);
  const [refs, setRefs]         = useState([]);
  const [personal, setPersonal] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [toast, setToast]       = useState(null);
  const [ordenSel, setOrdenSel] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [pasoServicio, setPasoServicio] = useState(1);
  const [inspeccion, setInspeccion]     = useState([]);
  const [novedades, setNovedades]       = useState([]);
  const [formNovedad, setFormNovedad]   = useState({ descripcion:"", tipo:"averia", accion:"cambio" });
  const [showNovedad, setShowNovedad]   = useState(false);
  const firmaRef = useRef(null);
  const [firmando, setFirmando]         = useState(false);

  const [formOrden, setFormOrden] = useState({
    referencia_id:"", tecnico_id:"", tipo_servicio:"montaje",
    cliente_nombre:"", cliente_direccion:"", cliente_telefono:"",
    num_factura:"", observaciones:"", fecha_programada:""
  });

  const cargar = async () => {
    setLoading(true);
    try {
      const [o, r, p] = await Promise.all([
        fetch(`${API_URL}/ordenes`).then(x=>x.json()),
        fetch(`${API_URL}/referencias?activo=true`).then(x=>x.json()),
        fetch(`${API_URL}/personal`).then(x=>x.json()),
      ]);
      setOrdenes(Array.isArray(o)?o:[]);
      setRefs(Array.isArray(r)?r:[]);
      setPersonal(Array.isArray(p)?p:[]);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const crearOrden = async () => {
    if (!formOrden.referencia_id||!formOrden.cliente_nombre||!formOrden.cliente_direccion) {
      setToast({ msg:"Referencia, cliente y direccion son obligatorios", type:"error" }); return;
    }
    try {
      const res = await fetch(`${API_URL}/ordenes?creado_por=${encodeURIComponent(user?.nombre||"admin")}`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ ...formOrden, referencia_id:parseInt(formOrden.referencia_id), tecnico_id:formOrden.tecnico_id?parseInt(formOrden.tecnico_id):null })
      });
      if (res.ok) {
        setToast({ msg:"Orden creada exitosamente", type:"success" });
        setTimeout(() => { setVista("lista"); cargar(); }, 1400);
      } else { const e=await res.json(); setToast({ msg:e.detail||"Error", type:"error" }); }
    } catch { setToast({ msg:"Error de conexion", type:"error" }); }
  };

  const abrirOrden = async (ord) => {
    setOrdenSel(ord);
    // Cargar piezas de la referencia para inspeccion
    if (ord.referencia_id) {
      const refData = refs.find(r=>r.id===ord.referencia_id);
      if (refData?.piezas) {
        setInspeccion(refData.piezas.map(p=>({ pieza_id:p.id, nombre_pieza:p.nombre, estado:"ok", novedad_descripcion:"", accion_solicitada:"ninguna" })));
      }
    }
    const novsRes = await fetch(`${API_URL}/ordenes/${ord.id}/detalle`).then(r=>r.json()).catch(()=>({}));
    setNovedades(novsRes.novedades||[]);
    setPasoServicio(ord.estado==="pendiente"?1:ord.estado==="en_curso"?2:ord.estado==="inspeccion"?3:ord.estado==="ejecucion"?4:5);
    setVista("servicio");
  };

  const iniciarOrden = async () => {
    try {
      let lat=null, lng=null;
      try {
        const pos = await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{timeout:5000}));
        lat=pos.coords.latitude; lng=pos.coords.longitude;
      } catch {}
      await fetch(`${API_URL}/ordenes/${ordenSel.id}/iniciar?lat=${lat||0}&lng=${lng||0}`, { method:"PATCH" });
      setOrdenSel(o=>({...o, estado:"en_curso", lat_inicio:lat, lng_inicio:lng}));
      setPasoServicio(2);
      setToast({ msg:"Orden iniciada - GPS registrado", type:"success" });
    } catch { setToast({ msg:"Error al iniciar", type:"error" }); }
  };

  const guardarInspeccion = async () => {
    try {
      await fetch(`${API_URL}/ordenes/${ordenSel.id}/inspeccion`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify(inspeccion)
      });
      setOrdenSel(o=>({...o, estado:"inspeccion"}));
      setPasoServicio(3);
      setToast({ msg:"Inspeccion guardada", type:"success" });
    } catch { setToast({ msg:"Error al guardar inspeccion", type:"error" }); }
  };

  const guardarNovedad = async () => {
    if (!formNovedad.descripcion) return;
    try {
      await fetch(`${API_URL}/novedades_servicio`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ ...formNovedad, orden_id:ordenSel.id })
      });
      setNovedades(n=>[...n, { ...formNovedad, timestamp:new Date().toISOString() }]);
      setFormNovedad({ descripcion:"", tipo:"averia", accion:"cambio" });
      setShowNovedad(false);
      setToast({ msg:"Novedad registrada", type:"success" });
    } catch {}
  };

  const avanzarEjecucion = () => {
    setOrdenSel(o=>({...o, estado:"ejecucion"}));
    setPasoServicio(4);
  };

  const cerrarOrden = async () => {
    try {
      await fetch(`${API_URL}/ordenes/${ordenSel.id}/cerrar`, { method:"PATCH" });
      setOrdenSel(o=>({...o, estado:"cerrada"}));
      setToast({ msg:"Servicio cerrado exitosamente", type:"success" });
      setTimeout(()=>{ setVista("lista"); cargar(); }, 1600);
    } catch { setToast({ msg:"Error al cerrar", type:"error" }); }
  };

  const ordFiltradas = filtroEstado ? ordenes.filter(o=>o.estado===filtroEstado) : ordenes;
  const refSel = refs.find(r=>r.id===parseInt(formOrden.referencia_id));

  // ---- PASOS INDICADOR ----
  const PasosIndicador = ({ paso }) => {
    const pasos = ["Inicio","Fachada","Inspeccion","Ejecucion","Cierre"];
    return (
      <div style={{ display:"flex",alignItems:"center",gap:0,marginBottom:20 }}>
        {pasos.map((p,i) => (
          <div key={i} style={{ display:"flex",alignItems:"center",flex:i<pasos.length-1?1:"auto" }}>
            <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:4 }}>
              <div style={{ width:32,height:32,borderRadius:"50%",
                background: paso>i+1?"#06D6A0":paso===i+1?C.accent:C.bg,
                border:`2px solid ${paso>i+1?"#06D6A0":paso===i+1?C.accent:C.border}`,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontWeight:800,fontSize:12,
                color:paso>i+1||paso===i+1?"#fff":C.muted }}>
                {paso>i+1 ? "ok" : i+1}
              </div>
              <div style={{ fontSize:9,fontWeight:700,color:paso===i+1?C.accent:C.muted,whiteSpace:"nowrap" }}>{p}</div>
            </div>
            {i<pasos.length-1 && (
              <div style={{ flex:1,height:2,background:paso>i+1?"#06D6A0":C.border,margin:"0 4px",marginBottom:16 }}/>
            )}
          </div>
        ))}
      </div>
    );
  };

  // ---- VISTA SERVICIO (flujo tecnico) ----
  if (vista === "servicio" && ordenSel) return (
    <div>
      {toast && <Toast {...toast} onClose={()=>setToast(null)} />}
      <PageHeader title={`Orden ${ordenSel.consecutivo}`}
        subtitle={`${ordenSel.tipo_servicio?.toUpperCase()} - ${ordenSel.referencia_nombre}`}
        onBack={()=>{ setVista("lista"); cargar(); }} />
      <div style={{ maxWidth:600 }}>
        <PasosIndicador paso={pasoServicio} />

        {/* Info cliente */}
        <Card style={{ marginBottom:14,borderLeft:`4px solid ${(ESTADO_ORDEN[ordenSel.estado]||ESTADO_ORDEN.pendiente).color}` }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
            <div>
              <div style={{ fontSize:11,color:C.muted,fontWeight:700 }}>CLIENTE</div>
              <div style={{ fontWeight:800,fontSize:15 }}>{ordenSel.cliente_nombre}</div>
              <div style={{ fontSize:12,color:C.muted }}>{ordenSel.cliente_direccion}</div>
              {ordenSel.cliente_telefono && <div style={{ fontSize:12,color:C.muted }}>{ordenSel.cliente_telefono}</div>}
              {ordenSel.num_factura && <div style={{ fontSize:11,color:C.accent,fontWeight:600 }}>Factura: {ordenSel.num_factura}</div>}
            </div>
            <span style={{ padding:"4px 10px",borderRadius:10,fontSize:11,fontWeight:700,
              background:(ESTADO_ORDEN[ordenSel.estado]||ESTADO_ORDEN.pendiente).bg,
              color:(ESTADO_ORDEN[ordenSel.estado]||ESTADO_ORDEN.pendiente).color }}>
              {(ESTADO_ORDEN[ordenSel.estado]||ESTADO_ORDEN.pendiente).label}
            </span>
          </div>
          <div style={{ marginTop:10,paddingTop:10,borderTop:`1px solid ${C.border}`,
            display:"flex",gap:12 }}>
            <div>
              <div style={{ fontSize:9,color:C.muted }}>REFERENCIA</div>
              <div style={{ fontSize:12,fontWeight:700 }}>{ordenSel.referencia_nombre}</div>
            </div>
            <div>
              <div style={{ fontSize:9,color:C.muted }}>TIPO</div>
              <div style={{ fontSize:12,fontWeight:700,textTransform:"capitalize" }}>{ordenSel.tipo_servicio}</div>
            </div>
            {ordenSel.fecha_inicio && (
              <div>
                <div style={{ fontSize:9,color:C.muted }}>INICIADO</div>
                <div style={{ fontSize:12,fontWeight:700 }}>{new Date(ordenSel.fecha_inicio).toLocaleTimeString()}</div>
              </div>
            )}
          </div>
        </Card>

        {/* PASO 1: Iniciar */}
        {pasoServicio === 1 && (
          <Card>
            <div style={{ textAlign:"center",padding:"10px 0 16px" }}>
              <div style={{ fontSize:32,marginBottom:8 }}>[ GPS ]</div>
              <div style={{ fontWeight:800,fontSize:16,marginBottom:6 }}>Iniciar Orden de Servicio</div>
              <div style={{ fontSize:13,color:C.muted,marginBottom:16,lineHeight:1.5 }}>
                Al iniciar se registrara tu ubicacion GPS y comenzara el cronometro del servicio.
              </div>
              <div style={{ border:`2px dashed ${C.border}`,borderRadius:10,padding:16,marginBottom:16,background:C.bg }}>
                <div style={{ fontSize:28,marginBottom:6 }}>[ FOTO ]</div>
                <div style={{ fontSize:12,color:C.muted,marginBottom:8 }}>Foto de fachada del inmueble (obligatoria a futuro)</div>
                <div style={{ display:"inline-block",padding:"8px 16px",borderRadius:8,
                  background:C.card,border:`1px solid ${C.border}`,
                  fontSize:12,color:C.muted,cursor:"not-allowed",opacity:0.6 }}>
                  Capturar foto (proximamente)
                </div>
              </div>
              <Btn onClick={iniciarOrden} style={{ width:"100%",padding:14,fontSize:15 }}>
                INICIAR SERVICIO + GPS
              </Btn>
            </div>
          </Card>
        )}

        {/* PASO 2: Inspeccion de piezas */}
        {pasoServicio === 2 && (
          <div>
            <Card style={{ marginBottom:14 }}>
              <div style={{ fontWeight:700,fontSize:13,color:C.muted,marginBottom:12 }}>
                INSPECCION DE PIEZAS
              </div>
              <div style={{ fontSize:12,color:C.muted,marginBottom:14 }}>
                Verifica cada pieza de la referencia <strong>{ordenSel.referencia_nombre}</strong>.
                Marca el estado de cada una antes de comenzar el montaje.
              </div>
              {inspeccion.map((p,i) => (
                <div key={i} style={{ padding:"12px 14px",marginBottom:8,borderRadius:10,
                  background: p.estado==="ok"?"#06D6A010":p.estado==="averiada"?"#F59E0B10":"#EF444410",
                  border:`1px solid ${p.estado==="ok"?"#06D6A040":p.estado==="averiada"?"#F59E0B40":"#EF444440"}` }}>
                  <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:8 }}>
                    <div style={{ width:28,height:28,borderRadius:"50%",background:C.accent+"20",
                      display:"flex",alignItems:"center",justifyContent:"center",
                      fontWeight:800,fontSize:11,color:C.accent,flexShrink:0 }}>{i+1}</div>
                    <div style={{ fontWeight:700,flex:1 }}>{p.nombre_pieza}</div>
                    <div style={{ display:"flex",gap:6 }}>
                      {[["ok","OK","#06D6A0"],["averiada","Averiada","#F59E0B"],["faltante","Faltante","#EF4444"]].map(([v,l,c])=>(
                        <div key={v} onClick={()=>setInspeccion(prev=>prev.map((x,idx)=>idx===i?{...x,estado:v}:x))}
                          style={{ padding:"4px 10px",borderRadius:20,cursor:"pointer",fontSize:11,fontWeight:700,
                            background:p.estado===v?c+"30":C.bg,color:p.estado===v?c:C.muted,
                            border:`1px solid ${p.estado===v?c:C.border}` }}>{l}</div>
                      ))}
                    </div>
                  </div>
                  {p.estado !== "ok" && (
                    <div>
                      <input value={p.novedad_descripcion}
                        onChange={e=>setInspeccion(prev=>prev.map((x,idx)=>idx===i?{...x,novedad_descripcion:e.target.value}:x))}
                        placeholder="Describe el problema..."
                        style={{ width:"100%",padding:"7px 10px",border:`1px solid ${C.border}`,borderRadius:6,fontSize:12,marginBottom:6 }} />
                      <select value={p.accion_solicitada}
                        onChange={e=>setInspeccion(prev=>prev.map((x,idx)=>idx===i?{...x,accion_solicitada:e.target.value}:x))}
                        style={{ padding:"7px 10px",border:`1px solid ${C.border}`,borderRadius:6,fontSize:12,background:"white" }}>
                        <option value="ninguna">Sin accion requerida</option>
                        <option value="cambio">Solicitar cambio</option>
                        <option value="garantia">Solicitar garantia al proveedor</option>
                      </select>
                    </div>
                  )}
                </div>
              ))}
              {inspeccion.length === 0 && (
                <div style={{ textAlign:"center",padding:20,color:C.muted }}>
                  Esta referencia no tiene piezas registradas
                </div>
              )}
              <Btn onClick={guardarInspeccion} style={{ width:"100%",marginTop:8,padding:12 }}>
                GUARDAR INSPECCION
              </Btn>
            </Card>
          </div>
        )}

        {/* PASO 3: Novedades + avanzar */}
        {pasoServicio === 3 && (
          <Card style={{ marginBottom:14 }}>
            <div style={{ fontWeight:700,fontSize:13,color:C.muted,marginBottom:12 }}>NOVEDADES REGISTRADAS</div>
            {novedades.map((n,i)=>(
              <div key={i} style={{ padding:"10px 12px",marginBottom:8,borderRadius:8,
                background: n.tipo==="averia"?"#F59E0B10":n.tipo==="faltante"?"#EF444410":"#00B4D810",
                border:`1px solid ${n.tipo==="averia"?"#F59E0B40":n.tipo==="faltante"?"#EF444440":"#00B4D840"}` }}>
                <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                  <span style={{ fontSize:11,fontWeight:700,
                    color:n.tipo==="averia"?"#F59E0B":n.tipo==="faltante"?"#EF4444":"#00B4D8",
                    textTransform:"uppercase" }}>{n.tipo}</span>
                  <span style={{ fontSize:10,color:C.muted }}>{n.accion}</span>
                </div>
                <div style={{ fontSize:13 }}>{n.descripcion}</div>
              </div>
            ))}
            {novedades.length===0 && (
              <div style={{ textAlign:"center",padding:16,color:C.muted,fontSize:13 }}>
                Sin novedades adicionales registradas
              </div>
            )}
            {showNovedad && (
              <div style={{ padding:"14px",background:C.bg,borderRadius:10,border:`1px solid ${C.border}`,marginBottom:12 }}>
                <div style={{ fontWeight:700,fontSize:12,color:C.muted,marginBottom:10 }}>NUEVA NOVEDAD</div>
                <select value={formNovedad.tipo} onChange={e=>setFormNovedad(f=>({...f,tipo:e.target.value}))}
                  style={{ width:"100%",padding:"8px 10px",border:`1px solid ${C.border}`,borderRadius:6,fontSize:12,marginBottom:8,background:"white" }}>
                  <option value="averia">Averia / Dano</option>
                  <option value="faltante">Pieza Faltante</option>
                  <option value="otro">Otro</option>
                </select>
                <textarea value={formNovedad.descripcion} onChange={e=>setFormNovedad(f=>({...f,descripcion:e.target.value}))}
                  placeholder="Describe la novedad en detalle..."
                  style={{ width:"100%",minHeight:70,padding:"8px 10px",border:`1px solid ${C.border}`,
                    borderRadius:6,fontSize:12,fontFamily:"inherit",resize:"vertical",marginBottom:8 }}/>
                <select value={formNovedad.accion} onChange={e=>setFormNovedad(f=>({...f,accion:e.target.value}))}
                  style={{ width:"100%",padding:"8px 10px",border:`1px solid ${C.border}`,borderRadius:6,fontSize:12,marginBottom:10,background:"white" }}>
                  <option value="cambio">Solicitar cambio de pieza</option>
                  <option value="garantia">Solicitar garantia al proveedor</option>
                  <option value="informativo">Solo informativo</option>
                </select>
                <div style={{ border:`2px dashed ${C.border}`,borderRadius:8,padding:12,textAlign:"center",marginBottom:10,background:"white" }}>
                  <div style={{ fontSize:24,marginBottom:4 }}>[ FOTO ]</div>
                  <div style={{ fontSize:11,color:C.muted }}>Foto evidencia (proximamente)</div>
                </div>
                <div style={{ display:"flex",gap:8 }}>
                  <Btn onClick={guardarNovedad} style={{ flex:1 }}>GUARDAR</Btn>
                  <Btn variant="ghost" onClick={()=>setShowNovedad(false)} style={{ color:C.danger }}>CANCELAR</Btn>
                </div>
              </div>
            )}
            {!showNovedad && (
              <Btn variant="ghost" onClick={()=>setShowNovedad(true)} style={{ width:"100%",marginBottom:10 }}>
                + AGREGAR NOVEDAD
              </Btn>
            )}
            <Btn onClick={avanzarEjecucion} style={{ width:"100%",padding:12 }}>
              INICIAR EJECUCION
            </Btn>
          </Card>
        )}

        {/* PASO 4: Ejecucion */}
        {pasoServicio === 4 && (
          <Card>
            <div style={{ textAlign:"center",padding:"8px 0 14px" }}>
              <div style={{ fontSize:32,marginBottom:8 }}>[ TOOLS ]</div>
              <div style={{ fontWeight:800,fontSize:16,marginBottom:6 }}>En Ejecucion</div>
              <div style={{ fontSize:13,color:C.muted,marginBottom:16 }}>
                Servicio en progreso. Al terminar registra la foto del resultado final y cierra la orden.
              </div>
              <div style={{ border:`2px dashed ${C.border}`,borderRadius:10,padding:16,marginBottom:16,background:C.bg }}>
                <div style={{ fontSize:28,marginBottom:6 }}>[ FOTO FINAL ]</div>
                <div style={{ fontSize:12,color:C.muted,marginBottom:8 }}>Foto del producto instalado (obligatoria a futuro)</div>
                <div style={{ display:"inline-block",padding:"8px 16px",borderRadius:8,
                  background:C.card,border:`1px solid ${C.border}`,
                  fontSize:12,color:C.muted,cursor:"not-allowed",opacity:0.6 }}>
                  Capturar foto (proximamente)
                </div>
              </div>
              <Btn onClick={()=>setPasoServicio(5)} style={{ width:"100%",padding:12 }}>
                FINALIZAR - IR A CIERRE
              </Btn>
            </div>
          </Card>
        )}

        {/* PASO 5: Cierre y firma */}
        {pasoServicio === 5 && (
          <Card>
            <div style={{ fontWeight:700,fontSize:13,color:C.muted,marginBottom:16 }}>CIERRE DEL SERVICIO</div>
            <div style={{ padding:"12px 14px",background:"#06D6A010",borderRadius:8,
              border:"1px solid #06D6A040",marginBottom:14 }}>
              <div style={{ fontSize:11,color:C.muted,marginBottom:4 }}>RESUMEN</div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
                <div><div style={{ fontSize:9,color:C.muted }}>CLIENTE</div><div style={{ fontWeight:700 }}>{ordenSel.cliente_nombre}</div></div>
                <div><div style={{ fontSize:9,color:C.muted }}>TIPO</div><div style={{ fontWeight:700,textTransform:"capitalize" }}>{ordenSel.tipo_servicio}</div></div>
                <div><div style={{ fontSize:9,color:C.muted }}>REFERENCIA</div><div style={{ fontWeight:700 }}>{ordenSel.referencia_nombre}</div></div>
                <div><div style={{ fontSize:9,color:C.muted }}>NOVEDADES</div><div style={{ fontWeight:700 }}>{novedades.length}</div></div>
              </div>
            </div>

            {/* Firma digital placeholder */}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:12,fontWeight:700,color:C.muted,marginBottom:8 }}>FIRMA DEL CLIENTE</div>
              <div style={{ border:`2px dashed ${C.border}`,borderRadius:10,padding:30,
                textAlign:"center",background:C.bg,minHeight:120,
                display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center" }}>
                <div style={{ fontSize:28,marginBottom:6 }}>[ FIRMA ]</div>
                <div style={{ fontSize:12,color:C.muted }}>Firma digital del cliente (proximamente)</div>
              </div>
            </div>

            <Btn onClick={cerrarOrden} style={{ width:"100%",padding:14,background:"#06D6A0",fontSize:15 }}>
              CERRAR SERVICIO
            </Btn>
          </Card>
        )}
      </div>
    </div>
  );

  // ---- VISTA CREAR ORDEN ----
  if (vista === "nueva") return (
    <div>
      {toast && <Toast {...toast} onClose={()=>setToast(null)} />}
      <PageHeader title="Nueva Orden de Servicio" onBack={()=>setVista("lista")} />
      <div style={{ maxWidth:580 }}>
        <Card style={{ marginBottom:14 }}>
          <div style={{ fontWeight:700,fontSize:13,color:C.muted,marginBottom:12 }}>REFERENCIA Y TIPO</div>
          <Sel label="REFERENCIA *" value={String(formOrden.referencia_id)} onChange={v=>setFormOrden(f=>({...f,referencia_id:v}))}
            options={[{value:"",label:"Selecciona una referencia..."}, ...refs.map(r=>({value:String(r.id),label:`${r.codigo} - ${r.nombre} (${r.categoria})`}))]} />
          {refSel && (
            <div style={{ padding:"10px 12px",background:C.bg,borderRadius:8,
              border:`1px solid ${C.border}`,marginTop:4,marginBottom:8 }}>
              <div style={{ fontSize:11,color:C.muted }}>
                {refSel.total_piezas} piezas - Tiempo est. {refSel.tiempo_estimado_min} min - {refSel.marca} {refSel.modelo}
              </div>
            </div>
          )}
          <Sel label="TIPO DE SERVICIO *" value={formOrden.tipo_servicio} onChange={v=>setFormOrden(f=>({...f,tipo_servicio:v}))}
            options={[{value:"montaje",label:"Montaje"},{value:"desmontaje",label:"Desmontaje"},{value:"ambos",label:"Montaje y Desmontaje"}]} />
          <Sel label="TECNICO ASIGNADO" value={String(formOrden.tecnico_id)} onChange={v=>setFormOrden(f=>({...f,tecnico_id:v}))}
            options={[{value:"",label:"Sin asignar"}, ...personal.filter(p=>p.rol==="tecnico").map(p=>({value:String(p.id),label:p.nombre}))]} />
          <Input label="FECHA PROGRAMADA" value={formOrden.fecha_programada} onChange={v=>setFormOrden(f=>({...f,fecha_programada:v}))} type="date" />
        </Card>

        <Card style={{ marginBottom:14 }}>
          <div style={{ fontWeight:700,fontSize:13,color:C.muted,marginBottom:12 }}>DATOS DEL CLIENTE</div>
          <Input label="NOMBRE CLIENTE *" value={formOrden.cliente_nombre} onChange={v=>setFormOrden(f=>({...f,cliente_nombre:v}))} />
          <Input label="DIRECCION *" value={formOrden.cliente_direccion} onChange={v=>setFormOrden(f=>({...f,cliente_direccion:v}))} placeholder="Calle, barrio, ciudad..." />
          <Input label="TELEFONO" value={formOrden.cliente_telefono} onChange={v=>setFormOrden(f=>({...f,cliente_telefono:v}))} />
          <Input label="N. FACTURA / PEDIDO" value={formOrden.num_factura} onChange={v=>setFormOrden(f=>({...f,num_factura:v}))} />
          <div style={{ marginTop:8 }}>
            <label style={{ fontSize:11,fontWeight:600,color:C.muted,display:"block",marginBottom:4 }}>OBSERVACIONES</label>
            <textarea value={formOrden.observaciones} onChange={e=>setFormOrden(f=>({...f,observaciones:e.target.value}))}
              placeholder="Instrucciones especiales, acceso, etc..."
              style={{ width:"100%",minHeight:70,padding:"10px 12px",border:`1px solid ${C.border}`,
                borderRadius:8,fontSize:13,fontFamily:"inherit",resize:"vertical",background:C.bg }} />
          </div>
        </Card>

        <Btn onClick={crearOrden} style={{ width:"100%",padding:14 }}>CREAR ORDEN DE SERVICIO</Btn>
      </div>
    </div>
  );

  // ---- VISTA LISTA ----
  const kpis = [
    { label:"PENDIENTES", val:ordenes.filter(o=>o.estado==="pendiente").length, color:"#94A3B8" },
    { label:"EN CURSO",   val:ordenes.filter(o=>["en_curso","inspeccion","ejecucion"].includes(o.estado)).length, color:"#F59E0B" },
    { label:"CERRADAS",   val:ordenes.filter(o=>o.estado==="cerrada").length, color:"#06D6A0" },
    { label:"TOTAL",      val:ordenes.length, color:C.accent },
  ];

  return (
    <div>
      {toast && <Toast {...toast} onClose={()=>setToast(null)} />}
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16 }}>
        <div>
          <h2 style={{ margin:0,fontSize:22,fontWeight:800 }}>Ordenes de Servicio</h2>
          <p style={{ margin:0,fontSize:13,color:C.muted }}>{ordFiltradas.length} orden(es)</p>
        </div>
        <Btn onClick={()=>{ setFormOrden({referencia_id:"",tecnico_id:"",tipo_servicio:"montaje",cliente_nombre:"",cliente_direccion:"",cliente_telefono:"",num_factura:"",observaciones:"",fecha_programada:""}); setVista("nueva"); }}>
          + NUEVA ORDEN
        </Btn>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16 }}>
        {kpis.map(k=>(
          <div key={k.label} style={{ padding:"12px 14px",borderRadius:10,
            background:k.color+"10",border:`1px solid ${k.color}30` }}>
            <div style={{ fontSize:24,fontWeight:900,color:k.color }}>{k.val}</div>
            <div style={{ fontSize:10,fontWeight:700,color:k.color }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros estado */}
      <div style={{ display:"flex",gap:8,marginBottom:16,flexWrap:"wrap" }}>
        <div onClick={()=>setFiltroEstado("")}
          style={{ padding:"6px 14px",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:700,
            background:filtroEstado===""?C.dark:C.bg,color:filtroEstado===""?"#fff":C.muted,
            border:`1px solid ${filtroEstado===""?C.dark:C.border}` }}>Todos</div>
        {Object.entries(ESTADO_ORDEN).map(([k,v])=>(
          <div key={k} onClick={()=>setFiltroEstado(k)}
            style={{ padding:"6px 14px",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:700,
              background:filtroEstado===k?v.color:C.bg,color:filtroEstado===k?"#fff":C.muted,
              border:`1px solid ${filtroEstado===k?v.color:C.border}` }}>{v.label}</div>
        ))}
      </div>

      {/* Lista ordenes */}
      {loading ? (
        <div style={{ textAlign:"center",padding:40,color:C.muted }}>Cargando...</div>
      ) : (
        <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
          {ordFiltradas.map((ord,i) => {
            const est = ESTADO_ORDEN[ord.estado] || ESTADO_ORDEN.pendiente;
            return (
              <Card key={i} onClick={()=>abrirOrden(ord)}
                style={{ cursor:"pointer",borderLeft:`4px solid ${est.color}` }}>
                <div style={{ display:"flex",alignItems:"flex-start",gap:12 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:4 }}>
                      <span style={{ fontWeight:900,fontSize:15 }}>{ord.consecutivo}</span>
                      <span style={{ padding:"2px 8px",borderRadius:10,fontSize:10,fontWeight:700,
                        background:est.bg,color:est.color }}>{est.label}</span>
                      <span style={{ padding:"2px 8px",borderRadius:10,fontSize:10,
                        background:C.bg,border:`1px solid ${C.border}`,color:C.muted,textTransform:"capitalize" }}>
                        {ord.tipo_servicio}
                      </span>
                    </div>
                    <div style={{ fontWeight:700,fontSize:13 }}>{ord.cliente_nombre}</div>
                    <div style={{ fontSize:12,color:C.muted }}>{ord.cliente_direccion}</div>
                    <div style={{ fontSize:11,color:C.accent,fontWeight:600,marginTop:2 }}>
                      {ord.referencia_nombre} {ord.num_factura?`| Fac: ${ord.num_factura}`:""}
                    </div>
                  </div>
                  <div style={{ textAlign:"right",flexShrink:0 }}>
                    {ord.tecnico_nombre && (
                      <div style={{ fontSize:11,color:C.muted,marginBottom:4 }}>{ord.tecnico_nombre}</div>
                    )}
                    {ord.duracion_min && (
                      <div style={{ fontSize:11,fontWeight:700,color:"#06D6A0" }}>
                        {Math.floor(ord.duracion_min/60)}h {Math.round(ord.duracion_min%60)}m
                      </div>
                    )}
                    <div style={{ fontSize:10,color:C.muted,marginTop:4 }}>
                      {ord.fecha_programada||new Date(ord.fecha_creacion).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
          {ordFiltradas.length===0 && (
            <div style={{ textAlign:"center",padding:40,color:C.muted }}>
              <div style={{ fontSize:36,marginBottom:10 }}>[ OS ]</div>
              <div>No hay ordenes {filtroEstado?`en estado "${ESTADO_ORDEN[filtroEstado]?.label}"`:""}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};


const Referencias = ({ onBack }) => {
  const [vista, setVista]     = useState("lista");
  const [lista, setLista]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast]     = useState(null);
  const [refSel, setRefSel]   = useState(null);
  const [filtroCat, setFiltroCat] = useState("");
  const [piezas, setPiezas]   = useState([{ nombre:"", cantidad:1, unidad:"und", descripcion:"" }]);
  const [form, setForm]       = useState({
    codigo:"", nombre:"", categoria:"muebles", descripcion:"",
    tiempo_estimado_min:60, marca:"", modelo:"", activo:true
  });

  const cargar = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/referencias`);
      const d = await r.json();
      setLista(Array.isArray(d) ? d : []);
    } catch { setLista([]); }
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const addPieza = () => setPiezas(p => [...p, { nombre:"", cantidad:1, unidad:"und", descripcion:"" }]);
  const delPieza = (i) => setPiezas(p => p.filter((_,idx) => idx !== i));
  const updPieza = (i, field, val) => setPiezas(p => p.map((x,idx) => idx===i ? {...x,[field]:val} : x));

  const guardar = async () => {
    if (!form.nombre || !form.codigo) { setToast({ msg:"Codigo y nombre son obligatorios", type:"error" }); return; }
    if (piezas.some(p => !p.nombre)) { setToast({ msg:"Todas las piezas deben tener nombre", type:"error" }); return; }
    try {
      const url = refSel ? `${API_URL}/referencias/${refSel.id}` : `${API_URL}/referencias`;
      const method = refSel ? "PUT" : "POST";
      const res = await fetch(url, {
        method, headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ ...form, piezas })
      });
      if (res.ok) {
        setToast({ msg: refSel ? "Referencia actualizada" : "Referencia creada exitosamente", type:"success" });
        setTimeout(() => { setVista("lista"); setRefSel(null); cargar(); }, 1400);
      } else {
        const e = await res.json();
        setToast({ msg: e.detail || "Error al guardar", type:"error" });
      }
    } catch { setToast({ msg:"Error de conexion", type:"error" }); }
  };

  const abrirEdicion = (ref) => {
    setRefSel(ref);
    setForm({
      codigo: ref.codigo, nombre: ref.nombre, categoria: ref.categoria,
      descripcion: ref.descripcion, tiempo_estimado_min: ref.tiempo_estimado_min,
      marca: ref.marca, modelo: ref.modelo, activo: ref.activo
    });
    setPiezas(ref.piezas?.length > 0 ? ref.piezas.map(p=>({nombre:p.nombre,cantidad:p.cantidad,unidad:p.unidad,descripcion:p.descripcion})) : [{ nombre:"", cantidad:1, unidad:"und", descripcion:"" }]);
    setVista("form");
  };

  const listFiltrada = filtroCat ? lista.filter(r=>r.categoria===filtroCat) : lista;
  const catInfo = (id) => CATEGORIAS_REF.find(c=>c.id===id) || { label:id, icon:"??" };
  const catColores = { muebles:"#06D6A0",closets:"#00B4D8",escritorios:"#F59E0B",cocinas:"#EF4444",bibliotecas:"#8B5CF6",camas:"#EC4899",salas:"#14B8A6",oficina:"#F97316",otro:"#94A3B8" };

  // ---- VISTA DETALLE ----
  if (vista === "detalle" && refSel) return (
    <div>
      {toast && <Toast {...toast} onClose={()=>setToast(null)} />}
      <PageHeader title="Detalle Referencia" onBack={()=>{ setVista("lista"); setRefSel(null); }} />
      <div style={{ maxWidth:640 }}>
        <Card style={{ marginBottom:14 }}>
          <div style={{ display:"flex", alignItems:"flex-start", gap:14, marginBottom:16 }}>
            <div style={{ width:56,height:56,borderRadius:12,flexShrink:0,
              background:(catColores[refSel.categoria]||C.accent)+"20",
              border:`2px solid ${catColores[refSel.categoria]||C.accent}`,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontWeight:900,fontSize:13,color:catColores[refSel.categoria]||C.accent }}>
              {catInfo(refSel.categoria).icon}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11,fontWeight:700,color:catColores[refSel.categoria]||C.accent }}>
                {catInfo(refSel.categoria).label} - {refSel.codigo}
              </div>
              <div style={{ fontSize:20,fontWeight:900,marginBottom:2 }}>{refSel.nombre}</div>
              <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                {refSel.marca && <span style={{ fontSize:11,color:C.muted }}>{refSel.marca}</span>}
                {refSel.modelo && <span style={{ fontSize:11,color:C.muted }}>/ {refSel.modelo}</span>}
                <span style={{ padding:"2px 8px",borderRadius:10,fontSize:10,fontWeight:700,
                  background:refSel.activo?"#06D6A015":"#EF444415",
                  color:refSel.activo?"#06D6A0":"#EF4444" }}>{refSel.activo?"ACTIVO":"INACTIVO"}</span>
              </div>
            </div>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14 }}>
            <div style={{ padding:"10px 14px",background:C.bg,borderRadius:8,border:`1px solid ${C.border}` }}>
              <div style={{ fontSize:10,fontWeight:700,color:C.muted }}>TIEMPO ESTIMADO</div>
              <div style={{ fontSize:16,fontWeight:800 }}>{refSel.tiempo_estimado_min} min</div>
            </div>
            <div style={{ padding:"10px 14px",background:C.bg,borderRadius:8,border:`1px solid ${C.border}` }}>
              <div style={{ fontSize:10,fontWeight:700,color:C.muted }}>TOTAL PIEZAS</div>
              <div style={{ fontSize:16,fontWeight:800 }}>{refSel.piezas?.length || 0} items</div>
            </div>
          </div>
          {refSel.descripcion && (
            <div style={{ padding:"10px 14px",background:"#F59E0B10",borderRadius:8,border:"1px solid #F59E0B30",marginBottom:14 }}>
              <div style={{ fontSize:10,fontWeight:700,color:"#F59E0B",marginBottom:4 }}>DESCRIPCION</div>
              <div style={{ fontSize:13 }}>{refSel.descripcion}</div>
            </div>
          )}
        </Card>

        {/* Lista de piezas */}
        <Card>
          <div style={{ fontWeight:700,fontSize:13,color:C.muted,marginBottom:12 }}>
            LISTA DE PIEZAS ({refSel.piezas?.length || 0})
          </div>
          {refSel.piezas?.map((p,i) => (
            <div key={i} style={{ display:"flex",alignItems:"center",gap:10,
              padding:"10px 12px",marginBottom:8,background:C.bg,
              borderRadius:8,border:`1px solid ${C.border}` }}>
              <div style={{ width:28,height:28,borderRadius:"50%",flexShrink:0,
                background:(catColores[refSel.categoria]||C.accent)+"20",
                display:"flex",alignItems:"center",justifyContent:"center",
                fontWeight:800,fontSize:12,color:catColores[refSel.categoria]||C.accent }}>
                {i+1}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700,fontSize:13 }}>{p.nombre}</div>
                {p.descripcion && <div style={{ fontSize:11,color:C.muted }}>{p.descripcion}</div>}
              </div>
              <div style={{ textAlign:"right",flexShrink:0 }}>
                <div style={{ fontWeight:800,fontSize:14 }}>{p.cantidad}</div>
                <div style={{ fontSize:10,color:C.muted }}>{p.unidad}</div>
              </div>
            </div>
          ))}
          {(!refSel.piezas || refSel.piezas.length===0) && (
            <div style={{ textAlign:"center",padding:20,color:C.muted,fontSize:13 }}>Sin piezas registradas</div>
          )}
          <div style={{ display:"flex",gap:10,marginTop:14 }}>
            <Btn onClick={()=>abrirEdicion(refSel)} style={{ flex:1 }}>EDITAR</Btn>
          </div>
        </Card>
      </div>
    </div>
  );

  // ---- VISTA FORM ----
  if (vista === "form") return (
    <div>
      {toast && <Toast {...toast} onClose={()=>setToast(null)} />}
      <PageHeader title={refSel?"Editar Referencia":"Nueva Referencia"}
        onBack={()=>{ setVista("lista"); setRefSel(null); }} />
      <div style={{ maxWidth:680 }}>

        {/* Datos basicos */}
        <Card style={{ marginBottom:14 }}>
          <div style={{ fontWeight:700,fontSize:13,color:C.muted,marginBottom:12 }}>IDENTIFICACION</div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
            <Input label="CODIGO *" value={form.codigo} onChange={v=>setForm(f=>({...f,codigo:v.toUpperCase()}))} placeholder="Ej: MU-001" />
            <Input label="NOMBRE *" value={form.nombre} onChange={v=>setForm(f=>({...f,nombre:v}))} placeholder="Ej: Closet 3 puertas" />
            <Sel label="CATEGORIA" value={form.categoria} onChange={v=>setForm(f=>({...f,categoria:v}))}
              options={CATEGORIAS_REF.map(c=>({value:c.id,label:c.label}))} />
            <Input label="TIEMPO ESTIMADO (min)" value={String(form.tiempo_estimado_min)}
              onChange={v=>setForm(f=>({...f,tiempo_estimado_min:parseInt(v)||60}))} />
            <Input label="MARCA" value={form.marca} onChange={v=>setForm(f=>({...f,marca:v}))} />
            <Input label="MODELO / REFERENCIA" value={form.modelo} onChange={v=>setForm(f=>({...f,modelo:v}))} />
          </div>
          <div style={{ marginTop:12 }}>
            <label style={{ fontSize:11,fontWeight:600,color:C.muted,display:"block",marginBottom:4 }}>DESCRIPCION</label>
            <textarea value={form.descripcion} onChange={e=>setForm(f=>({...f,descripcion:e.target.value}))}
              placeholder="Descripcion del producto, materiales, caracteristicas..."
              style={{ width:"100%",minHeight:70,padding:"10px 12px",border:`1px solid ${C.border}`,
                borderRadius:8,fontSize:13,fontFamily:"inherit",resize:"vertical",background:C.bg }} />
          </div>
          <div style={{ marginTop:12,display:"flex",alignItems:"center",gap:10 }}>
            <input type="checkbox" id="activo" checked={form.activo} onChange={e=>setForm(f=>({...f,activo:e.target.checked}))} />
            <label htmlFor="activo" style={{ fontSize:13,fontWeight:600 }}>Referencia activa</label>
          </div>
        </Card>

        {/* Foto placeholder */}
        <Card style={{ marginBottom:14 }}>
          <div style={{ fontWeight:700,fontSize:13,color:C.muted,marginBottom:12 }}>FOTO DE REFERENCIA</div>
          <div style={{ border:`2px dashed ${C.border}`,borderRadius:10,padding:20,
            textAlign:"center",background:C.bg }}>
            <div style={{ fontSize:28,marginBottom:6 }}>[ FOTO ]</div>
            <div style={{ fontSize:12,color:C.muted,marginBottom:10 }}>Foto del producto armado (funcion proxima)</div>
            <div style={{ display:"inline-block",padding:"8px 16px",borderRadius:8,
              background:C.card,border:`1px solid ${C.border}`,
              fontSize:12,color:C.muted,cursor:"not-allowed",opacity:0.6 }}>
              Cargar foto (proximamente)
            </div>
          </div>
        </Card>

        {/* Lista de piezas */}
        <Card style={{ marginBottom:14 }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
            <div style={{ fontWeight:700,fontSize:13,color:C.muted }}>
              LISTA DE PIEZAS ({piezas.length})
            </div>
            <Btn onClick={addPieza} variant="ghost" style={{ fontSize:11 }}>+ AGREGAR PIEZA</Btn>
          </div>

          {/* Header */}
          <div style={{ display:"grid",gridTemplateColumns:"32px 1fr 80px 70px 120px 32px",
            gap:8,padding:"6px 8px",marginBottom:4 }}>
            {["#","NOMBRE PIEZA","CANT.","UNIDAD","DESCRIPCION",""].map((h,i)=>(
              <div key={i} style={{ fontSize:10,fontWeight:700,color:C.muted }}>{h}</div>
            ))}
          </div>

          {piezas.map((p,i) => (
            <div key={i} style={{ display:"grid",gridTemplateColumns:"32px 1fr 80px 70px 120px 32px",
              gap:8,alignItems:"center",marginBottom:8,
              padding:"6px 8px",background:C.bg,borderRadius:8,border:`1px solid ${C.border}` }}>
              <div style={{ width:28,height:28,borderRadius:"50%",
                background:(catColores[form.categoria]||C.accent)+"20",
                display:"flex",alignItems:"center",justifyContent:"center",
                fontWeight:800,fontSize:11,color:catColores[form.categoria]||C.accent }}>
                {i+1}
              </div>
              <input value={p.nombre} onChange={e=>updPieza(i,"nombre",e.target.value)}
                placeholder="Nombre de la pieza..."
                style={{ padding:"7px 10px",border:`1px solid ${C.border}`,borderRadius:6,
                  fontSize:12,background:"white",width:"100%" }} />
              <input type="number" min="1" value={p.cantidad} onChange={e=>updPieza(i,"cantidad",parseInt(e.target.value)||1)}
                style={{ padding:"7px 10px",border:`1px solid ${C.border}`,borderRadius:6,
                  fontSize:12,textAlign:"center",background:"white" }} />
              <select value={p.unidad} onChange={e=>updPieza(i,"unidad",e.target.value)}
                style={{ padding:"7px 6px",border:`1px solid ${C.border}`,borderRadius:6,
                  fontSize:11,background:"white" }}>
                {["und","pza","par","set","mts","kg"].map(u=><option key={u}>{u}</option>)}
              </select>
              <input value={p.descripcion} onChange={e=>updPieza(i,"descripcion",e.target.value)}
                placeholder="Nota opcional..."
                style={{ padding:"7px 10px",border:`1px solid ${C.border}`,borderRadius:6,
                  fontSize:11,background:"white",width:"100%" }} />
              <div onClick={()=>delPieza(i)}
                style={{ width:28,height:28,borderRadius:"50%",background:"#EF444415",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  cursor:"pointer",color:"#EF4444",fontSize:14,fontWeight:700 }}>x</div>
            </div>
          ))}

          <div onClick={addPieza}
            style={{ border:`2px dashed ${C.border}`,borderRadius:8,padding:10,
              textAlign:"center",cursor:"pointer",color:C.muted,fontSize:12,marginTop:4 }}>
            + Agregar otra pieza
          </div>
        </Card>

        <Btn onClick={guardar} style={{ width:"100%",padding:14 }}>
          {refSel ? "GUARDAR CAMBIOS" : "CREAR REFERENCIA"}
        </Btn>
      </div>
    </div>
  );

  // ---- VISTA LISTA ----
  return (
    <div>
      {toast && <Toast {...toast} onClose={()=>setToast(null)} />}
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16 }}>
        <div>
          <h2 style={{ margin:0,fontSize:22,fontWeight:800 }}>Maestro de Referencias</h2>
          <p style={{ margin:0,fontSize:13,color:C.muted }}>{listFiltrada.length} referencia(s) registrada(s)</p>
        </div>
        <Btn onClick={()=>{ setRefSel(null); setForm({codigo:"",nombre:"",categoria:"muebles",descripcion:"",tiempo_estimado_min:60,marca:"",modelo:"",activo:true}); setPiezas([{nombre:"",cantidad:1,unidad:"und",descripcion:""}]); setVista("form"); }}>
          + NUEVA REFERENCIA
        </Btn>
      </div>

      {/* Filtros categoria */}
      <div style={{ display:"flex",gap:8,marginBottom:18,flexWrap:"wrap" }}>
        <div onClick={()=>setFiltroCat("")} style={{ padding:"6px 14px",borderRadius:20,cursor:"pointer",
          fontSize:12,fontWeight:700,
          background:filtroCat===""?C.accent:C.bg,
          color:filtroCat===""?"#fff":C.muted,
          border:`1px solid ${filtroCat===""?C.accent:C.border}` }}>Todos</div>
        {CATEGORIAS_REF.map(cat => {
          const cnt = lista.filter(r=>r.categoria===cat.id).length;
          if (cnt === 0) return null;
          return (
            <div key={cat.id} onClick={()=>setFiltroCat(cat.id)}
              style={{ padding:"6px 14px",borderRadius:20,cursor:"pointer",
                fontSize:12,fontWeight:700,display:"flex",alignItems:"center",gap:6,
                background:filtroCat===cat.id?(catColores[cat.id]||C.accent):C.bg,
                color:filtroCat===cat.id?"#fff":C.muted,
                border:`1px solid ${filtroCat===cat.id?(catColores[cat.id]||C.accent):C.border}` }}>
              {cat.label}
              <span style={{ background:"rgba(0,0,0,0.15)",borderRadius:10,padding:"1px 6px",fontSize:10 }}>{cnt}</span>
            </div>
          );
        })}
      </div>

      {loading ? (
        <div style={{ textAlign:"center",padding:40,color:C.muted }}>Cargando...</div>
      ) : (
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:14 }}>
          {listFiltrada.map((ref,i) => (
            <Card key={i} onClick={()=>{ setRefSel(ref); setVista("detalle"); }}
              style={{ cursor:"pointer",borderLeft:`4px solid ${catColores[ref.categoria]||C.accent}` }}>
              <div style={{ display:"flex",alignItems:"flex-start",gap:12,marginBottom:10 }}>
                <div style={{ width:48,height:48,borderRadius:10,flexShrink:0,
                  background:(catColores[ref.categoria]||C.accent)+"20",
                  border:`2px solid ${catColores[ref.categoria]||C.accent}`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontWeight:900,fontSize:12,color:catColores[ref.categoria]||C.accent }}>
                  {catInfo(ref.categoria).icon}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:10,fontWeight:700,color:catColores[ref.categoria]||C.accent }}>
                    {catInfo(ref.categoria).label} - {ref.codigo}
                  </div>
                  <div style={{ fontWeight:800,fontSize:14,marginBottom:2 }}>{ref.nombre}</div>
                  {(ref.marca||ref.modelo) && (
                    <div style={{ fontSize:11,color:C.muted }}>{[ref.marca,ref.modelo].filter(Boolean).join(" / ")}</div>
                  )}
                </div>
                <span style={{ padding:"2px 8px",borderRadius:10,fontSize:10,fontWeight:700,flexShrink:0,
                  background:ref.activo?"#06D6A015":"#EF444415",
                  color:ref.activo?"#06D6A0":"#EF4444" }}>{ref.activo?"ACTIVO":"INACTIVO"}</span>
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,
                paddingTop:10,borderTop:`1px solid ${C.border}` }}>
                <div>
                  <div style={{ fontSize:9,color:C.muted,fontWeight:700 }}>PIEZAS</div>
                  <div style={{ fontSize:13,fontWeight:800 }}>{ref.total_piezas} items</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:9,color:C.muted,fontWeight:700 }}>TIEMPO EST.</div>
                  <div style={{ fontSize:13,fontWeight:800 }}>{ref.tiempo_estimado_min} min</div>
                </div>
              </div>
            </Card>
          ))}
          {listFiltrada.length === 0 && (
            <div style={{ gridColumn:"1/-1",textAlign:"center",padding:40 }}>
              <div style={{ fontSize:36,marginBottom:10 }}>[ REF ]</div>
              <div style={{ color:C.muted }}>No hay referencias registradas</div>
              <div style={{ fontSize:12,color:C.muted,marginTop:4 }}>
                {filtroCat ? "Prueba con otra categoria" : "Crea la primera referencia"}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};


const Reportes = ({ onBack }) => (
  <div>
    <PageHeader title="Reportes y KPIs" subtitle="Analisis del periodo" onBack={onBack} />
    <div style={{ display: "flex", gap: 14, marginBottom: 28, flexWrap: "wrap" }}>
      <KPI label="SERVICIOS MES"    value="84"  icon="Servicios" color={C.accent} />
      <KPI label="HORAS TRABAJADAS" value="312" icon="Horarios" color="#8B5CF6" />
      <KPI label="NOVEDADES MES"    value="7"   icon="!" color={C.danger} />
      <KPI label="EFICIENCIA"       value="94%" icon="G" color={C.success} />
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
      {[
        { titulo: "Reporte de Servicios",   color: "#00B4D8" },
        { titulo: "Control de Asistencia",  color: "#8B5CF6" },
        { titulo: "Novedades del Mes",       color: "#EF4444" },
        { titulo: "Rendimiento Tecnicos",    color: "#06D6A0" },
      ].map((r, i) => (
        <Card key={i}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, marginBottom: 14,
            background: r.color + "18", border: "1px solid " + r.color + "30",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <div style={{ width: 16, height: 16, borderRadius: "50%", background: r.color }} />
          </div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{r.titulo}</div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>PDF  Excel</div>
          <Btn variant="ghost" style={{ fontSize: 11 }}>GENERAR</Btn>
        </Card>
      ))}
    </div>
  </div>
);

// ============================================================
// APP PRINCIPAL - PUNTO DE ENTRADA
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
    <Layout
      user={user}
      onLogout={() => { setUser(null); setPage("dashboard"); }}
      activePage={page}
      onNavigate={setPage}
    >
      {pages[page] || pages.dashboard}
    </Layout>
  );
}