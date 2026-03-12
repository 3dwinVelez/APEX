import { useState, useEffect, useRef } from "react";
import { C, API_URL } from "../shared/constants";
import { Card, Btn, PageHeader, Spinner } from "../shared/ui";
import { useGPSTracking } from "../shared/hooks";

// ============================================================
// ICONOS SVG DE CAMIONES (sin cambios, se mantienen igual)
// ============================================================
const TruckIcon = ({ tipo, color = "#00B4D8", size = 80 }) => {
  const c = color;
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
    </svg>
  );
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
  if (["MINIMULA","TRACTOMULA"].includes(tipo)) return (
    <svg width={size*1.4} height={size*0.6} viewBox="0 0 180 72" fill="none">
      <rect x="4" y="18" width="50" height="38" rx="4" fill={c} opacity="0.25" stroke={c} strokeWidth="2"/>
      <rect x="8" y="22" width="22" height="18" rx="2" fill={c} opacity="0.4"/>
      <circle cx="18" cy="62" r="8" fill={c} opacity="0.3" stroke={c} strokeWidth="2"/>
      <circle cx="18" cy="62" r="4" fill={c}/>
      <circle cx="44" cy="62" r="8" fill={c} opacity="0.3" stroke={c} strokeWidth="2"/>
      <circle cx="44" cy="62" r="4" fill={c}/>
      <rect x="52" y="38" width="10" height="8" rx="2" fill={c} opacity="0.5"/>
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

// ============================================================
// CONSTANTES
// ============================================================
const ESTADO_CONFIG = {
  "INGRESO":     { color: "#06D6A0", label: "En Jornada",  pulse: true  },
  "ALMUERZO":    { color: "#F59E0B", label: "Almuerzo",    pulse: false },
  "RETORNO":     { color: "#00B4D8", label: "Trabajando",  pulse: true  },
  "CIERRE":      { color: "#8B5CF6", label: "Finalizo",    pulse: false },
  "SIN MARCAR":  { color: "#94A3B8", label: "Sin iniciar", pulse: false },
};

const MARCA_CONFIG = {
  "INGRESO":  { color: "#06D6A0", label: "Ingreso"  },
  "ALMUERZO": { color: "#F59E0B", label: "Almuerzo" },
  "RETORNO":  { color: "#00B4D8", label: "Retorno"  },
  "CIERRE":   { color: "#8B5CF6", label: "Cierre"   },
};

const COLORES_OP = ["#06D6A0","#00B4D8","#F59E0B","#8B5CF6","#EF4444","#EC4899","#14B8A6","#F97316"];

const OFFLINE_UMBRAL_MIN = 15; // alerta si no actualiza en +15 min

// ============================================================
// HELPERS
// ============================================================
const getMinutosDesdeUpdate = (timestamp) => {
  if (!timestamp) return null;
  return Math.floor((Date.now() - new Date(timestamp)) / 60000);
};

const isOffline = (timestamp) => {
  const mins = getMinutosDesdeUpdate(timestamp);
  return mins !== null && mins > OFFLINE_UMBRAL_MIN;
};

// ============================================================
// SUB-COMPONENTE: Panel lateral de detalle del operario seleccionado
// ============================================================
const PanelDetalle = ({ op, onCerrar, onVerRecorrido }) => {
  if (!op) return null;
  const cfg  = ESTADO_CONFIG[op.ultima_marca] || ESTADO_CONFIG["SIN MARCAR"];
  const mins = getMinutosDesdeUpdate(op.timestamp);
  const offline = isOffline(op.timestamp);
  const initials = (op.nombre || "??").split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase();
  return (
    <div style={{
      position: "absolute", top: 10, right: 10, zIndex: 1000,
      width: 240, background: C.card, borderRadius: 14,
      border: "1px solid " + C.border,
      boxShadow: "0 8px 32px rgba(0,0,0,0.14)", padding: 16
    }}>
      {/* Cerrar */}
      <button onClick={onCerrar} style={{
        position: "absolute", top: 10, right: 10,
        background: "none", border: "none", cursor: "pointer",
        color: C.muted, fontSize: 16, lineHeight: 1, fontWeight: 700
      }}>x</button>

      {/* Avatar + nombre */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: "50%",
          background: cfg.color + "20", border: "2px solid " + cfg.color,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 900, fontSize: 14, color: cfg.color, flexShrink: 0
        }}>
          {initials}
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 13, lineHeight: 1.3 }}>
            {op.nombre || op.username}
          </div>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700,
            background: cfg.color + "15", color: cfg.color,
            border: "1px solid " + cfg.color + "28", marginTop: 2
          }}>
            {cfg.pulse && (
              <span style={{ display: "inline-block", width: 5, height: 5,
                borderRadius: "50%", background: cfg.color,
                boxShadow: "0 0 4px " + cfg.color }} />
            )}
            {cfg.label}
          </span>
        </div>
      </div>

      {/* Alerta offline */}
      {offline && (
        <div style={{ padding: "6px 10px", borderRadius: 8, marginBottom: 10,
          background: "#F59E0B10", border: "1px solid #F59E0B28",
          fontSize: 10, fontWeight: 700, color: "#F59E0B" }}>
          Sin actualizacion hace {mins} min
        </div>
      )}

      {/* Info */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
        {op.ultima_hora && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: C.muted }}>Ultima marca</span>
            <strong>{op.ultima_hora}</strong>
          </div>
        )}
        {mins !== null && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: C.muted }}>GPS actualizado</span>
            <strong style={{ color: offline ? "#F59E0B" : C.success }}>
              {mins < 1 ? "Ahora" : "Hace " + mins + " min"}
            </strong>
          </div>
        )}
        {op.precision && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: C.muted }}>Precision GPS</span>
            <strong>{Math.round(op.precision)}m</strong>
          </div>
        )}
        {op.rol && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: C.muted }}>Rol</span>
            <strong style={{ textTransform: "capitalize" }}>{op.rol}</strong>
          </div>
        )}
      </div>

      {/* Acciones */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
        <button
          onClick={() => window.open(
            "https://www.google.com/maps?q=" + op.lat + "," + op.lng + "&z=17",
            "_blank"
          )}
          style={{ width: "100%", padding: "8px 0", borderRadius: 8,
            background: C.accent + "15", border: "1px solid " + C.accent + "30",
            color: C.accent, fontWeight: 700, fontSize: 11,
            cursor: "pointer", fontFamily: "inherit" }}>
          Ver en Google Maps
        </button>
        <button onClick={() => onVerRecorrido(op)}
          style={{ width: "100%", padding: "8px 0", borderRadius: 8,
            background: "#8B5CF615", border: "1px solid #8B5CF628",
            color: "#8B5CF6", fontWeight: 700, fontSize: 11,
            cursor: "pointer", fontFamily: "inherit" }}>
          Ver recorrido del dia
        </button>
      </div>
    </div>
  );
};

// ============================================================
// MAPA OPERARIOS - COMPONENTE PRINCIPAL
// ============================================================
const MapaOperarios = ({ user }) => {
  const mapRef         = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef     = useRef({});
  const recorridoLayerRef = useRef(null);
  const histLayersRef  = useRef([]);
  const refreshTimerRef = useRef(null);

  const [operarios,      setOperarios]      = useState([]);
  const [selOp,          setSelOp]          = useState(null);
  const [loading,        setLoading]        = useState(false);
  const [lastUpdate,     setLastUpdate]     = useState(null);
  const [filtroEstado,   setFiltroEstado]   = useState("todos");
  const [refreshInterval,setRefreshInterval]= useState(60);

  // Historico
  const [modoMapa,       setModoMapa]       = useState("vivo");
  const [histFecha,      setHistFecha]      = useState(new Date(Date.now()-86400000).toISOString().split("T")[0]);
  const [histNombre,     setHistNombre]     = useState("");
  const [histPlaca,      setHistPlaca]      = useState("");
  const [histResultados, setHistResultados] = useState([]);
  const [histLoading,    setHistLoading]    = useState(false);

  const [personalGps,    setPersonalGps]    = useState([]);
  const [vehiculosGps,   setVehiculosGps]   = useState([]);
  
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  const { posicion, gpsError, gpsActivo } = useGPSTracking(user, 0.5);

  useEffect(() => {
    fetch(API_URL + "/personal").then(r=>r.json()).then(d=>setPersonalGps(Array.isArray(d)?d:[])).catch(()=>{});
    fetch(API_URL + "/vehiculos").then(r=>r.json()).then(d=>setVehiculosGps(Array.isArray(d)?d:[])).catch(()=>{});
  }, []);

  // ---- Cargar operarios ----
  const cargarOperarios = async () => {
    setLoading(true);
    try {
      const r = await fetch(API_URL + "/gps/activos");
      const d = await r.json();
      setOperarios(Array.isArray(d) ? d : []);
      setLastUpdate(new Date());
    } catch {}
    setLoading(false);
  };

  // ---- Init mapa Leaflet ----
  useEffect(() => {
    if (mapInstanceRef.current) return;
    const L = window.L;
    if (!L || !mapRef.current) return;
    const map = L.map(mapRef.current, {
      center: [4.711, -74.0721], zoom: 12,
      zoomControl: true,
      attributionControl: false,
      dragging: true,
      touchZoom: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: true,
    });
    // Tile Carto Voyager - empresarial, sin conflictos, sin API key
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      { maxZoom: 19, subdomains: "abcd" }
    ).addTo(map);
    // Forzar resize despues de montaje para evitar tiles grises
    setTimeout(() => map.invalidateSize(), 200);
    mapInstanceRef.current = map;
    cargarOperarios();
  }, []);

  // ---- Auto-refresh configurable ----
  useEffect(() => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    refreshTimerRef.current = setInterval(cargarOperarios, refreshInterval * 1000);
    return () => clearInterval(refreshTimerRef.current);
  }, [refreshInterval]);

  // ---- Actualizar marcadores en el mapa ----
  useEffect(() => {
    const L = window.L;
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    Object.values(markersRef.current).forEach(m => { try { map.removeLayer(m); } catch {} });
    markersRef.current = {};

    if (operarios.length === 0) return;

    const bounds = [];
    operarios.forEach(op => {
      if (!op.lat || !op.lng) return;
      const cfg     = ESTADO_CONFIG[op.ultima_marca] || ESTADO_CONFIG["SIN MARCAR"];
      const color   = cfg.color;
      const offline = isOffline(op.timestamp);
      const mins    = getMinutosDesdeUpdate(op.timestamp);
      const initials = (op.nombre || "??").split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase();

      // Icono con indicador offline si aplica
      const iconHtml =
        "<div style=\"" +
          "width:42px;height:42px;border-radius:50%;" +
          "background:" + (offline ? "#F59E0B" : color) + ";" +
          "border:3px solid white;" +
          "box-shadow:0 2px 12px " + color + "80;" +
          "display:flex;align-items:center;justify-content:center;" +
          "font-weight:900;font-size:12px;color:white;" +
          "font-family:sans-serif;position:relative;" +
          (cfg.pulse && !offline ? "animation:pulse-marker 2s infinite;" : "") +
        "\">" +
          initials +
          "<div style=\"" +
            "position:absolute;bottom:-4px;right:-4px;" +
            "width:14px;height:14px;border-radius:50%;" +
            "background:" + (offline ? "#F59E0B" : color) + ";" +
            "border:2px solid white;" +
          "\"></div>" +
        "</div>";

      const icon = L.divIcon({
        html: iconHtml, className: "", iconSize: [42, 42], iconAnchor: [21, 21]
      });

      const popupContent =
        "<div style=\"font-family:sans-serif;padding:4px;min-width:180px\">" +
          "<div style=\"font-weight:900;font-size:14px\">" + (op.nombre || op.username) + "</div>" +
          "<div style=\"display:inline-block;padding:2px 8px;border-radius:10px;" +
            "background:" + color + "20;color:" + color + ";font-size:11px;font-weight:700;margin:4px 0\">" +
            cfg.label +
          "</div>" +
          (offline
            ? "<div style=\"font-size:10px;color:#F59E0B;font-weight:700\">Sin senal hace " + mins + " min</div>"
            : "") +
          (op.ultima_hora
            ? "<div style=\"font-size:11px;color:#6B7A8D\">Ultima marca: " + op.ultima_hora + "</div>"
            : "") +
          (mins !== null
            ? "<div style=\"font-size:11px;color:#6B7A8D\">GPS: " +
              (mins < 1 ? "ahora mismo" : "hace " + mins + " min") + "</div>"
            : "") +
          (op.precision
            ? "<div style=\"font-size:10px;color:#94A3B8\">Precision: " + Math.round(op.precision) + "m</div>"
            : "") +
          "<div style=\"margin-top:8px\">" +
            "<a href=\"https://www.google.com/maps?q=" + op.lat + "," + op.lng + "\" target=\"_blank\"" +
              " style=\"font-size:11px;color:#00B4D8;text-decoration:none;font-weight:700\">" +
              "Ver en Google Maps" +
            "</a>" +
          "</div>" +
        "</div>";

      const popup = L.popup({ maxWidth: 220, className: "apex-popup" }).setContent(popupContent);
      const marker = L.marker([op.lat, op.lng], { icon }).addTo(map).bindPopup(popup);
      marker.on("click", () => setSelOp(op));
      markersRef.current[op.username] = marker;
      bounds.push([op.lat, op.lng]);
    });

    if (bounds.length > 0) {
      try { map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 }); } catch {}
    }
  }, [operarios]);

  // ---- Limpiar capas ----
  const limpiarRecorrido = () => {
    const map = mapInstanceRef.current;
    if (recorridoLayerRef.current && map) {
      recorridoLayerRef.current.forEach(l => { try { map.removeLayer(l); } catch {} });
      recorridoLayerRef.current = null;
    }
  };

  const limpiarHistorico = () => {
    const map = mapInstanceRef.current;
    if (histLayersRef.current?.length && map) {
      histLayersRef.current.forEach(l => { try { map.removeLayer(l); } catch {} });
      histLayersRef.current = [];
    }
    setHistResultados([]);
  };

  // ---- Ver recorrido del operario (modo vivo -> historico rapido) ----
  const verRecorridoOperario = async (op) => {
    const L = window.L;
    const map = mapInstanceRef.current;
    if (!L || !map) return;
    limpiarRecorrido();
    try {
      const r = await fetch(API_URL + "/gps/recorrido/" + encodeURIComponent(op.nombre));
      const puntos = await r.json();
      if (!Array.isArray(puntos) || puntos.length === 0) return;
      const layers = [];
      const coords = puntos.map(p => [p.lat, p.lng]);
      const color  = ESTADO_CONFIG[op.ultima_marca]?.color || "#00B4D8";
      const poly   = L.polyline(coords, { color, weight: 3, opacity: 0.9, dashArray: "8,5" }).addTo(map);
      layers.push(poly);
      puntos.forEach((p, i) => {
        const mc = MARCA_CONFIG[p.tipo] || { color: "#94A3B8", label: p.tipo };
        const icn = L.divIcon({
          html: "<div style=\"width:26px;height:26px;border-radius:50%;background:" + mc.color +
                ";border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.25);display:flex;" +
                "align-items:center;justify-content:center;font-weight:900;font-size:10px;color:white\">" +
                (i+1) + "</div>",
          className: "", iconSize: [26,26], iconAnchor: [13,13]
        });
        const mk = L.marker([p.lat, p.lng], { icon: icn }).addTo(map).bindPopup(
          "<div style=\"font-family:sans-serif;padding:4px;min-width:140px\">" +
            "<div style=\"font-weight:800;color:" + mc.color + "\">" + mc.label + "</div>" +
            "<div style=\"font-size:11px;color:#6B7A8D;margin-top:4px\">Hora: " + p.hora + "</div>" +
            (p.placa ? "<div style=\"font-size:11px;color:#6B7A8D\">Vehiculo: " + p.placa + "</div>" : "") +
            "<a href=\"https://maps.google.com/?q=" + p.lat + "," + p.lng + "\" target=\"_blank\"" +
            " style=\"font-size:11px;color:#00B4D8;font-weight:700;display:block;margin-top:4px\">Ver GPS</a>" +
          "</div>"
        );
        layers.push(mk);
      });
      recorridoLayerRef.current = layers;
      try { map.fitBounds(coords, { padding: [40,40], maxZoom: 16 }); } catch {}
    } catch {}
  };

  // ---- Historico ----
  const dibujarHistorico = (grupos) => {
    const L = window.L;
    const map = mapInstanceRef.current;
    if (!L || !map) return;
    const allLayers = [], allBounds = [];
    grupos.forEach((grupo, gi) => {
      const color = COLORES_OP[gi % COLORES_OP.length];
      const puntos = grupo.marcaciones || [];
      if (!puntos.length) return;
      const coords = puntos.map(p => [p.lat, p.lng]);
      const poly = L.polyline(coords, { color, weight: 3, opacity: 0.85, dashArray: "8,5" }).addTo(map);
      allLayers.push(poly);
      coords.forEach(c => allBounds.push(c));
      puntos.forEach((p, i) => {
        const mc = MARCA_CONFIG[p.tipo] || { color: "#94A3B8", label: p.tipo };
        const icn = L.divIcon({
          html: "<div style=\"width:28px;height:28px;border-radius:50%;background:" + mc.color +
                ";border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.25);display:flex;" +
                "align-items:center;justify-content:center;font-weight:900;font-size:10px;color:white\">" +
                (i+1) + "</div>",
          className: "", iconSize: [28,28], iconAnchor: [14,14]
        });
        const mk = L.marker([p.lat,p.lng],{icon:icn}).addTo(map).bindPopup(
          "<div style=\"font-family:sans-serif;padding:4px;min-width:160px\">" +
            "<div style=\"font-weight:800;color:" + color + "\">" + grupo.nombre + "</div>" +
            "<span style=\"display:inline-block;padding:2px 8px;border-radius:8px;background:" + mc.color + "20;" +
            "color:" + mc.color + ";font-size:11px;font-weight:700\">" + mc.label + "</span>" +
            "<div style=\"font-size:11px;color:#6B7A8D;margin-top:4px\">Hora: " + p.hora + "</div>" +
            (p.placa ? "<div style=\"font-size:11px;color:#6B7A8D\">Vehiculo: " + p.placa + "</div>" : "") +
            "<a href=\"https://maps.google.com/?q=" + p.lat + "," + p.lng + "\" target=\"_blank\"" +
            " style=\"font-size:11px;color:#00B4D8;font-weight:700;display:block;margin-top:4px\">Ver en Google Maps</a>" +
          "</div>"
        );
        allLayers.push(mk);
      });
    });
    histLayersRef.current = allLayers;
    if (allBounds.length) { try { map.fitBounds(allBounds,{padding:[40,40],maxZoom:15}); } catch {} }
  };

  const buscarHistorico = async () => {
    setHistLoading(true);
    limpiarHistorico();
    try {
      const params = new URLSearchParams({ fecha: histFecha });
      if (histNombre) params.append("nombre", histNombre);
      if (histPlaca)  params.append("placa",  histPlaca);
      const r = await fetch(API_URL + "/gps/historico?" + params);
      const d = await r.json();
      const res = Array.isArray(d) ? d : [];
      setHistResultados(res);
      dibujarHistorico(res);
    } catch {}
    setHistLoading(false);
  };

  // ---- Filtros sidebar ----
  const operariosFiltrados = operarios.filter(op => {
    if (filtroEstado === "todos")    return true;
    if (filtroEstado === "activos")  return ["INGRESO","RETORNO"].includes(op.ultima_marca);
    if (filtroEstado === "almuerzo") return op.ultima_marca === "ALMUERZO";
    if (filtroEstado === "cierre")   return op.ultima_marca === "CIERRE";
    if (filtroEstado === "offline")  return isOffline(op.timestamp);
    return true;
  });

  const activos    = operarios.filter(o => ["INGRESO","RETORNO"].includes(o.ultima_marca));
  const enAlmuerzo = operarios.filter(o => o.ultima_marca === "ALMUERZO");
  const finalizados= operarios.filter(o => o.ultima_marca === "CIERRE");
  const offlines   = operarios.filter(o => isOffline(o.timestamp));


  // ============================================================
  // RENDER - sidebar vertical izquierda + mapa fullheight derecha
  // ============================================================
  return (
    <div style={{ display:"flex", height:"calc(100vh - 80px)", overflow:"hidden" }}>

      <style>{`
        @keyframes pulse-marker {
          0%,100%{ box-shadow:0 2px 12px rgba(0,0,0,0.3); transform:scale(1); }
          50%    { box-shadow:0 4px 24px rgba(0,0,0,0.5); transform:scale(1.08); }
        }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.25} }
        .leaflet-popup-content-wrapper{
          border-radius:12px!important;
          box-shadow:0 8px 32px rgba(0,0,0,0.15)!important;
        }
        .leaflet-popup-tip{ display:none; }
        .leaflet-container{ cursor:grab; }
        .leaflet-container.leaflet-drag-target{ cursor:grabbing; }
        .apex-sb::-webkit-scrollbar{ width:3px; }
        .apex-sb::-webkit-scrollbar-thumb{ background:#DDE6EF; border-radius:4px; }
      `}</style>

      {/* ======================================================
          SIDEBAR - panel izquierdo comprimido, fondo oscuro
      ====================================================== */}
      <div className="apex-sb" style={{
        width: panelCollapsed ? 0 : 196,
        flexShrink: 0,
        background: "#0D1B2A",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        overflowX: "hidden",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        transition: "width 0.3s ease, opacity 0.3s ease",
        opacity: panelCollapsed ? 0 : 1,
      }}>

        {/* Header sidebar */}
        <div style={{ padding:"14px 12px 10px", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize:11, fontWeight:900, color:"#fff", letterSpacing:1 }}>MAPA GPS</div>
          <div style={{ fontSize:9, color:"#4A90D9", letterSpacing:2, marginTop:1 }}>
            {modoMapa === "vivo" ? "SEGUIMIENTO EN VIVO" : "HISTORICO DE RUTAS"}
          </div>
        </div>

        {/* Tabs vivo / historico */}
        <div style={{ display:"flex", padding:"8px 10px", gap:5,
          borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
          {[["vivo","EN VIVO","#06D6A0"],["historico","HIST.","#8B5CF6"]].map(([k,l,col])=>(
            <div key={k}
              onClick={()=>{
                setModoMapa(k);
                limpiarHistorico();
                limpiarRecorrido();
                setSelOp(null);
                setTimeout(()=>mapInstanceRef.current?.invalidateSize(),150);
              }}
              style={{ flex:1, padding:"5px 0", borderRadius:8, cursor:"pointer",
                textAlign:"center", fontWeight:700, fontSize:10,
                background: modoMapa===k ? col+"22" : "transparent",
                color: modoMapa===k ? col : "#8892A4",
                border: "1px solid "+(modoMapa===k ? col+"50" : "transparent"),
                transition:"all 0.15s",
                display:"flex", alignItems:"center", justifyContent:"center", gap:4 }}>
              {k==="vivo" && (
                <span style={{
                  display:"inline-block", width:5, height:5, borderRadius:"50%",
                  background: modoMapa===k ? "#06D6A0" : "#8892A4",
                  animation: modoMapa===k ? "blink 2s infinite" : "none",
                  flexShrink:0
                }}/>
              )}
              {l}
            </div>
          ))}
        </div>

        {/* ---- MODO VIVO ---- */}
        {modoMapa === "vivo" && (<>

          {/* KPIs */}
          <div style={{ padding:"8px 10px",
            borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:5 }}>
              {[
                { label:"ACTIVOS",  val:activos.length,    color:"#06D6A0", id:"activos"  },
                { label:"ALMUERZO", val:enAlmuerzo.length, color:"#F59E0B", id:"almuerzo" },
                { label:"CIERRE",   val:finalizados.length,color:"#8B5CF6", id:"cierre"   },
                { label:"OFFLINE",  val:offlines.length,   color:"#EF4444", id:"offline"  },
              ].map(k=>(
                <div key={k.id}
                  onClick={()=>setFiltroEstado(filtroEstado===k.id?"todos":k.id)}
                  style={{ padding:"7px 6px", borderRadius:8, cursor:"pointer",
                    background: filtroEstado===k.id ? k.color+"22" : "rgba(255,255,255,0.04)",
                    border:"1px solid "+(filtroEstado===k.id ? k.color+"60" : "transparent"),
                    textAlign:"center", transition:"all 0.15s" }}>
                  <div style={{ fontSize:18, fontWeight:900, color:k.color,
                    lineHeight:1 }}>{k.val}</div>
                  <div style={{ fontSize:8, fontWeight:700, color:k.color+"AA",
                    letterSpacing:0.5, marginTop:2 }}>{k.label}</div>
                </div>
              ))}
            </div>
            {/* Total + tiempo */}
            <div style={{ marginTop:6, display:"flex", justifyContent:"space-between",
              alignItems:"center", padding:"4px 2px" }}>
              <span style={{ fontSize:9, color:"#8892A4" }}>
                Total rastreados:
                {" "}<strong style={{ color:"#00B4D8" }}>{operarios.length}</strong>
              </span>
              {lastUpdate && (
                <span style={{ fontSize:9, color:"#8892A4" }}>
                  {lastUpdate.toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit"})}
                </span>
              )}
            </div>
          </div>

          {/* Controles refresh + GPS */}
          <div style={{ padding:"7px 10px",
            borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:6 }}>
              <div style={{ width:6, height:6, borderRadius:"50%", flexShrink:0,
                background: gpsActivo ? "#06D6A0" : "#EF4444",
                boxShadow: gpsActivo ? "0 0 5px #06D6A0" : "none",
                animation: gpsActivo ? "blink 2s infinite" : "none" }}/>
              <span style={{ fontSize:9, color:"#8892A4", flex:1 }}>
                {gpsActivo ? "GPS activo" : "GPS inactivo"}
              </span>
            </div>
            <div style={{ display:"flex", gap:5, alignItems:"center" }}>
              <select value={refreshInterval}
                onChange={e=>setRefreshInterval(Number(e.target.value))}
                style={{ flex:1, padding:"4px 6px", borderRadius:6,
                  border:"1px solid rgba(255,255,255,0.1)",
                  background:"rgba(255,255,255,0.06)", color:"#fff",
                  fontSize:10, fontWeight:700, cursor:"pointer" }}>
                <option value={30}>30s</option>
                <option value={60}>1 min</option>
                <option value={120}>2 min</option>
                <option value={300}>5 min</option>
              </select>
              <button onClick={cargarOperarios}
                style={{ padding:"4px 8px", borderRadius:6,
                  border:"1px solid rgba(255,255,255,0.12)",
                  background:"rgba(255,255,255,0.06)", color:"#fff",
                  fontSize:9, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>
                {loading ? "..." : "UPDATE"}
              </button>
            </div>
          </div>

          {/* Alerta offline */}
          {offlines.length > 0 && (
            <div style={{ margin:"6px 10px", padding:"6px 8px", borderRadius:8,
              background:"#F59E0B14", border:"1px solid #F59E0B40" }}>
              <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:3 }}>
                <div style={{ width:6, height:6, borderRadius:"50%",
                  background:"#F59E0B", flexShrink:0 }}/>
                <span style={{ fontSize:9, fontWeight:700, color:"#F59E0B" }}>
                  {offlines.length} SIN SENAL
                </span>
              </div>
              {offlines.map(o=>(
                <div key={o.username} style={{ fontSize:9, color:"#F59E0BAA",
                  paddingLeft:11, lineHeight:1.4 }}>
                  {o.nombre||o.username}
                </div>
              ))}
            </div>
          )}

          {/* Filtros rapidos */}
          <div style={{ padding:"6px 10px 4px",
            borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
              {[
                {id:"todos",    label:"Todos"   },
                {id:"activos",  label:"Activos" },
                {id:"almuerzo", label:"Almuerzo"},
                {id:"offline",  label:"Offline" },
              ].map(f=>(
                <div key={f.id} onClick={()=>setFiltroEstado(f.id)}
                  style={{ padding:"3px 7px", borderRadius:20, cursor:"pointer",
                    fontSize:9, fontWeight:700, transition:"all 0.12s",
                    background: filtroEstado===f.id ? "#00B4D8" : "rgba(255,255,255,0.07)",
                    color: filtroEstado===f.id ? "#fff" : "#8892A4",
                    border:"none" }}>
                  {f.label}
                </div>
              ))}
            </div>
          </div>

          {/* Lista operarios */}
          <div style={{ flex:1, padding:"6px 8px", display:"flex",
            flexDirection:"column", gap:4 }}>
            {operariosFiltrados.length === 0 && !loading && (
              <div style={{ textAlign:"center", padding:"20px 0", color:"#8892A4" }}>
                <div style={{ fontSize:20, opacity:0.25, marginBottom:6 }}>[ ]</div>
                <div style={{ fontSize:10, fontWeight:700 }}>Sin operarios</div>
                <div style={{ fontSize:9, marginTop:2, opacity:0.6 }}>GPS no activo</div>
              </div>
            )}
            {operariosFiltrados.map(op=>{
              const cfg     = ESTADO_CONFIG[op.ultima_marca]||ESTADO_CONFIG["SIN MARCAR"];
              const mins    = getMinutosDesdeUpdate(op.timestamp);
              const offline = isOffline(op.timestamp);
              const isSel   = selOp?.username === op.username;
              const dotCol  = offline ? "#F59E0B" : cfg.color;
              return (
                <div key={op.username}
                  onClick={()=>{
                    setSelOp(op);
                    const map    = mapInstanceRef.current;
                    const marker = markersRef.current[op.username];
                    if(map && marker){ map.setView([op.lat,op.lng],16); marker.openPopup(); }
                  }}
                  style={{ padding:"8px 10px", borderRadius:10, cursor:"pointer",
                    background: isSel ? dotCol+"20" : "rgba(255,255,255,0.04)",
                    border:"1px solid "+(isSel ? dotCol+"60" : "rgba(255,255,255,0.07)"),
                    transition:"all 0.15s" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                    {/* Avatar */}
                    <div style={{ width:28, height:28, borderRadius:"50%", flexShrink:0,
                      background:dotCol+"25", border:"2px solid "+dotCol+"80",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontWeight:900, fontSize:9, color:dotCol }}>
                      {(op.nombre||"??").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:"#fff",
                        whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                        {op.nombre||op.username}
                      </div>
                      <div style={{ fontSize:9, fontWeight:600, color:dotCol }}>
                        {offline ? "OFFLINE" : cfg.label}
                      </div>
                    </div>
                    <div style={{ width:6, height:6, borderRadius:"50%", flexShrink:0,
                      background:dotCol,
                      boxShadow: cfg.pulse&&!offline ? "0 0 5px "+dotCol : "none" }}/>
                  </div>
                  {mins !== null && (
                    <div style={{ fontSize:8, color: offline?"#F59E0B80":"#8892A4",
                      marginTop:3, paddingLeft:35 }}>
                      {mins<1 ? "Ahora mismo" : "Hace "+mins+" min"}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>)}

        {/* ---- MODO HISTORICO ---- */}
        {modoMapa === "historico" && (
          <div style={{ padding:"10px", display:"flex", flexDirection:"column", gap:8, flex:1 }}>
            <div style={{ fontSize:9, fontWeight:700, color:"#8B5CF6AA",
              letterSpacing:1 }}>CONSULTA HISTORICA</div>

            {/* Fecha */}
            <div>
              <div style={{ fontSize:9, color:"#8892A4", marginBottom:3 }}>FECHA</div>
              <input type="date" value={histFecha} onChange={e=>setHistFecha(e.target.value)}
                style={{ width:"100%", padding:"6px 8px",
                  border:"1px solid rgba(255,255,255,0.12)",
                  borderRadius:6, fontSize:11, background:"rgba(255,255,255,0.06)",
                  color:"#fff", boxSizing:"border-box" }}/>
            </div>

            {/* Operario */}
            <div>
              <div style={{ fontSize:9, color:"#8892A4", marginBottom:3 }}>OPERARIO</div>
              <select value={histNombre} onChange={e=>setHistNombre(e.target.value)}
                style={{ width:"100%", padding:"6px 8px",
                  border:"1px solid rgba(255,255,255,0.12)",
                  borderRadius:6, fontSize:11, background:"#0D1B2A",
                  color:"#fff", boxSizing:"border-box" }}>
                <option value="">Todos</option>
                {personalGps.map(p=><option key={p.nombre} value={p.nombre}>{p.nombre}</option>)}
              </select>
            </div>

            {/* Vehiculo */}
            <div>
              <div style={{ fontSize:9, color:"#8892A4", marginBottom:3 }}>VEHICULO</div>
              <select value={histPlaca} onChange={e=>setHistPlaca(e.target.value)}
                style={{ width:"100%", padding:"6px 8px",
                  border:"1px solid rgba(255,255,255,0.12)",
                  borderRadius:6, fontSize:11, background:"#0D1B2A",
                  color:"#fff", boxSizing:"border-box" }}>
                <option value="">Todos</option>
                {vehiculosGps.map(v=><option key={v.placa} value={v.placa}>{v.placa}</option>)}
              </select>
            </div>

            {/* Botones */}
            <div style={{ display:"flex", gap:5 }}>
              <button onClick={buscarHistorico} disabled={histLoading}
                style={{ flex:1, padding:"7px 0", borderRadius:8,
                  background:"#8B5CF6", color:"#fff",
                  border:"none", fontWeight:700, fontSize:10, cursor:"pointer" }}>
                {histLoading ? "..." : "BUSCAR"}
              </button>
              {histResultados.length>0 && (
                <button onClick={limpiarHistorico}
                  style={{ padding:"7px 10px", borderRadius:8,
                    background:"rgba(239,68,68,0.12)", color:"#EF4444",
                    border:"1px solid #EF444440", fontWeight:700,
                    fontSize:10, cursor:"pointer" }}>
                  X
                </button>
              )}
            </div>

            {/* Leyenda resultados */}
            {histResultados.map((g,i)=>(
              <div key={g.nombre} style={{ display:"flex", alignItems:"center", gap:6,
                padding:"5px 8px", borderRadius:8,
                background:COLORES_OP[i%COLORES_OP.length]+"18",
                border:"1px solid "+COLORES_OP[i%COLORES_OP.length]+"40" }}>
                <div style={{ width:7, height:7, borderRadius:"50%", flexShrink:0,
                  background:COLORES_OP[i%COLORES_OP.length] }}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:"#fff",
                    whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                    {g.nombre}
                  </div>
                  <div style={{ fontSize:8, color:"#8892A4" }}>
                    {g.marcaciones?.length||0} puntos GPS
                  </div>
                </div>
              </div>
            ))}

            {histResultados.length===0 && !histLoading && (
              <div style={{ fontSize:10, color:"#8892A4", textAlign:"center",
                marginTop:8, lineHeight:1.5 }}>
                Selecciona filtros y presiona Buscar
              </div>
            )}
          </div>
        )}
      </div>

      {/* ======================================================
          MAPA - ocupa todo el espacio restante
      ====================================================== */}
      <div style={{ flex:1, position:"relative", overflow:"hidden", minWidth:0 }}>
        
        {/* Botón toggle panel GPS */}
        <button
          onClick={() => setPanelCollapsed(!panelCollapsed)}
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            zIndex: 1000,
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
            boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
            transition: "all 0.3s ease"
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = "#1a2d42";
            e.currentTarget.style.transform = "scale(1.08)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "#0D1B2A";
            e.currentTarget.style.transform = "scale(1)";
          }}
          title={panelCollapsed ? "Mostrar panel GPS" : "Ocultar panel GPS"}
        >
          {panelCollapsed ? "☰" : "✕"}
        </button>

        <div ref={mapRef} style={{ width:"100%", height:"100%" }} />

        {/* Panel detalle operario flotante */}
        {selOp && modoMapa === "vivo" && (
          <PanelDetalle
            op={selOp}
            onCerrar={()=>setSelOp(null)}
            onVerRecorrido={(op)=>{ verRecorridoOperario(op); setSelOp(null); }}
          />
        )}

        {/* Overlay vacio */}
        {operarios.length === 0 && (
          <div style={{ position:"absolute", inset:0, display:"flex",
            flexDirection:"column", alignItems:"center", justifyContent:"center",
            background:"rgba(240,244,248,0.82)", pointerEvents:"none" }}>
            <div style={{ fontSize:40, marginBottom:10, opacity:0.18 }}>[ ]</div>
            <div style={{ fontSize:15, fontWeight:700, color:"#0D1B2A" }}>
              Sin senales GPS activas
            </div>
            <div style={{ fontSize:11, color:"#6B7A8D", marginTop:4 }}>
              Esperando ubicacion de los operarios
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export { TruckIcon };
export default MapaOperarios;
