import { useEffect, useState } from "react";
import { C } from "../shared/constants";
import { can } from "../shared/permissions";
import logo from "../assets/logo3.JPG";

const NAV_ITEMS = [
  { id: "dashboard",     label: "Dashboard",     color: "#2563EB",  svg: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { id: "servicios",     label: "Servicios",     color: "#06D6A0",  svg: "M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" },
  { id: "horarios",      label: "Horarios",      color: "#F59E0B",  svg: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
  { id: "vehiculos",     label: "Vehiculos",     color: "#F59E0B",  svg: "M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0zM13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10" },
  { id: "personal",      label: "Personal",      color: "#8B5CF6",  svg: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
  { id: "roles",         label: "Roles",         color: "#22C55E",  svg: "M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" },
  { id: "referencias",   label: "Referencias",   color: "#EC4899",  svg: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
  { id: "configuracion", label: "Configuracion", color: "#2563EB",  svg: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
  { id: "nomina",        label: "Nomina",        color: "#14B8A6",  svg: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" },
  { id: "reportes",      label: "Reportes",      color: "#2563EB",  svg: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
];

const NavIcon = ({ path, size = 18, color = "#fff" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={path} />
  </svg>
);

const Layout = ({ children, user, onLogout, activePage, onNavigate }) => {
  const [menuCollapsed, setMenuCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setMenuCollapsed(true);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const visibleNav = NAV_ITEMS.filter(item => can(user, item.id, "access"));
  const handleNavClick = id => { onNavigate(id); if (isMobile) setMenuCollapsed(true); };

  const sidebarW = menuCollapsed ? (isMobile ? 0 : 72) : 248;

  return (
    <div style={{ display: "flex", height: "100vh", background: C.bg, fontFamily: "'Poppins', sans-serif", overflow: "hidden" }}>

      {isMobile && !menuCollapsed && (
        <div onClick={() => setMenuCollapsed(true)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 998
        }} />
      )}

      {/* SIDEBAR */}
      <div style={{
        width: sidebarW, background: "#111111",
        display: "flex", flexDirection: "column",
        flexShrink: 0, overflowY: "auto", overflowX: "hidden",
        transition: "all 0.3s ease",
        position: isMobile ? "fixed" : "relative",
        height: "100vh", zIndex: 999,
        boxShadow: isMobile && !menuCollapsed ? "4px 0 24px rgba(0,0,0,0.4)" : "none",
      }}>

        {/* LOGO */}
        <div style={{
          padding: menuCollapsed && !isMobile ? "20px 10px" : "20px 16px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", justifyContent: menuCollapsed && !isMobile ? "center" : "flex-start",
          opacity: menuCollapsed && isMobile ? 0 : 1,
          minHeight: 72
        }}>
          {menuCollapsed && !isMobile ? (
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "#2563EB",
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M12 2L3 20h18L12 2z" />
                <path d="M12 8L7 18h10L12 8z" fill="#111111" opacity="0.4"/>
              </svg>
            </div>
          ) : (
            <img src={logo} alt="APEX" style={{ height: 36, objectFit: "contain" }} />
          )}
        </div>

        {/* NAV */}
        <div style={{ flex: 1, paddingTop: 8 }}>
          {visibleNav.map(item => {
            const active = activePage === item.id;
            return (
              <div key={item.id} onClick={() => handleNavClick(item.id)}
                title={menuCollapsed && !isMobile ? item.label : ""}
                style={{
                  padding: menuCollapsed && !isMobile ? "10px 0" : "9px 16px",
                  display: "flex", alignItems: "center",
                  gap: 12, cursor: "pointer",
                  justifyContent: menuCollapsed && !isMobile ? "center" : "flex-start",
                  background: active ? "#2563EB18" : "transparent",
                  borderLeft: active ? "3px solid #2563EB" : "3px solid transparent",
                  transition: "all 0.15s",
                  opacity: menuCollapsed && isMobile ? 0 : 1,
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: active ? item.color + "22" : "rgba(255,255,255,0.06)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.15s",
                }}>
                  <NavIcon path={item.svg} size={16}
                    color={active ? item.color : "#8892A4"} />
                </div>
                {(!menuCollapsed || isMobile) && (
                  <span style={{
                    fontSize: 12, fontWeight: active ? 600 : 400,
                    color: active ? "#fff" : "#8892A4",
                    letterSpacing: 0.2,
                  }}>{item.label}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* USER */}
        <div style={{
          padding: menuCollapsed && !isMobile ? "16px 10px" : "16px",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          opacity: menuCollapsed && isMobile ? 0 : 1,
        }}>
          {(!menuCollapsed || isMobile) && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: "#6B7280", marginBottom: 2 }}>Conectado como</div>
              <div style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>{user?.nombre || user?.username}</div>
              <div style={{ fontSize: 10, color: "#2563EB", fontWeight: 600, textTransform: "uppercase" }}>{user?.rol}</div>
            </div>
          )}
          <button onClick={onLogout} style={{
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
            color: "#8892A4", fontSize: menuCollapsed && !isMobile ? 16 : 11,
            padding: menuCollapsed && !isMobile ? "10px" : "8px 14px",
            borderRadius: 8, cursor: "pointer", fontWeight: 600, width: "100%",
            fontFamily: "'Poppins', sans-serif",
          }}>
            {menuCollapsed && !isMobile ? "→" : "CERRAR SESION"}
          </button>
        </div>
      </div>

      {/* CONTENIDO */}
      <div style={{ flex: 1, overflow: "auto", padding: isMobile ? 16 : 28, position: "relative" }}>
        <button onClick={() => setMenuCollapsed(p => !p)} style={{
          position: isMobile ? "fixed" : "absolute",
          top: isMobile ? 16 : 20, left: isMobile ? 16 : 20,
          width: 40, height: 40, borderRadius: 10,
          background: "#111111", border: "none", color: "#fff",
          fontSize: 16, cursor: "pointer", display: "flex",
          alignItems: "center", justifyContent: "center",
          zIndex: 997, boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
        }}>
          {menuCollapsed ? "☰" : "✕"}
        </button>
        <div style={{
          marginTop: isMobile ? 56 : 0,
          marginLeft: isMobile ? 0 : 56,
          animation: "fadeIn 0.2s ease",
        }}>
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(6px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          {children}
        </div>
      </div>
    </div>
  );
};

export default Layout;
