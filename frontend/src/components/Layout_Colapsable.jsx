import { useEffect, useState } from "react";
import { C } from "../shared/constants";
import { can } from "../shared/permissions";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "\u{1F4CA}", color: "#00B4D8" },
  { id: "servicios", label: "Servicios", icon: "\u{1F6E0}\uFE0F", color: "#06D6A0" },
  { id: "horarios", label: "Horarios", icon: "\u23F0", color: "#F59E0B" },
  { id: "vehiculos", label: "Vehiculos", icon: "\u{1F697}", color: "#F59E0B" },
  { id: "personal", label: "Personal", icon: "\u{1F465}", color: "#8B5CF6" },
  { id: "roles", label: "Roles", icon: "\u{1F510}", color: "#22C55E" },
  { id: "referencias", label: "Referencias", icon: "\u{1F4E6}", color: "#EC4899" },
  { id: "configuracion", label: "Configuracion", icon: "\u2699\uFE0F", color: "#2563EB" },
  { id: "nomina", label: "Nomina", icon: "\u{1F4B0}", color: "#14B8A6" },
  { id: "reportes", label: "Reportes", icon: "\u{1F4C8}", color: "#00B4D8" },
];

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

  const visibleNav = NAV_ITEMS.filter((item) => can(user, item.id, "access"));

  const handleNavClick = (id) => {
    onNavigate(id);
    if (isMobile) setMenuCollapsed(true);
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        background: C.bg,
        fontFamily: "'Segoe UI', sans-serif",
        overflow: "hidden",
      }}
    >
      {isMobile && !menuCollapsed && (
        <div
          onClick={() => setMenuCollapsed(true)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 998,
          }}
        />
      )}

      <div
        style={{
          width: menuCollapsed ? (isMobile ? 0 : 72) : 248,
          background: "#0D1B2A",
          display: "flex",
          flexDirection: "column",
          padding: menuCollapsed ? (isMobile ? 0 : "24px 0") : "24px 0",
          flexShrink: 0,
          overflowY: "auto",
          overflowX: "hidden",
          transition: "all 0.3s ease",
          position: isMobile ? "fixed" : "relative",
          height: "100vh",
          zIndex: 999,
          boxShadow: isMobile && !menuCollapsed ? "4px 0 20px rgba(0,0,0,0.3)" : "none",
        }}
      >
        <div
          style={{
            padding: menuCollapsed ? (isMobile ? 0 : "0 10px 20px") : "0 20px 28px",
            opacity: menuCollapsed && isMobile ? 0 : 1,
          }}
        >
          <div
            style={{
              fontSize: menuCollapsed && !isMobile ? 16 : 20,
              fontWeight: 900,
              color: "#fff",
              letterSpacing: menuCollapsed && !isMobile ? 1 : 2,
              textAlign: menuCollapsed && !isMobile ? "center" : "left",
            }}
          >
            {menuCollapsed && !isMobile ? "AX" : "APEX"}
          </div>
          {(!menuCollapsed || isMobile) && (
            <div style={{ fontSize: 10, color: "#4A90D9", letterSpacing: 3, fontWeight: 600 }}>
              SCJ - ERP
            </div>
          )}
        </div>

        <div style={{ flex: 1 }}>
          {visibleNav.map((item) => (
            <div
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              title={menuCollapsed ? item.label : ""}
              style={{
                padding: menuCollapsed && !isMobile ? "11px 10px" : "11px 20px",
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: activePage === item.id ? "rgba(0,180,216,0.12)" : "transparent",
                borderLeft: activePage === item.id ? `3px solid ${item.color}` : "3px solid transparent",
                cursor: "pointer",
                justifyContent: menuCollapsed && !isMobile ? "center" : "flex-start",
                opacity: menuCollapsed && isMobile ? 0 : 1,
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: "transparent",
                  color: activePage === item.id ? "#fff" : "#8892A4",
                  fontSize: 18,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  filter: activePage === item.id ? "none" : "grayscale(0.3)",
                }}
              >
                {item.icon}
              </span>
              {(!menuCollapsed || isMobile) && (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: activePage === item.id ? 700 : 500,
                    color: activePage === item.id ? "#fff" : "#8892A4",
                  }}
                >
                  {item.label}
                </span>
              )}
            </div>
          ))}
        </div>

        <div
          style={{
            padding: menuCollapsed && !isMobile ? "20px 10px" : "20px",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            opacity: menuCollapsed && isMobile ? 0 : 1,
          }}
        >
          {(!menuCollapsed || isMobile) && (
            <>
              <div style={{ fontSize: 11, color: "#8892A4", marginBottom: 4 }}>Conectado como</div>
              <div style={{ fontSize: 13, color: "#fff", fontWeight: 700 }}>
                {user && (user.nombre || user.username)}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: C.accent,
                  fontWeight: 600,
                  marginBottom: 10,
                  textTransform: "uppercase",
                }}
              >
                {user && user.rol}
              </div>
            </>
          )}

          <button
            onClick={onLogout}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#8892A4",
              fontSize: menuCollapsed && !isMobile ? 20 : 11,
              padding: menuCollapsed && !isMobile ? "10px" : "7px 14px",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
              width: "100%",
              fontFamily: "inherit",
            }}
          >
            {menuCollapsed && !isMobile ? "\u{1F6AA}" : "CERRAR SESION"}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: isMobile ? 16 : 32, position: "relative" }}>
        <button
          onClick={() => setMenuCollapsed((prev) => !prev)}
          style={{
            position: isMobile ? "fixed" : "absolute",
            top: isMobile ? 16 : 32,
            left: isMobile ? 16 : 32,
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "#0D1B2A",
            border: "none",
            color: "#fff",
            fontSize: 18,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 997,
            boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
          }}
          title={menuCollapsed ? "Abrir menu" : "Cerrar menu"}
        >
          {menuCollapsed ? "\u2630" : "\u2715"}
        </button>

        <div style={{ marginTop: isMobile ? 60 : 0, marginLeft: isMobile ? 0 : 60 }}>{children}</div>
      </div>
    </div>
  );
};

export default Layout;
