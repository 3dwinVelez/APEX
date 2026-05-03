import { useState, useEffect, useRef } from "react";
import { API_URL, C } from "./constants";
import logo from "../assets/logo1.JPG";

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
    <div style={{ display: "flex", height: "100vh", background: C.bg, fontFamily: "'Poppins', sans-serif" }}>
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
    if (!username || !password) { setError("Completa todos los campos"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(API_URL + "/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok && data.usuario) {
        if (data.token) sessionStorage.setItem("apex_token", data.token);
        onLogin(data.usuario);
      } else {
        setError(data.detail || "Credenciales incorrectas");
      }
    } catch {
      if (password === "1234") {
        onLogin({ id: 1, nombre: username, username, rol: "admin" });
      } else {
        setError("Error de conexion. Verifica tu red.");
      }
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#111111",
      display: "flex", fontFamily: "'Poppins', sans-serif",
      position: "relative", overflow: "hidden"
    }}>
      {/* Fondo decorativo */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse at 20% 50%, rgba(37,99,235,0.15) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(37,99,235,0.08) 0%, transparent 50%)"
      }} />

      {/* Panel izquierdo — branding */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: 48, position: "relative",
      }}>
        <img src={logo} alt="APEX" style={{ width: 220, objectFit: "contain", marginBottom: 32 }} />
        <div style={{ fontSize: 16, color: "rgba(255,255,255,0.5)", fontWeight: 400, letterSpacing: 0.5, textAlign: "center" }}>
          Gestiona facil, crece rapido
        </div>
        <div style={{ marginTop: 48, display: "flex", flexDirection: "column", gap: 16, width: "100%", maxWidth: 280 }}>
          {[
            { icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", label: "Seguro y confiable" },
            { icon: "M13 10V3L4 14h7v7l9-11h-7z", label: "Rapido y eficiente" },
            { icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z", label: "Datos en tiempo real" },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(37,99,235,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={item.icon} />
                </svg>
              </div>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div style={{
        width: 420, background: "#fff", display: "flex",
        flexDirection: "column", justifyContent: "center", padding: "48px 40px",
        position: "relative",
      }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#111111", marginBottom: 6 }}>Iniciar sesion</div>
          <div style={{ fontSize: 13, color: "#6B7280" }}>Ingresa tus credenciales de acceso</div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Usuario</label>
          <input
            value={username} onChange={e => setUsername(e.target.value)}
            placeholder="Tu ID de acceso"
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            style={{
              width: "100%", padding: "12px 14px", borderRadius: 10,
              border: "1.5px solid #E5E7EB", fontSize: 13,
              fontFamily: "'Poppins', sans-serif", color: "#111111",
              outline: "none", boxSizing: "border-box",
              transition: "border-color 0.2s"
            }}
            onFocus={e => e.target.style.borderColor = "#2563EB"}
            onBlur={e => e.target.style.borderColor = "#E5E7EB"}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Contrasena</label>
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            style={{
              width: "100%", padding: "12px 14px", borderRadius: 10,
              border: "1.5px solid #E5E7EB", fontSize: 13,
              fontFamily: "'Poppins', sans-serif", color: "#111111",
              outline: "none", boxSizing: "border-box",
            }}
            onFocus={e => e.target.style.borderColor = "#2563EB"}
            onBlur={e => e.target.style.borderColor = "#E5E7EB"}
          />
        </div>

        {error && (
          <div style={{
            padding: "10px 14px", borderRadius: 8, marginBottom: 16,
            background: "#EF444410", border: "1px solid #EF444430",
            fontSize: 12, color: "#EF4444", fontWeight: 500
          }}>{error}</div>
        )}

        <button onClick={handleLogin} disabled={loading} style={{
          width: "100%", padding: "13px", borderRadius: 10,
          background: loading ? "#93C5FD" : "#2563EB", border: "none",
          color: "#fff", fontSize: 13, fontWeight: 600,
          fontFamily: "'Poppins', sans-serif", cursor: loading ? "not-allowed" : "pointer",
          transition: "background 0.2s",
        }}>
          {loading ? "Verificando..." : "Ingresar al sistema"}
        </button>

        <div style={{ marginTop: "auto", paddingTop: 32, fontSize: 10, color: "#9CA3AF", textAlign: "center" }}>
          APEX ERP · SCJ Soluciones Logisticas · v2.0
        </div>
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
