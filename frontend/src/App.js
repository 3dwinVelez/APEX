import { useState, useEffect, useRef } from "react";
import logo from "./assets/logo_scj.png";



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
        <KPI label="SERVICIOS HOY"     value="12" icon="Servicios" color={C.accent} />
        <KPI label="PERSONAL ACTIVO"   value="8"  icon="Personal" color="#8B5CF6" />
        <KPI label="VEHICULOS EN RUTA" value="3"  icon="Vehiculos" color={C.warning} />
        <KPI label="NOVEDADES"         value="2"  icon="!" color={C.danger} />
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
  const [vista, setVista]     = useState("lista");
  const [rolSel, setRolSel]   = useState(null);
  const [lista, setLista]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast]     = useState(null);
  const [form, setForm]       = useState({
    nombre: "", doc: "", pass: "", empresa: "Apex", costo: "", salario: "", extra: ""
  });

  const cargar = async () => {
    setLoading(true);
    try {
      const r = await fetch(API_URL + "/personal");
      const d = await r.json();
      setLista(d);
    } catch {
      setLista([
        { nombre: "Carlos Mendoza", rol: "tecnico",  id_interno: "APXTEC001", empresa: "Apex" },
        { nombre: "Laura Gomez",    rol: "empleado", id_interno: "APXEMP001" },
        { nombre: "Diego Ruiz",     rol: "tecnico",  id_interno: "APXTEC002", empresa: "Externo" },
        { nombre: "Ana Torres",     rol: "admin",    id_interno: "APXADM001" },
      ]);
    }
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const nuevoId = (() => {
    const n = String(lista.length + 1).padStart(3, "0");
    if (rolSel === "tecnico")  return "APXTEC" + n;
    if (rolSel === "empleado") return "APXEMP" + n;
    return "APXADM" + n;
  })();

  const guardar = async () => {
    if (!form.nombre) { setToast({ msg: "El nombre es obligatorio", type: "error" }); return; }
    try {
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
    } catch {}
    setToast({ msg: "Usuario creado: " + nuevoId, type: "success" });
    setTimeout(() => { setVista("lista"); cargar(); setForm({ nombre:"",doc:"",pass:"",empresa:"Apex",costo:"",salario:"",extra:"" }); }, 1400);
  };

  const rolColor = { tecnico: C.accent, empleado: C.success, admin: "#8B5CF6" };
  const rolLabel = { tecnico: "TECNICO", empleado: "EMPLEADO", admin: "ADMIN" };

  // VISTA FORMULARIO ROL ESPECIFICO
  if (vista === "form" && rolSel) return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <PageHeader title={"Nuevo " + (rolLabel[rolSel] || rolSel)} onBack={() => setVista("roles")} />
      <div style={{ maxWidth: 480 }}>
        <Card>
          <div style={{
            background: C.dark, borderRadius: 10, padding: "16px 20px",
            marginBottom: 20, textAlign: "center"
          }}>
            <div style={{ fontSize: 10, color: "#8892A4", letterSpacing: 1 }}>ID GENERADO</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: 2 }}>{nuevoId}</div>
          </div>
          <Input label="NOMBRE COMPLETO" value={form.nombre} onChange={v => setForm({ ...form, nombre: v })} />
          <Input label="DOCUMENTO"       value={form.doc}    onChange={v => setForm({ ...form, doc: v })} />
          <Input label="CONTRASENA"      value={form.pass}   onChange={v => setForm({ ...form, pass: v })} type="password" placeholder="Minimo 4 caracteres" />
          {rolSel === "tecnico" && (
            <>
              <Sel label="EMPRESA" value={form.empresa} onChange={v => setForm({ ...form, empresa: v })}
                options={[{ value: "Apex", label: "Apex" }, { value: "Externo", label: "Externo" }]} />
              <Input label="COSTO SERVICIO ($)" value={form.costo} onChange={v => setForm({ ...form, costo: v })} />
            </>
          )}
          {rolSel === "empleado" && (
            <>
              <Input label="SALARIO BASE ($)"     value={form.salario} onChange={v => setForm({ ...form, salario: v })} />
              <Input label="VALOR HORA EXTRA ($)" value={form.extra}   onChange={v => setForm({ ...form, extra: v })} />
            </>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <Btn onClick={guardar} style={{ flex: 1 }}>CREAR CUENTA</Btn>
            <Btn variant="ghost" onClick={() => setVista("roles")}>Cancelar</Btn>
          </div>
        </Card>
      </div>
    </div>
  );

  // VISTA SELECCION ROL
  if (vista === "roles") return (
    <div>
      <PageHeader title="Nuevo Usuario" subtitle="Selecciona el perfil" onBack={() => setVista("lista")} />
      <div style={{ maxWidth: 420 }}>
        {[
          { rol: "admin",    icon: "adm", label: "Administrador", desc: "Acceso total al sistema" },
          { rol: "tecnico",  icon: "tec", label: "Tecnico",       desc: "Servicios e inspecciones" },
          { rol: "empleado", icon: "usr", label: "Empleado",      desc: "Operaciones y horarios" },
        ].map(r => (
          <Card key={r.rol} onClick={() => { setRolSel(r.rol); setVista("form"); }}
            style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ fontSize: 28 }}>{r.icon}</div>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>{r.label}</div>
              <div style={{ fontSize: 12, color: C.muted }}>{r.desc}</div>
            </div>
            <div style={{ marginLeft: "auto", color: C.muted }}>&#8594;</div>
          </Card>
        ))}
      </div>
    </div>
  );

  // VISTA LISTA
  return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <PageHeader
        title="Gestion de Personal" subtitle="Colaboradores registrados"
        onBack={onBack}
        action={<Btn onClick={() => setVista("roles")}>+ NUEVO USUARIO</Btn>}
      />
      {loading ? <Spinner /> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {lista.map((p, i) => (
            <Card key={i}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: "#8B5CF618", border: "1px solid #8B5CF630",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 800, color: "#8B5CF6", letterSpacing: 0.5
                }}>{p.nombre ? p.nombre.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase() : "US"}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{p.nombre}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{p.id_interno}</div>
                </div>
                <Badge color={rolColor[p.rol] || C.muted}>
                  {(rolLabel[p.rol] || p.rol || "").toUpperCase()}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================
// MODULO VEHICULOS
// ============================================================
const Vehiculos = ({ onBack }) => {
  const [vista, setVista]     = useState("lista");
  const [lista, setLista]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast]     = useState(null);
  const [form, setForm]       = useState({ placa: "", modelo: "" });

  const cargar = async () => {
    setLoading(true);
    try {
      const r = await fetch(API_URL + "/vehiculos");
      setLista(await r.json());
    } catch {
      setLista([
        { placa: "ABC-123", modelo: "NPR 500 - 2022", estado: "disponible" },
        { placa: "XYZ-456", modelo: "NQR 700 - 2023", estado: "en ruta" },
        { placa: "DEF-789", modelo: "NKR 300 - 2021", estado: "mantenimiento" },
      ]);
    }
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const guardar = async () => {
    if (!form.placa) { setToast({ msg: "La placa es obligatoria", type: "error" }); return; }
    const placa = form.placa.toUpperCase().trim();
    try {
      await fetch(API_URL + "/vehiculos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placa, modelo: form.modelo }),
      });
    } catch {}
    setLista([...lista, { placa, modelo: form.modelo, estado: "disponible" }]);
    setToast({ msg: "Vehiculo " + placa + " registrado", type: "success" });
    setTimeout(() => { setVista("lista"); setForm({ placa: "", modelo: "" }); }, 1000);
  };

  const estadoColor = { disponible: C.success, "en ruta": C.warning, mantenimiento: C.danger };

  if (vista === "form") return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <PageHeader title="Nuevo Vehiculo" onBack={() => setVista("lista")} />
      <div style={{ maxWidth: 440 }}>
        <Card>
          <Input label="PLACA" value={form.placa} onChange={v => setForm({ ...form, placa: v })} placeholder="Ej: ABC-123" />
          <Input label="MODELO / DESCRIPCION" value={form.modelo} onChange={v => setForm({ ...form, modelo: v })} placeholder="Ej: NPR 500 - 2025" />
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <Btn onClick={guardar} style={{ flex: 1 }}>GUARDAR VEHICULO</Btn>
            <Btn variant="ghost" onClick={() => setVista("lista")}>Cancelar</Btn>
          </div>
        </Card>
      </div>
    </div>
  );

  return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <PageHeader
        title="Gestion de Vehiculos" subtitle="Flota registrada"
        onBack={onBack}
        action={<Btn onClick={() => setVista("form")}>+ REGISTRAR VEHICULO</Btn>}
      />
      {loading ? <Spinner /> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {lista.map((v, i) => (
            <Card key={i}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: "#F59E0B18", border: "1px solid #F59E0B30",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 800, color: "#F59E0B"
              }}>{v.placa ? v.placa.slice(0,3) : "VEH"}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{v.placa}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{v.modelo}</div>
                </div>
                <Badge color={estadoColor[v.estado] || C.muted}>
                  {(v.estado || "").toUpperCase()}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================
// MODULO REFERENCIAS
// ============================================================
const Referencias = ({ onBack }) => {
  const [vista, setVista] = useState("lista");
  const [lista, setLista] = useState([]);
  const [sel, setSel]     = useState(null);
  const [toast, setToast] = useState(null);
  const [checks, setChecks] = useState({});
  const [form, setForm]   = useState({ nombre: "", desc: "", costo: "", piezas: "" });

  const cargar = async () => {
    try {
      const r = await fetch(API_URL + "/referencias");
      setLista(await r.json());
    } catch {
      setLista([
        { id: 1, nombre_referencia: "Compresor Industrial",  descripcion: "Alta presion",  costo_mano_obra: 85000,  piezas_json: JSON.stringify(["Motor","Bomba","Valvula","Manometro","Filtro"]) },
        { id: 2, nombre_referencia: "Montacargas Electrico", descripcion: "Cap. 2.5 ton",  costo_mano_obra: 120000, piezas_json: JSON.stringify(["Motor traccion","Hidraulico","Bateria","Panel"]) },
        { id: 3, nombre_referencia: "Banda Transportadora",  descripcion: "Longitud 8m",   costo_mano_obra: 60000,  piezas_json: JSON.stringify(["Cinta","Rodillos","Motor","Tensores"]) },
      ]);
    }
  };

  useEffect(() => { cargar(); }, []);

  const parsePiezas = ref => {
    try { return JSON.parse(ref.piezas_json || "[]"); } catch { return []; }
  };

  const guardar = async () => {
    if (!form.nombre) { setToast({ msg: "El nombre es obligatorio", type: "error" }); return; }
    const piezas = form.piezas
      ? JSON.stringify(form.piezas.split(",").map(p => p.trim()).filter(Boolean))
      : "[]";
    try {
      await fetch(API_URL + "/referencias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre, descripcion: form.desc,
          costo: parseFloat(form.costo || 0), piezas_json: piezas
        }),
      });
    } catch {}
    setToast({ msg: "Referencia guardada", type: "success" });
    setTimeout(() => { setVista("lista"); cargar(); setForm({ nombre:"",desc:"",costo:"",piezas:"" }); }, 1000);
  };

  // DETALLE REFERENCIA
  if (sel) return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <PageHeader title={sel.nombre_referencia} subtitle="Detalle de referencia"
        onBack={() => { setSel(null); setChecks({}); }} />
      <div style={{ maxWidth: 560 }}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 4 }}>{sel.descripcion}</div>
              <div style={{ fontSize: 16, color: C.success, fontWeight: 700 }}>
                M.O: ${Number(sel.costo_mano_obra).toLocaleString()}
              </div>
            </div>
            <Badge color={C.accent}>{parsePiezas(sel).length} piezas</Badge>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1, marginBottom: 12 }}>
            COMPONENTES
          </div>
          {parsePiezas(sel).map((p, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px",
              background: checks[p] ? C.success + "08" : "#FAFBFD",
              borderRadius: 10, marginBottom: 8,
              border: "1px solid " + (checks[p] ? C.success + "30" : C.border)
            }}>
              <input
                type="checkbox" checked={!!checks[p]}
                onChange={e => setChecks({ ...checks, [p]: e.target.checked })}
                style={{ width: 18, height: 18, cursor: "pointer", accentColor: C.dark }}
              />
              <span style={{
                fontSize: 13,
                textDecoration: checks[p] ? "line-through" : "none",
                color: checks[p] ? C.muted : C.text
              }}>{p}</span>
            </div>
          ))}
          <div style={{ marginTop: 16 }}>
            <Btn variant="ghost" onClick={() => { setSel(null); setVista("form_edit"); }}>
              EDITAR REFERENCIA
            </Btn>
          </div>
        </Card>
      </div>
    </div>
  );

  // FORMULARIO NUEVA REFERENCIA
  if (vista === "form") return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <PageHeader title="Nueva Referencia" onBack={() => setVista("lista")} />
      <div style={{ maxWidth: 480 }}>
        <Card>
          <Input label="NOMBRE REFERENCIA" value={form.nombre} onChange={v => setForm({ ...form, nombre: v })} />
          <Input label="DESCRIPCION"       value={form.desc}   onChange={v => setForm({ ...form, desc: v })} />
          <Input label="COSTO M.O ($)"     value={form.costo}  onChange={v => setForm({ ...form, costo: v })} />
          <Input
            label="COMPONENTES (separados por coma)"
            value={form.piezas} onChange={v => setForm({ ...form, piezas: v })}
            placeholder="Motor, Bomba, Cable, Estructura"
          />
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <Btn onClick={guardar} style={{ flex: 1 }}>GUARDAR REFERENCIA</Btn>
            <Btn variant="ghost" onClick={() => setVista("lista")}>Cancelar</Btn>
          </div>
        </Card>
      </div>
    </div>
  );

  // LISTA
  return (
    <div>
      <PageHeader
        title="Catalogo de Referencias" subtitle="Equipos y componentes"
        onBack={onBack}
        action={<Btn onClick={() => setVista("form")}>+ AGREGAR REFERENCIA</Btn>}
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        {lista.map((r, i) => (
          <Card key={i} onClick={() => setSel(r)}>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: "#EC489918", border: "1px solid #EC489930",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
            }}>
              <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#EC4899" }} />
            </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{r.nombre_referencia}</div>
                <div style={{ fontSize: 11, color: C.success, fontWeight: 600 }}>
                  {parsePiezas(r).length} componentes - ${Number(r.costo_mano_obra).toLocaleString()}
                </div>
                <div style={{ fontSize: 10, color: C.muted }}>{r.descripcion}</div>
              </div>
              <span style={{ color: C.muted }}>&#8594;</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

// ============================================================
// MODULO SERVICIOS (con cronometro real)
// ============================================================
const Servicios = ({ onBack, user }) => {
  const [vista, setVista]       = useState("menu");
  const [equipos, setEquipos]   = useState([]);
  const [equipo, setEquipo]     = useState(null);
  const [checks, setChecks]     = useState({});
  const [novedadComp, setNovedadComp] = useState(null);
  const [tipoNov, setTipoNov]   = useState("");
  const [obsNov, setObsNov]     = useState("");
  const [iniciado, setIniciado] = useState(false);
  const [timer, setTimer]       = useState(0);
  const [novedades, setNovedades] = useState([]);
  const [toast, setToast]       = useState(null);
  const [historial, setHistorial] = useState([]);
  const timerRef                = useRef(null);

  const cargarEquipos = async () => {
    try {
      const r = await fetch(API_URL + "/referencias");
      setEquipos(await r.json());
    } catch {
      setEquipos([
        { id: 1, nombre_referencia: "Compresor Industrial",  costo_mano_obra: 85000,  piezas_json: JSON.stringify(["Motor","Bomba","Valvula","Manometro","Filtro","Correas"]) },
        { id: 2, nombre_referencia: "Montacargas Electrico", costo_mano_obra: 120000, piezas_json: JSON.stringify(["Motor traccion","Hidraulico","Bateria","Panel","Frenos"]) },
        { id: 3, nombre_referencia: "Banda Transportadora",  costo_mano_obra: 60000,  piezas_json: JSON.stringify(["Cinta","Rodillos","Motor reductor","Tensores","Estructura"]) },
      ]);
    }
  };

  useEffect(() => { cargarEquipos(); return () => clearInterval(timerRef.current); }, []);

  const iniciarTimer = () => {
    setIniciado(true);
    timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    setToast({ msg: "Inspeccion iniciada", type: "success" });
  };

  const finalizar = async () => {
    clearInterval(timerRef.current);
    try {
      await fetch(API_URL + "/ordenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tecnico_id: user?.id || 1,
          referencia_id: equipo?.id,
          tiempo_total: timer,
          novedades_json: JSON.stringify(novedades),
        }),
      });
    } catch {}
    setVista("completado");
  };

  const reportarNovedad = () => {
    if (!tipoNov) { setToast({ msg: "Selecciona el tipo de novedad", type: "error" }); return; }
    setNovedades([...novedades, { componente: novedadComp, tipo: tipoNov, obs: obsNov }]);
    setToast({ msg: "Novedad reportada: " + novedadComp, type: "warning" });
    setNovedadComp(null); setTipoNov(""); setObsNov("");
  };

  const resetServicio = () => {
    clearInterval(timerRef.current);
    setVista("menu"); setEquipo(null); setChecks({});
    setTimer(0); setIniciado(false); setNovedades([]);
  };

  const fmt = s => String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");

  const parsePiezas = eq => {
    try { return JSON.parse(eq?.piezas_json || "[]"); } catch { return []; }
  };

  // FORMULARIO NOVEDAD
  if (novedadComp) return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <PageHeader title="Reporte de Novedad" onBack={() => setNovedadComp(null)} />
      <div style={{ maxWidth: 480 }}>
        <Card>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20 }}>
            <span style={{ fontSize: 28 }}>NOV</span>
            <div>
              <div style={{ fontWeight: 700 }}>Componente: {novedadComp}</div>
              <div style={{ fontSize: 12, color: C.muted }}>Equipo: {equipo?.nombre_referencia}</div>
            </div>
          </div>
          <Sel label="TIPO DE NOVEDAD" value={tipoNov} onChange={setTipoNov} options={[
            { value: "", label: "Seleccionar..." },
            { value: "Pieza Rota / Quebrada",       label: "Pieza Rota / Quebrada" },
            { value: "Averia de Transporte",         label: "Averia de Transporte (Rayon)" },
            { value: "Defecto de Fabrica",           label: "Defecto de Fabrica" },
            { value: "Falta de Herraje",             label: "Falta de Herraje / Tornilleria" },
            { value: "Medida Incorrecta",            label: "Pieza con Medida Incorrecta" },
            { value: "Otro",                         label: "Otro (Especificar)" },
          ]} />
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1, marginBottom: 6 }}>
              OBSERVACIONES
            </div>
            <textarea
              rows={3} value={obsNov} onChange={e => setObsNov(e.target.value)}
              placeholder="Describe la novedad..."
              style={{
                width: "100%", padding: "11px 14px", borderRadius: 10, fontSize: 14,
                border: "1px solid " + C.border, background: "#FAFBFD",
                resize: "none", fontFamily: "inherit", boxSizing: "border-box"
              }}
            />
          </div>
          <div style={{
            border: "2px dashed " + C.border, borderRadius: 10, padding: 20,
            textAlign: "center", color: C.muted, fontSize: 13, cursor: "pointer", marginBottom: 14
          }}>
            CAM Adjuntar evidencia fotografica
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={reportarNovedad} variant="danger" style={{ flex: 1 }}>REPORTAR NOVEDAD</Btn>
            <Btn variant="ghost" onClick={() => setNovedadComp(null)}>Cancelar</Btn>
          </div>
        </Card>
      </div>
    </div>
  );

  // INSPECCION ACTIVA
  if (vista === "inspeccion" && equipo) return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <PageHeader
        title="Inspeccion Activa" subtitle={equipo.nombre_referencia}
        onBack={() => { resetServicio(); setVista("equipos"); }}
      />
      <div style={{ maxWidth: 560 }}>
        {iniciado && (
          <div style={{
            background: C.success + "12", border: "1px solid " + C.success + "30",
            borderRadius: 10, padding: "12px 16px", marginBottom: 20,
            display: "flex", justifyContent: "space-between", alignItems: "center"
          }}>
            <span style={{ fontSize: 13, color: C.success, fontWeight: 700 }}>Inspeccion en curso</span>
            <span style={{ fontSize: 22, color: C.dark, fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>
              Horarios {fmt(timer)}
            </span>
          </div>
        )}
        {novedades.length > 0 && (
          <div style={{
            background: C.warning + "12", border: "1px solid " + C.warning + "30",
            borderRadius: 10, padding: "10px 16px", marginBottom: 16
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.warning }}>
              ! {novedades.length} novedad(es) reportada(s)
            </div>
          </div>
        )}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{equipo.nombre_referencia}</div>
              <div style={{ fontSize: 12, color: C.success, fontWeight: 600 }}>
                M.O: ${Number(equipo.costo_mano_obra).toLocaleString()}
              </div>
            </div>
            <div style={{ fontSize: 13, color: C.muted }}>
              {Object.values(checks).filter(Boolean).length}/{parsePiezas(equipo).length} CHECK
            </div>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1, marginBottom: 12 }}>
            LISTA DE COMPONENTES
          </div>
          {parsePiezas(equipo).map((p, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 14px",
              background: checks[p] ? C.success + "08" : "#FAFBFD",
              borderRadius: 10, marginBottom: 8,
              border: "1px solid " + (checks[p] ? C.success + "30" : C.border)
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="checkbox" checked={!!checks[p]}
                  onChange={e => setChecks({ ...checks, [p]: e.target.checked })}
                  style={{ width: 18, height: 18, cursor: "pointer", accentColor: C.dark }}
                />
                <span style={{
                  fontSize: 13,
                  textDecoration: checks[p] ? "line-through" : "none",
                  color: checks[p] ? C.muted : C.text
                }}>{p}</span>
              </div>
              <button
                onClick={() => setNovedadComp(p)}
                style={{
                  background: C.danger + "10", color: C.danger,
                  border: "1px solid " + C.danger + "20",
                  borderRadius: 8, padding: "4px 10px",
                  fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit"
                }}
              >! NOVEDAD</button>
            </div>
          ))}
          <div style={{ marginTop: 20 }}>
            {!iniciado
              ? <Btn onClick={iniciarTimer} style={{ width: "100%", padding: 14 }}>INICIAR INSPECCION</Btn>
              : <Btn variant="success" onClick={finalizar} style={{ width: "100%", padding: 14 }}>FINALIZAR Y CERRAR ORDEN</Btn>
            }
          </div>
        </Card>
      </div>
    </div>
  );

  // ORDEN COMPLETADA
  if (vista === "completado") return (
    <div>
      <PageHeader title="Servicios" onBack={resetServicio} />
      <Card style={{ textAlign: "center", padding: 48, maxWidth: 440 }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>OK</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Orden Completada</div>
        <div style={{ color: C.muted, marginBottom: 8 }}>{equipo?.nombre_referencia}</div>
        <div style={{ fontSize: 13, color: C.success, fontWeight: 600, marginBottom: 8 }}>
          Tiempo: {fmt(timer)} - M.O: ${Number(equipo?.costo_mano_obra || 0).toLocaleString()}
        </div>
        {novedades.length > 0 && (
          <div style={{ fontSize: 12, color: C.warning, marginBottom: 20 }}>
            ! {novedades.length} novedad(es) registrada(s)
          </div>
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <Btn onClick={resetServicio}>VOLVER AL MENU</Btn>
          <Btn variant="ghost">P VER PDF</Btn>
        </div>
      </Card>
    </div>
  );

  // SELECCION EQUIPO
  if (vista === "equipos") return (
    <div>
      <PageHeader title="Seleccionar Equipo" subtitle="En que equipo vas a trabajar?" onBack={() => setVista("menu")} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
        {equipos.map(eq => (
          <Card key={eq.id} onClick={() => { setEquipo(eq); setVista("inspeccion"); }} style={{ textAlign: "center" }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, marginBottom: 12,
              background: "linear-gradient(135deg, #00B4D818, #06D6A012)",
              border: "1px solid #00B4D830",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#00B4D8", letterSpacing: 1 }}>
                TEC
              </div>
            </div>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>{eq.nombre_referencia}</div>
            <div style={{ fontSize: 12, color: C.success, fontWeight: 600, marginBottom: 12 }}>
              M.O: ${Number(eq.costo_mano_obra).toLocaleString()}
            </div>
            <Badge color={C.accent}>{parsePiezas(eq).length} componentes</Badge>
          </Card>
        ))}
      </div>
    </div>
  );

  // HISTORIAL
  if (vista === "historial") return (
    <div>
      <PageHeader title="Mi Historial" subtitle="Servicios realizados" onBack={() => setVista("menu")} />
      <div style={{ maxWidth: 600 }}>
        {[
          { id: "#1042", equipo: "Compresor Industrial",  tecnico: "Carlos Mendoza", estado: "COMPLETADO", fecha: "Hoy, 09:15" },
          { id: "#1041", equipo: "Montacargas Electrico", tecnico: "Diego Ruiz",     estado: "EN PROCESO", fecha: "Hoy, 08:00" },
          { id: "#1040", equipo: "Banda Transportadora",  tecnico: "Carlos Mendoza", estado: "COMPLETADO", fecha: "Ayer, 15:30" },
        ].map((h, i) => (
          <Card key={i} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: C.dark + "08", border: "1px solid " + C.border,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 800, fontSize: 11, color: C.muted
                }}>{h.id}</div>
                <div>
                  <div style={{ fontWeight: 700 }}>{h.equipo}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{h.tecnico} - {h.fecha}</div>
                </div>
              </div>
              <Badge color={h.estado === "COMPLETADO" ? C.success : C.warning}>{h.estado}</Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );

  // MENU SERVICIOS
  return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <PageHeader title="Servicio Tecnico" subtitle="Gestion de inspecciones y ordenes" onBack={onBack} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, maxWidth: 700 }}>
        {[
          { icon: "nuevo", label: "Nuevo Servicio",  desc: "Iniciar inspeccion",   action: () => setVista("equipos") },
          { icon: "hist", label: "Mi Historial",    desc: "Servicios realizados", action: () => setVista("historial") },
          { icon: "pdf", label: "Generar PDF",     desc: "Exportar reporte",     action: () => setToast({ msg: "PDF proximamente", type: "warning" }) },
        ].map((item, i) => (
          <Card key={i} onClick={item.action} style={{ textAlign: "center", padding: 28 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, marginBottom: 12,
              background: "linear-gradient(135deg, #00B4D818, #06D6A012)",
              border: "1px solid #00B4D830",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#00B4D8", letterSpacing: 0.5 }}>
                {(item.icon || "").slice(0,3).toUpperCase()}
              </div>
            </div>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>{item.label}</div>
            <div style={{ fontSize: 12, color: C.muted }}>{item.desc}</div>
          </Card>
        ))}
      </div>
    </div>
  );
};

// ============================================================
// MODULO HORARIOS
// ============================================================
const Horarios = ({ onBack }) => {
  const [vista, setVista]   = useState("menu");
  const [toast, setToast]   = useState(null);
  const [personal]          = useState(["Carlos Mendoza","Laura Gomez","Diego Ruiz","Ana Torres","Pedro Castro"]);
  const [vehiculos]         = useState(["ABC-123","XYZ-456","DEF-789"]);
  const [form, setForm]     = useState({ fecha: "", placa: "", empleados: [], h_inicio: "08:00 AM", h_fin: "06:00 PM" });

  const toggleEmp = emp => setForm(f => ({
    ...f,
    empleados: f.empleados.includes(emp) ? f.empleados.filter(e => e !== emp) : [...f.empleados, emp]
  }));

  const rutas = [
    { placa: "ABC-123", equipo: ["Carlos Mendoza","Laura Gomez"], h_inicio: "08:00 AM", h_fin: "06:00 PM" },
    { placa: "XYZ-456", equipo: ["Diego Ruiz"],                   h_inicio: "07:00 AM", h_fin: "05:00 PM" },
  ];

  const marcas = ["ENTRADA","ALMUERZO","REGRESO","SALIDA"];

  if (vista === "planeacion") return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <PageHeader title="Planeacion de Rutas" onBack={() => setVista("menu")} />
      <div style={{ maxWidth: 540 }}>
        <Card>
          <Input label="FECHA" value={form.fecha} onChange={v => setForm({ ...form, fecha: v })} type="date" />
          <Sel label="VEHICULO" value={form.placa} onChange={v => setForm({ ...form, placa: v })}
            options={[{ value: "", label: "Seleccionar..." }, ...vehiculos.map(p => ({ value: p, label: p }))]} />
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1, marginBottom: 8 }}>
              PERSONAL ASIGNADO
            </div>
            {personal.map(emp => (
              <div
                key={emp} onClick={() => toggleEmp(emp)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 14px",
                  background: form.empleados.includes(emp) ? C.accent + "10" : "#FAFBFD",
                  borderRadius: 10, marginBottom: 6,
                  border: "1px solid " + (form.empleados.includes(emp) ? C.accent + "40" : C.border),
                  cursor: "pointer"
                }}
              >
                <input type="checkbox" readOnly checked={form.empleados.includes(emp)}
                  style={{ width: 16, height: 16, accentColor: C.dark }} />
                <span style={{ fontSize: 13, fontWeight: form.empleados.includes(emp) ? 600 : 400 }}>{emp}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input label="HORA INICIO" value={form.h_inicio} onChange={v => setForm({ ...form, h_inicio: v })} />
            <Input label="HORA FIN"    value={form.h_fin}    onChange={v => setForm({ ...form, h_fin: v })} />
          </div>
          <Btn
            onClick={() => { setToast({ msg: "Ruta planeada correctamente", type: "success" }); setTimeout(() => setVista("menu"), 1000); }}
            style={{ width: "100%", marginTop: 8 }}
          >GUARDAR PLANEACION</Btn>
        </Card>
      </div>
    </div>
  );

  if (vista === "rutas") return (
    <div>
      <PageHeader title="Rutas del Dia" subtitle={new Date().toLocaleDateString("es-CO")} onBack={() => setVista("menu")} />
      {rutas.map((r, i) => (
        <Card key={i} style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Vehiculos {r.placa}</div>
            <Badge color={C.success}>{r.h_inicio} - {r.h_fin}</Badge>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 8 }}>EQUIPO</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {r.equipo.map((e, j) => <Badge key={j} color={C.accent}>{e}</Badge>)}
          </div>
        </Card>
      ))}
    </div>
  );

  if (vista === "asistencia") return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <PageHeader title="Registro de Asistencia" onBack={() => setVista("menu")} />
      <div style={{ maxWidth: 700 }}>
        {personal.map((emp, i) => (
          <Card key={i} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, background: C.dark + "10",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18
                }}>USR</div>
                <div>
                  <div style={{ fontWeight: 700 }}>{emp}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>
                    {i === 3 ? "Sin marcar hoy" : "Entrada: 08:0" + i}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {marcas.map(t => (
                  <button
                    key={t}
                    onClick={() => setToast({ msg: t + " registrado: " + emp, type: "success" })}
                    style={{
                      background: C.dark + "08", border: "1px solid " + C.border,
                      borderRadius: 8, padding: "5px 10px", fontSize: 9,
                      fontWeight: 700, cursor: "pointer", color: C.muted, fontFamily: "inherit"
                    }}
                  >{t}</button>
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );

  return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <PageHeader title="Control de Horarios" subtitle="Gestion de tiempos y rutas" onBack={onBack} />
      <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
        <KPI label="PRESENTES HOY" value="7"  icon="OK" color={C.success} />
        <KPI label="AUSENTES"      value="1"  icon="[X]" color={C.danger} />
        <KPI label="HORAS EXTRA"   value="4h" icon="!" color={C.warning} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
        {[
          { icon: "Horarios", label: "Asistencia", desc: "Registrar marcas",  action: () => setVista("asistencia") },
          { icon: "veh", label: "Rutas Hoy",  desc: "Ver rutas del dia", action: () => setVista("rutas") },
          { icon: "dia", label: "Planeacion", desc: "Asignar personal",  action: () => setVista("planeacion") },
        ].map((item, i) => (
          <Card key={i} onClick={item.action} style={{ textAlign: "center", padding: 28 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, marginBottom: 12,
              background: "linear-gradient(135deg, #00B4D818, #06D6A012)",
              border: "1px solid #00B4D830",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#00B4D8", letterSpacing: 0.5 }}>
                {(item.icon || "").slice(0,3).toUpperCase()}
              </div>
            </div>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>{item.label}</div>
            <div style={{ fontSize: 12, color: C.muted }}>{item.desc}</div>
          </Card>
        ))}
      </div>
    </div>
  );
};

// ============================================================
// MODULO REPORTES
// ============================================================
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
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>PDF · Excel</div>
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
    horarios:    <Horarios     onBack={() => setPage("dashboard")} />,
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