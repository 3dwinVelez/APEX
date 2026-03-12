import { useState, useEffect } from "react";
import { C } from "../shared/constants";

const Layout = ({ children, user, onLogout, activePage, onNavigate }) => {
  const [menuCollapsed, setMenuCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detectar si es móvil
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // En móvil, colapsar por defecto
      if (mobile) setMenuCollapsed(true);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const nav = [
    { id: "dashboard",   icon: "📊", label: "Dashboard" },
    { id: "servicios",   icon: "🛠️", label: "Servicios" },
    { id: "horarios",    icon: "⏰", label: "Horarios" },
    { id: "vehiculos",   icon: "🚗", label: "Vehiculos" },
    { id: "personal",    icon: "👥", label: "Personal" },
    { id: "referencias", icon: "📦", label: "Referencias" },
    { id: "reportes",    icon: "📈", label: "Reportes" },
  ];

  const dotColor = {
    "dashboard": "#00B4D8",
    "servicios": "#06D6A0",
    "horarios": "#F59E0B",
    "vehiculos": "#F59E0B",
    "personal": "#8B5CF6",
    "referencias": "#EC4899",
    "reportes": "#00B4D8"
  };

  const toggleMenu = () => {
    setMenuCollapsed(!menuCollapsed);
  };

  const handleNavClick = (id) => {
    onNavigate(id);
    // En móvil, cerrar menú automáticamente al seleccionar
    if (isMobile) {
      setMenuCollapsed(true);
    }
  };

  return (
    <div style={{ 
      display: "flex", 
      height: "100vh", 
      background: C.bg, 
      fontFamily: "'Segoe UI', sans-serif",
      overflow: "hidden"
    }}>
      {/* OVERLAY para móvil cuando el menú está abierto */}
      {isMobile && !menuCollapsed && (
        <div
          onClick={() => setMenuCollapsed(true)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 998,
            transition: "all 0.3s ease"
          }}
        />
      )}

      {/* SIDEBAR */}
      <div style={{
        width: menuCollapsed ? (isMobile ? 0 : 70) : 240,
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
        boxShadow: isMobile && !menuCollapsed ? "4px 0 20px rgba(0,0,0,0.3)" : "none"
      }}>
        {/* Logo */}
        <div style={{ 
          padding: menuCollapsed ? (isMobile ? 0 : "0 10px 20px") : "0 20px 28px",
          opacity: menuCollapsed && isMobile ? 0 : 1,
          transition: "opacity 0.3s ease"
        }}>
          <div style={{ 
            fontSize: menuCollapsed && !isMobile ? 16 : 20, 
            fontWeight: 900, 
            color: "#fff", 
            letterSpacing: menuCollapsed && !isMobile ? 1 : 2,
            textAlign: menuCollapsed && !isMobile ? "center" : "left",
            transition: "all 0.3s ease"
          }}>
            {menuCollapsed && !isMobile ? "AX" : "APEX"}
          </div>
          {(!menuCollapsed || isMobile) && (
            <div style={{ 
              fontSize: 10, 
              color: "#4A90D9", 
              letterSpacing: 3, 
              fontWeight: 600,
              textAlign: menuCollapsed && !isMobile ? "center" : "left"
            }}>
              SCJ - ERP
            </div>
          )}
        </div>

        {/* Navegación */}
        <div style={{ flex: 1 }}>
          {nav.map(item => (
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
                borderLeft: activePage === item.id ? "3px solid " + (dotColor[item.id] || C.accent) : "3px solid transparent",
                cursor: "pointer",
                transition: "all 0.15s",
                justifyContent: menuCollapsed && !isMobile ? "center" : "flex-start",
                opacity: menuCollapsed && isMobile ? 0 : 1
              }}
              onMouseEnter={e => {
                if (activePage !== item.id) {
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                }
              }}
              onMouseLeave={e => {
                if (activePage !== item.id) {
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              {/* Icono */}
              <span style={{ 
                fontSize: 18,
                flexShrink: 0,
                filter: activePage === item.id ? "none" : "grayscale(0.5) opacity(0.6)"
              }}>
                {item.icon}
              </span>
              
              {/* Label */}
              {(!menuCollapsed || isMobile) && (
                <span style={{
                  fontSize: 12,
                  fontWeight: activePage === item.id ? 700 : 500,
                  color: activePage === item.id ? "#fff" : "#8892A4",
                  letterSpacing: 0.3,
                  whiteSpace: "nowrap"
                }}>
                  {item.label}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Footer con usuario */}
        <div style={{ 
          padding: menuCollapsed && !isMobile ? "20px 10px" : "20px",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          opacity: menuCollapsed && isMobile ? 0 : 1,
          transition: "opacity 0.3s ease"
        }}>
          {(!menuCollapsed || isMobile) && (
            <>
              <div style={{ fontSize: 11, color: "#8892A4", marginBottom: 4 }}>
                Conectado como
              </div>
              <div style={{ fontSize: 13, color: "#fff", fontWeight: 700 }}>
                {user && (user.nombre || user.username)}
              </div>
              <div style={{ 
                fontSize: 10, 
                color: C.accent, 
                fontWeight: 600, 
                marginBottom: 10, 
                textTransform: "uppercase" 
              }}>
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
              transition: "all 0.15s"
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "rgba(255,255,255,0.10)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
            }}
          >
            {menuCollapsed && !isMobile ? "🚪" : "CERRAR SESION"}
          </button>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div style={{ 
        flex: 1, 
        overflow: "auto", 
        padding: isMobile ? 16 : 32,
        position: "relative"
      }}>
        {/* Botón Toggle Menu */}
        <button
          onClick={toggleMenu}
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
            fontSize: 20,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 997,
            boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
            transition: "all 0.2s ease"
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = "#1a2d42";
            e.currentTarget.style.transform = "scale(1.05)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "#0D1B2A";
            e.currentTarget.style.transform = "scale(1)";
          }}
          title={menuCollapsed ? "Abrir menú" : "Cerrar menú"}
        >
          {menuCollapsed ? "☰" : "✕"}
        </button>

        {/* Contenido con margen para el botón */}
        <div style={{ 
          marginTop: isMobile ? 60 : 0,
          marginLeft: isMobile ? 0 : 60 
        }}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default Layout;
