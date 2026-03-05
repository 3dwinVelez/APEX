import { useState, useEffect, useRef } from "react";
import { C, API_URL } from "../shared/constants";
import { Card, Btn, PageHeader, Spinner } from "../shared/ui";
import { useGPSTracking } from "../shared/hooks";

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

export { TruckIcon };
export default MapaOperarios;
