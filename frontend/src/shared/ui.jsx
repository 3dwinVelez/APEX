import { useState, useEffect, useRef } from "react";
import { API_URL, C } from "./constants";
import logo from "../assets/logo_scj.png";
import { fullPermissions } from "./permissions";

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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(API_URL + "/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (res.ok && data.usuario) {
        onLogin(data.usuario);
      } else {
        setError(data.detail || "Credenciales incorrectas");
      }
    } catch (error) {
      // Modo demo si no hay backend conectado aun
      if (error?.name === "AbortError") {
        setError("El servidor tardo demasiado en responder. Revisa el backend.");
      } else if (password === "1234") {
        onLogin({
          id: 1,
          nombre: username,
          username,
          rol: "admin",
          role_nombre: "Administrador",
          permissions: fullPermissions(),
        });
      } else {
        setError("Error de conexion. Demo: usa contrasena 1234");
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
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

const Alert = ({ tipo = "info", texto, onClose }) => {
  const colores = {
    success: { bg: "#06D6A010", border: "#06D6A040", text: "#06D6A0" },
    error:   { bg: "#EF444410", border: "#EF444440", text: "#EF4444" },
    warning: { bg: "#F59E0B10", border: "#F59E0B40", text: "#F59E0B" },
    info:    { bg: "#00B4D810", border: "#00B4D840", text: "#00B4D8" },
  };
  const c = colores[tipo] || colores.info;
  return (
    <div style={{
      padding: "12px 16px", borderRadius: 10, marginBottom: 16,
      background: c.bg, border: `1px solid ${c.border}`,
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12
    }}>
      <span style={{ fontSize: 13, color: c.text, fontWeight: 600 }}>{texto}</span>
      {onClose && (
        <span onClick={onClose} style={{ cursor: "pointer", color: c.text, fontWeight: 800, fontSize: 16, lineHeight: 1 }}>x</span>
      )}
    </div>
  );
};

export { Badge, Card, Btn, Input, Sel, PageHeader, KPI, Toast, Layout, Login, Alert };
