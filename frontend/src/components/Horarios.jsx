import { useState, useEffect, useRef } from "react";
import { C, API_URL } from "../shared/constants";
import { Card, Btn, PageHeader, Alert } from "../shared/ui";
import MapaOperarios from "./MapaOperarios";
import { useData } from "../context/DataContext";
import { can } from "../shared/permissions";

// ============================================================
// CONSTANTES
// ============================================================
const ORDEN_MARCAS = ["INGRESO", "ALMUERZO", "RETORNO", "CIERRE"];

const MARCAS_CFG = {
  INGRESO:  { label: "Inicio Jornada",   desc: "Registra tu entrada al trabajo",      color: "#2563EB", icon: "I" },
  ALMUERZO: { label: "Salida Almuerzo",  desc: "Registra tu salida a almorzar",       color: "#F59E0B", icon: "A" },
  RETORNO:  { label: "Retorno Almuerzo", desc: "Registra tu regreso del almuerzo",    color: "#06D6A0", icon: "R" },
  CIERRE:   { label: "Fin Jornada",      desc: "Registra tu salida al final del dia", color: "#8B5CF6", icon: "C" },
};

const ESTADO_CFG = {
  INGRESO:     { color: "#06D6A0", label: "En Jornada",  dot: true  },
  ALMUERZO:    { color: "#F59E0B", label: "En Almuerzo", dot: false },
  RETORNO:     { color: "#00B4D8", label: "Trabajando",  dot: true  },
  CIERRE:      { color: "#8B5CF6", label: "Finalizo",    dot: false },
  "SIN MARCAR":{ color: "#94A3B8", label: "Sin Iniciar", dot: false },
};

const MOTIVOS_EXTRA = [
  "Trafico pesado",
  "Incidente en via",
  "Problema mecanico",
  "Cliente demoro la atencion",
  "Condiciones climaticas adversas",
  "Desvio de ruta obligatorio",
  "Esperando turno en destino",
  "Orden adicional de servicio",
  "Otro (detallar en descripcion)",
];

const TIME_OPTIONS_12H = Array.from({ length: 48 }, (_, index) => {
  const totalMinutes = index * 30;
  const hour24 = Math.floor(totalMinutes / 60);
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const label = `${String(hour12).padStart(2, "0")}:${minutes} ${suffix}`;
  return { value: label, label };
});

// ============================================================
// HELPERS
// ============================================================
const fmtMins = (mins) => {
  if (!mins && mins !== 0) return "--";
  const h = Math.floor(Math.abs(mins) / 60);
  const m = Math.abs(mins) % 60;
  return `${h}h ${m}m`;
};

const horaAMins = (horaStr) => {
  if (!horaStr) return null;
  try {
    const clean = horaStr.replace(" AM","").replace(" PM","").trim();
    const parts = clean.split(":");
    const hh = parseInt(parts[0], 10);
    const mm = parseInt(parts[1], 10);
    let total = hh * 60 + mm;
    if (horaStr.includes("PM") && hh !== 12) total += 720;
    return total;
  } catch { return null; }
};

const ahoraEnMins = () => {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
};

const calcTiempoTrabajado = (historial) => {
  const ingreso  = historial.find(m => m.tipo === "INGRESO");
  const almuerzo = historial.find(m => m.tipo === "ALMUERZO");
  const retorno  = historial.find(m => m.tipo === "RETORNO");
  const cierre   = historial.find(m => m.tipo === "CIERRE");
  if (!ingreso) return 0;
  const parseH = (h) => {
    if (!h) return null;
    const parts = h.split(":");
    return parseInt(parts[0],10) * 60 + parseInt(parts[1],10);
  };
  const tIng = parseH(ingreso.hora);
  const tAlm = almuerzo ? parseH(almuerzo.hora) : null;
  const tRet = retorno  ? parseH(retorno.hora)  : null;
  const tCie = cierre   ? parseH(cierre.hora)   : null;
  const ahora = ahoraEnMins();
  let trabajado = 0;
  const fin1 = tAlm || (tCie !== null ? tCie : ahora);
  trabajado += Math.max(0, fin1 - tIng);
  if (tRet !== null) {
    const fin2 = tCie !== null ? tCie : ahora;
    trabajado += Math.max(0, fin2 - tRet);
  }
  return trabajado;
};

// ============================================================
// SUB-COMPONENTE: Contador vivo de horas
// ============================================================
const ContadorHoras = ({ inicioMins, finProgramadoMins, toleranciaMin, historial }) => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(iv);
  }, []);
  const trabajado  = calcTiempoTrabajado(historial);
  const programado = finProgramadoMins && inicioMins ? finProgramadoMins - inicioMins : 480;
  const porcentaje = Math.min(100, Math.round((trabajado / programado) * 100));
  const tolMin     = toleranciaMin || 0;
  const extra      = Math.max(0, trabajado - (programado + tolMin));
  const esExtra    = extra > 0;
  const barColor   = esExtra ? C.danger : trabajado >= programado * 0.85 ? C.warning : C.success;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: C.muted }}>TIEMPO TRABAJADO</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: barColor }}>
          {fmtMins(trabajado)} / {fmtMins(programado)}
        </span>
      </div>
      <div style={{ height: 5, background: C.border, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: porcentaje + "%", background: barColor,
          borderRadius: 4, transition: "width 0.5s" }} />
      </div>
      {esExtra && (
        <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6,
          padding: "4px 10px", borderRadius: 8, background: "#EF444412",
          border: "1px solid #EF444428" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.danger,
            boxShadow: "0 0 6px #EF4444", flexShrink: 0 }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: C.danger }}>
            HORA EXTRA: +{fmtMins(extra)}
          </span>
        </div>
      )}
    </div>
  );
};

// ============================================================
// SUB-COMPONENTE: Linea de tiempo de marcaciones
// ============================================================
const TimelineMarcaciones = ({ historial }) => {
  return (
    <div style={{ display: "flex", alignItems: "stretch", marginTop: 12 }}>
      {ORDEN_MARCAS.map((tipo, idx) => {
        const marca  = historial.find(m => m.tipo === tipo);
        const cfg    = MARCAS_CFG[tipo];
        const hecha  = !!marca;
        const esLast = idx === ORDEN_MARCAS.length - 1;
        const sigHecha = !esLast && !!historial.find(m => m.tipo === ORDEN_MARCAS[idx + 1]);
        return (
          <div key={tipo} style={{ display: "flex", alignItems: "center", flex: 1 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                background: hecha ? cfg.color : C.bg,
                border: "2px solid " + (hecha ? cfg.color : C.border),
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 900, fontSize: 10,
                color: hecha ? "#fff" : C.muted,
                boxShadow: hecha ? "0 0 8px " + cfg.color + "50" : "none",
                transition: "all 0.3s"
              }}>
                {cfg.icon}
              </div>
              <div style={{ marginTop: 4, textAlign: "center" }}>
                <div style={{ fontSize: 9, fontWeight: 700,
                  color: hecha ? cfg.color : C.muted, whiteSpace: "nowrap" }}>
                  {cfg.label.split(" ")[0].toUpperCase()}
                </div>
                {hecha ? (
                  <div style={{ fontSize: 9, fontWeight: 800, color: C.text }}>
                    {marca.hora ? marca.hora.substring(0,5) : "--:--"}
                  </div>
                ) : (
                  <div style={{ fontSize: 9, color: C.muted }}>--:--</div>
                )}
                {hecha && marca.latitud && (
                  <div
                    onClick={() => window.open(
                      "https://www.google.com/maps?q=" + marca.latitud + "," + marca.longitud + "&z=17",
                      "_blank"
                    )}
                    style={{ fontSize: 9, color: C.accent, fontWeight: 700,
                      cursor: "pointer", marginTop: 1, textDecoration: "underline" }}
                  >
                    GPS
                  </div>
                )}
                {hecha && marca.es_extra && (
                  <div style={{ fontSize: 8, fontWeight: 700, color: C.danger,
                    background: "#EF444412", borderRadius: 4,
                    padding: "1px 4px", marginTop: 2 }}>
                    +EXT
                  </div>
                )}
              </div>
            </div>
            {!esLast && (
              <div style={{ flex: 1, height: 2, marginBottom: 26,
                background: sigHecha ? cfg.color : C.border,
                transition: "background 0.3s"
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
};

// ============================================================
// SUB-COMPONENTE: Modal de justificacion de hora extra
// ============================================================
const ModalJustificacion = ({ minutos_extra, onGuardar, onCerrar, loading }) => {
  const [motivo,  setMotivo]  = useState("");
  const [detalle, setDetalle] = useState("");
  const valido = motivo !== "" && detalle.trim().length >= 10;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9999, padding: 16 }}>
      <div style={{ background: C.card, borderRadius: 16, padding: 28,
        maxWidth: 480, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>

        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 20 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "#EF444412",
            border: "1px solid #EF444428", display: "flex", alignItems: "center",
            justifyContent: "center", flexShrink: 0 }}>
            <div style={{ width: 16, height: 16, borderRadius: "50%", background: C.danger }} />
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15, color: C.danger, marginBottom: 4 }}>
              HORA EXTRA DETECTADA
            </div>
            <div style={{ fontSize: 12, color: C.muted }}>
              Se detectaron
              {" "}<strong style={{ color: C.danger }}>{fmtMins(minutos_extra)}</strong>{" "}
              de tiempo adicional. Justificacion obligatoria.
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.muted,
            marginBottom: 8, letterSpacing: 1 }}>MOTIVO PRINCIPAL *</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {MOTIVOS_EXTRA.map(m => (
              <div key={m} onClick={() => setMotivo(m)}
                style={{ padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                  fontSize: 11, fontWeight: 600, transition: "all 0.15s",
                  background: motivo === m ? "#EF444412" : C.bg,
                  border: "1px solid " + (motivo === m ? C.danger : C.border),
                  color: motivo === m ? C.danger : C.text }}>
                {m}
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.muted,
            marginBottom: 6, letterSpacing: 1 }}>DESCRIPCION DETALLADA * (min. 10 caracteres)</div>
          <textarea
            value={detalle}
            onChange={e => setDetalle(e.target.value)}
            rows={3}
            placeholder="Describe con detalle lo ocurrido..."
            style={{ width: "100%", padding: "10px 12px",
              border: "1px solid " + C.border, borderRadius: 8,
              fontSize: 12, resize: "vertical", fontFamily: "inherit",
              boxSizing: "border-box", background: C.bg }}
          />
          <div style={{ fontSize: 10, textAlign: "right", marginTop: 3,
            color: detalle.length >= 10 ? C.success : C.muted }}>
            {detalle.length} / 10 min
          </div>
        </div>

        <div style={{ padding: "8px 12px", borderRadius: 8, background: "#00B4D810",
          border: "1px solid #00B4D828", marginBottom: 18, fontSize: 11, color: "#00B4D8" }}>
          Esta justificacion sera revisada y aprobada por el supervisor.
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => valido && !loading && onGuardar({ motivo, detalle })}
            disabled={!valido || loading}
            style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none",
              background: valido ? C.danger : C.border, color: "#fff",
              fontWeight: 700, fontSize: 12, cursor: valido ? "pointer" : "not-allowed",
              opacity: loading ? 0.6 : 1, fontFamily: "inherit" }}>
            {loading ? "GUARDANDO..." : "ENVIAR JUSTIFICACION"}
          </button>
          <button onClick={onCerrar}
            style={{ padding: "11px 18px", borderRadius: 10,
              border: "1px solid " + C.border, background: C.bg,
              color: C.muted, fontWeight: 700, fontSize: 12,
              cursor: "pointer", fontFamily: "inherit" }}>
            CANCELAR
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// HORARIOS - COMPONENTE PRINCIPAL
// ============================================================
const Horarios = ({ onBack, user }) => {
  const { getData } = useData();
  // Nombre efectivo del usuario: nombre del perfil o username como fallback
  const nombreUsuario = (user?.nombre || user?.username || "").trim();
  const canCreateHorarios = can(user, "horarios", "create");
  const canEditHorarios = can(user, "horarios", "edit");
  const horariosReadOnlyStyle = { opacity: 0.55, pointerEvents: "none", filter: "grayscale(0.15)" };
  const [vista,          setVista]          = useState("menu");
  const [rutas,          setRutas]          = useState([]);
  const [personal,       setPersonal]       = useState([]);
  const [vehiculos,      setVehiculos]      = useState([]);
  const [novedadesTipo,  setNovedadesTipo]  = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [msg,            setMsg]            = useState(null);

  const [marcForm, setMarcForm] = useState({
    usuario: nombreUsuario || (user?.nombre || user?.username || ""),
    vehiculo_placa: "",
    ruta_id: null,
    novedad_tipo_id: null,
    novedad_descripcion: "",
  });
  const [resultMarca,    setResultMarca]    = useState(null);
  const [ultimaMarca,    setUltimaMarca]    = useState(null);
  const [cargandoUltima, setCargandoUltima] = useState(false);
  const [gpsEstado,      setGpsEstado]      = useState("idle");
  const [gpsCoordsActual,setGpsCoordsActual]= useState(null);
  const [showJustif,     setShowJustif]     = useState(false);
  const [pendJustif,     setPendJustif]     = useState(null);
  // Rutas asignadas al usuario logueado hoy
  const [rutasUsuario,   setRutasUsuario]   = useState([]);

  const [rutaForm, setRutaForm] = useState({
    fecha: new Date().toISOString().split("T")[0],
    placa: "", empleados: [], notas: "",
    h_inicio: "08:00 AM", h_fin: "05:00 PM",
    tolerancia_minutos: 15, viaticos: 0,
  });
  const [empSeleccionados, setEmpSeleccionados] = useState([]);

  const [monitorRutas,     setMonitorRutas]     = useState([]);
  const [monitorFecha,     setMonitorFecha]      = useState(new Date().toISOString().split("T")[0]);
  const [monitorLoading,   setMonitorLoading]    = useState(false);
  const [justifPendientes, setJustifPendientes]  = useState([]);

  const marcaHabilitada = (tipo) => {
    if (ultimaMarca === null) return tipo === "INGRESO";
    if (ultimaMarca === "CIERRE") return false;
    const idx = ORDEN_MARCAS.indexOf(ultimaMarca);
    return tipo === ORDEN_MARCAS[idx + 1];
  };
  const proximaMarca = ultimaMarca === null ? "INGRESO"
    : ultimaMarca === "CIERRE" ? null
    : ORDEN_MARCAS[ORDEN_MARCAS.indexOf(ultimaMarca) + 1];

  useEffect(() => {
    getData("personal", "/personal").then(d=>setPersonal(Array.isArray(d)?d:[])).catch(()=>{});
    getData("vehiculos", "/vehiculos").then(d=>setVehiculos(Array.isArray(d)?d:[])).catch(()=>{});
    fetch(API_URL + "/novedades-tipo").then(r=>r.json()).then(d=>setNovedadesTipo(Array.isArray(d)?d:[])).catch(()=>{});
    fetch(API_URL + "/rutas").then(r=>r.json()).then(d=>setRutas(Array.isArray(d)?d:[])).catch(()=>{});
  }, [getData]);

  const getEmpleadoClave = (empleado) =>
    ((empleado?.username || empleado?.nombre || "").trim());

  const getEmpleadoNombreVisible = (valor) => {
    const normalized = (valor || "").trim().toLowerCase();
    const match = personal.find((item) => {
      const nombre = (item?.nombre || "").trim().toLowerCase();
      const username = (item?.username || "").trim().toLowerCase();
      return normalized === nombre || normalized === username;
    });
    return match?.nombre || valor;
  };

  // Cargar rutas asignadas al usuario - funcion reutilizable
  const cargarRutasUsuario = () => {
    if (!nombreUsuario) return;
    const hoy = new Date().toISOString().split("T")[0];
    fetch(API_URL + "/rutas?fecha=" + hoy)
      .then(r=>r.json())
      .then(d => {
        const todas = Array.isArray(d) ? d : [];
        const currentAliases = new Set(
          [
            nombreUsuario,
            (user?.username || "").trim(),
            (user?.nombre || "").trim(),
            (() => {
              const match = personal.find((item) => ((item?.username || "").trim().toLowerCase()) === ((user?.username || "").trim().toLowerCase()));
              return match?.nombre || "";
            })(),
          ]
            .map((value) => (value || "").trim().toLowerCase())
            .filter(Boolean)
        );
        const mias = todas.filter(r => {
          const equipo = r.equipo || r.empleados || [];
          return equipo.some(e => {
            const ev = (e || "").trim().toLowerCase();
            return currentAliases.has(ev);
          });
        });
        setRutasUsuario(mias);
        if (mias.length === 1) {
          setMarcForm(prev => ({
            ...prev,
            vehiculo_placa: mias[0].placa || "",
            ruta_id: mias[0].id ? String(mias[0].id) : null,
          }));
        } else if (mias.length === 0) {
          setMarcForm(prev => ({ ...prev, vehiculo_placa: "", ruta_id: null }));
        }
      })
      .catch(()=>{});
  };

  useEffect(() => { cargarRutasUsuario(); }, [nombreUsuario, personal, user]);

  useEffect(() => {
    if (vista !== "marcacion") return;
    if (!gpsCoordsActual) return;
    const iv = setInterval(() => {
      if (!gpsCoordsActual) return;
      fetch(API_URL + "/gps/ping", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: (user?.username || "").trim(),
          nombre:   (user?.nombre || user?.username || nombreUsuario || "").trim(),
          lat: gpsCoordsActual.lat, lng: gpsCoordsActual.lon,
          precision: gpsCoordsActual.precision,
        }),
      }).catch(()=>{});
    }, 120000);
    return () => clearInterval(iv);
  }, [vista, gpsCoordsActual]);

  // Cargar ultima marcacion del usuario - funcion reutilizable
  const cargarUltimaMarca = () => {
    if (!nombreUsuario) return;
    setCargandoUltima(true);
    const hoy = new Date().toISOString().split("T")[0];
    fetch(API_URL + "/asistencia?usuario=" + encodeURIComponent(nombreUsuario) + "&fecha=" + hoy)
      .then(r=>r.json())
      .then(d => {
        const registros = Array.isArray(d) ? d : [];
        const usernameLocal = (user?.username || "").trim().toLowerCase();
        const mios = registros.filter(r => {
          const ru = (r.usuario || "").trim().toLowerCase();
          return ru === nombreUsuario.toLowerCase() || ru === usernameLocal;
        });
        if (mios.length > 0) {
          // El ultimo en el array (ORDER BY id ASC) es el mas reciente
          const ultima = mios[mios.length - 1];
          setUltimaMarca(ultima.tipo_marca || ultima.tipo || null);
        } else {
          setUltimaMarca(null);
        }
      })
      .catch(()=>{})
      .finally(()=>setCargandoUltima(false));
  };

  useEffect(() => { cargarUltimaMarca(); }, [nombreUsuario]);

  // ---- GPS OBLIGATORIO ----
  const GPS_PRECISION_OK = 80;

  const obtenerGPS = () => new Promise((res) => {
    setGpsEstado("obteniendo");
    if (!navigator.geolocation) {
      setGpsEstado("error");
      return res(null);
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude, precision: pos.coords.accuracy };
        setGpsCoordsActual(coords);
        if (coords.precision <= GPS_PRECISION_OK) {
          setGpsEstado("ok");
          res(coords);
          return;
        }
        setGpsEstado("refinando");
        let mejor = coords;
        let watchId = null;
        let done = false;
        const finish = (cf) => {
          if (done) return;
          done = true;
          if (watchId !== null) navigator.geolocation.clearWatch(watchId);
          setGpsCoordsActual(cf);
          setGpsEstado("ok");
          res(cf);
        };
        const tOut = setTimeout(() => finish(mejor), 8000);
        watchId = navigator.geolocation.watchPosition(
          (p2) => {
            const c2 = { lat: p2.coords.latitude, lon: p2.coords.longitude, precision: p2.coords.accuracy };
            if (c2.precision < mejor.precision) { mejor = c2; setGpsCoordsActual(c2); }
            if (c2.precision <= GPS_PRECISION_OK) { clearTimeout(tOut); finish(mejor); }
          },
          () => { clearTimeout(tOut); finish(mejor); },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
        );
      },
      () => { setGpsEstado("error"); res(null); },
      { timeout: 6000, maximumAge: 0, enableHighAccuracy: true }
    );
  });

  // ---- MARCACION ----
  const realizarMarcacion = async (tipo) => {
    if (!canCreateHorarios) {
      setMsg({ tipo: "error", texto: "No tienes permisos para registrar marcaciones." });
      return;
    }
    if (!marcaHabilitada(tipo)) return;
    if (!marcForm.usuario) { setMsg({ tipo: "error", texto: "Usuario no identificado" }); return; }
    // BLOQUEO: sin ruta asignada no se puede marcar
    if (!marcForm.ruta_id) {
      setMsg({
        tipo: "error",
        texto: "No tienes una ruta asignada para hoy. El supervisor debe planear tu ruta antes de poder marcar."
      });
      return;
    }
    if (!marcForm.vehiculo_placa) {
      setMsg({ tipo: "error", texto: "No se encontro vehiculo asignado a tu ruta." });
      return;
    }
    setLoading(true);
    setMsg(null);
    const gps = await obtenerGPS();
    if (!gps) {
      setMsg({ tipo: "error", texto: "GPS obligatorio: activa la ubicacion en tu navegador para poder marcar." });
      setLoading(false);
      return;
    }
    const payload = {
      usuario:             (marcForm.usuario || "").trim(),
      vehiculo_placa:      marcForm.vehiculo_placa || "",
      ruta_id:             marcForm.ruta_id || null,
      novedad_tipo_id:     marcForm.novedad_tipo_id || null,
      novedad_descripcion: marcForm.novedad_descripcion || "",
      tipo_marca:          tipo,
      latitud:             gps.lat,
      longitud:            gps.lon,
    };
    try {
      const r = await fetch(API_URL + "/marcaciones", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) {
        setMsg({ tipo: "error", texto: "Error " + r.status + ": " + (data.detail || "Error del servidor") });
        setLoading(false);
        return;
      }
      const hora = new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
      setResultMarca({ ...data, tipo, gps, hora });
      setUltimaMarca(tipo);
      fetch(API_URL + "/gps/ping", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: (user?.username || "").trim(),
          nombre:   (user?.nombre || user?.username || marcForm.usuario || "").trim(),
          lat: gps.lat, lng: gps.lon, precision: gps.precision,
        }),
      }).catch(()=>{});
      setTimeout(() => cargarUltimaMarca(), 800);
      if (tipo === "CIERRE") {
        setGpsEstado("idle");
        setGpsCoordsActual(null);
      }
      if (data.alerta && data.minutos_extra > 0) {
        setPendJustif({ tipo, minutos_extra: data.minutos_extra, gps });
        setShowJustif(true);
      } else {
        setMsg({ tipo: "success", texto: MARCAS_CFG[tipo].label + " registrado a las " + hora });
      }
    } catch (err) {
      setMsg({ tipo: "error", texto: "Error de red. Verifica tu conexion." });
    }
    setLoading(false);
  };

  const enviarJustificacion = async ({ motivo, detalle }) => {
    if (!pendJustif) return;
    setLoading(true);
    try {
      await fetch(API_URL + "/marcaciones/justificacion", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario: marcForm.usuario,
          tipo_marca: pendJustif.tipo,
          minutos_extra: pendJustif.minutos_extra,
          motivo,
          descripcion: detalle,
          latitud: pendJustif.gps?.lat,
          longitud: pendJustif.gps?.lon,
          estado: "pendiente",
        }),
      });
      setShowJustif(false);
      setPendJustif(null);
      setMsg({ tipo: "success", texto: "Marcacion y justificacion enviadas al supervisor." });
    } catch {
      setMsg({ tipo: "error", texto: "Error enviando justificacion. Intenta de nuevo." });
    }
    setLoading(false);
  };

  // ---- PLANEACION ----
  const crearRuta = async () => {
    if (!canCreateHorarios) {
      setMsg({ tipo: "error", texto: "No tienes permisos para crear rutas." });
      return;
    }
    if (!rutaForm.placa) { setMsg({ tipo: "error", texto: "Selecciona un vehiculo" }); return; }
    if (empSeleccionados.length === 0) { setMsg({ tipo: "error", texto: "Agrega al menos un empleado" }); return; }
    setLoading(true);
    try {
      const resp = await fetch(API_URL + "/rutas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...rutaForm, empleados: empSeleccionados }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || "Error al crear");
      setMsg({ tipo: "success", texto: "Ruta creada correctamente" });
      setRutaForm({ fecha: new Date().toISOString().split("T")[0], placa: "",
        empleados: [], notas: "", h_inicio: "08:00 AM", h_fin: "05:00 PM",
        tolerancia_minutos: 15, viaticos: 0 });
      setEmpSeleccionados([]);
      // Recargar rutas recientes Y rutas del usuario
      fetch(API_URL + "/rutas").then(r=>r.json()).then(d=>setRutas(Array.isArray(d)?d:[])).catch(()=>{});
      cargarRutasUsuario();
    } catch (e) { setMsg({ tipo: "error", texto: "Error al crear ruta: " + (e.message||"") }); }
    setLoading(false);
  };

  // ---- MONITOR ----
  const cargarMonitor = () => {
    fetch(API_URL + "/monitor/rutas?fecha=" + monitorFecha)
      .then(r=>r.json())
      .then(d => {
        const lista = Array.isArray(d) ? d : [];
        setMonitorRutas(lista);
        const pend = [];
        lista.forEach(ruta => {
          (ruta.empleados||[]).forEach(emp => {
            if (emp.es_extra && emp.ultima_marca === "CIERRE") {
              pend.push({ ...emp, placa: ruta.placa, ruta_id: ruta.id });
            }
          });
        });
        setJustifPendientes(pend);
      })
      .catch(()=>{});
  };

  const cargarMonitorConLoading = () => {
    setMonitorLoading(true);
    fetch(API_URL + "/monitor/rutas?fecha=" + monitorFecha)
      .then(r => r.json())
      .then(d => {
        const lista = Array.isArray(d) ? d : [];
        setMonitorRutas(lista);
        const pend = [];
        lista.forEach(ruta => {
          (ruta.empleados || []).forEach(emp => {
            if (emp.es_extra && emp.ultima_marca === "CIERRE") {
              pend.push({ ...emp, placa: ruta.placa, ruta_id: ruta.id });
            }
          });
        });
        setJustifPendientes(pend);
      })
      .catch(() => {})
      .finally(() => setMonitorLoading(false));
  };

  useEffect(() => {
    if (vista !== "monitor") return;
    cargarMonitorConLoading();
    const iv = setInterval(cargarMonitorConLoading, 15000);
    return () => clearInterval(iv);
  }, [vista, monitorFecha]);

  // ============================================================
  // VISTA: MAPA GPS
  // ============================================================
  if (vista === "mapa") return (
    <div>
      <PageHeader title="Mapa GPS" subtitle="Seguimiento en vivo e historico"
        onBack={() => { setVista("menu"); cargarUltimaMarca(); }} />
      <MapaOperarios user={user} />
    </div>
  );

  // ============================================================
  // VISTA: MONITOR EN VIVO
  // ============================================================
  if (vista === "monitor") return (
    <div>
      <PageHeader
        title="Monitor en Vivo"
        subtitle="Estado actual de rutas y personal"
        onBack={() => { setVista("menu"); cargarUltimaMarca(); }}
        action={
          justifPendientes.length > 0 ? (
            <div style={{ padding: "6px 12px", borderRadius: 8,
              background: "#EF444412", border: "1px solid #EF444428",
              fontSize: 11, fontWeight: 700, color: C.danger }}>
              {justifPendientes.length} hora(s) extra pendiente(s)
            </div>
          ) : null
        }
      />

      <div style={{ display: "flex", gap: 10, alignItems: "center",
        marginBottom: 18, flexWrap: "wrap" }}>
        <input type="date" value={monitorFecha}
          onChange={e => setMonitorFecha(e.target.value)}
          style={{ padding: "9px 12px", border: "1px solid " + C.border,
            borderRadius: 8, fontSize: 13, background: C.card }} />
        <Btn onClick={cargarMonitorConLoading} disabled={monitorLoading}>
          {monitorLoading ? "ACTUALIZANDO..." : "ACTUALIZAR"}
        </Btn>
        <span style={{ fontSize: 12, color: C.muted }}>
          {monitorRutas.length} ruta(s) - Auto-actualiza cada 15s
        </span>
      </div>

      {monitorRutas.length > 0 && (
        <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
          {[
            { label: "RUTAS HOY",      val: monitorRutas.length,                                           color: C.accent  },
            { label: "OPERARIOS",      val: monitorRutas.reduce((a,r)=>a+r.total_empleados,0),             color: "#8B5CF6" },
            { label: "ACTIVOS",        val: monitorRutas.reduce((a,r)=>a+r.empleados_activos,0),           color: C.success },
            { label: "CON HORA EXTRA", val: justifPendientes.length,                                       color: C.danger  },
          ].map(k => (
            <div key={k.label} style={{ flex: 1, minWidth: 100, padding: "12px 16px",
              borderRadius: 10, background: k.color + "10",
              border: "1px solid " + k.color + "25" }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: k.color }}>{k.val}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: k.color, letterSpacing: 1 }}>
                {k.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {monitorRutas.length === 0 && (
        <Card style={{ textAlign: "center", padding: 48, color: C.muted }}>
          <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.3 }}>[ ]</div>
          <div style={{ fontWeight: 700 }}>No hay rutas para esta fecha</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Crea rutas en Planeacion</div>
        </Card>
      )}

      {monitorRutas.map(ruta => {
        const inicioMins = horaAMins(ruta.h_inicio);
        const finMins    = horaAMins(ruta.h_fin);
        const enRuta     = ruta.empleados_activos > 0;
        const colorRuta  = enRuta ? C.success : C.muted;
        return (
          <Card key={ruta.id} style={{ marginBottom: 16,
            borderLeft: "4px solid " + colorRuta }}>

            <div style={{ display: "flex", justifyContent: "space-between",
              alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>{ruta.placa}</div>
                  <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 10,
                    fontWeight: 700, background: colorRuta + "14",
                    color: colorRuta, border: "1px solid " + colorRuta + "28" }}>
                    {enRuta ? "EN RUTA" : "INACTIVA"}
                  </span>
                  {enRuta && (
                    <div style={{ width: 7, height: 7, borderRadius: "50%",
                      background: C.success, boxShadow: "0 0 6px " + C.success }} />
                  )}
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                  {ruta.h_inicio} - {ruta.h_fin}
                  {" | Tolerancia: "}{ruta.tolerancia}{"min"}
                  {ruta.viaticos > 0 && (" | Viaticos: $" + ruta.viaticos.toLocaleString())}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: colorRuta }}>
                  {ruta.empleados_activos}/{ruta.total_empleados} activos
                </div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                  {new Date().toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit"})}
                </div>
              </div>
            </div>

            {(ruta.empleados || []).map(emp => {
              const estadoCfg  = ESTADO_CFG[emp.ultima_marca] || ESTADO_CFG["SIN MARCAR"];
              const historial  = emp.historial || [];
              const tieneExtra = emp.es_extra && emp.minutos_extra > 0;
              return (
                <div key={emp.nombre} style={{ marginBottom: 10, padding: "14px 16px",
                  borderRadius: 10, background: estadoCfg.color + "08",
                  border: "1px solid " + (tieneExtra ? C.danger : estadoCfg.color) + "22" }}>

                  <div style={{ display: "flex", justifyContent: "space-between",
                    alignItems: "center", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%",
                        background: estadoCfg.color + "18",
                        border: "2px solid " + estadoCfg.color,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 900, fontSize: 11, color: estadoCfg.color, flexShrink: 0 }}>
                        {(emp.nombre||"??").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{emp.nombre}</div>
                        {emp.tiempo_en_ruta_min !== null && emp.tiempo_en_ruta_min > 0 && (
                          <div style={{ fontSize: 10, color: C.muted }}>
                            {"En ruta: " + fmtMins(emp.tiempo_en_ruta_min)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {tieneExtra && (
                        <span style={{ padding: "3px 8px", borderRadius: 8, fontSize: 9,
                          fontWeight: 700, background: "#EF444412",
                          color: C.danger, border: "1px solid #EF444428" }}>
                          {"+" + fmtMins(emp.minutos_extra) + " EXTRA"}
                        </span>
                      )}
                      <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 10,
                        fontWeight: 700, background: estadoCfg.color + "14",
                        color: estadoCfg.color, border: "1px solid " + estadoCfg.color + "28",
                        display: "flex", alignItems: "center", gap: 5 }}>
                        {estadoCfg.dot && (
                          <span style={{ display: "inline-block", width: 6, height: 6,
                            borderRadius: "50%", background: estadoCfg.color,
                            boxShadow: "0 0 5px " + estadoCfg.color }} />
                        )}
                        {estadoCfg.label}
                      </span>
                    </div>
                  </div>

                  <TimelineMarcaciones historial={historial} />

                  {historial.length > 0 && (
                    <ContadorHoras
                      inicioMins={inicioMins}
                      finProgramadoMins={finMins}
                      toleranciaMin={ruta.tolerancia}
                      historial={historial}
                    />
                  )}

                  {emp.latitud && emp.longitud && (
                    <div style={{ marginTop: 8, display: "flex", alignItems: "center",
                      gap: 6, fontSize: 10 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%",
                        background: C.accent }} />
                      <span style={{ color: C.muted }}>Ultima posicion:</span>
                      <span
                        onClick={() => window.open(
                          "https://www.google.com/maps?q=" + emp.latitud + "," + emp.longitud + "&z=17",
                          "_blank"
                        )}
                        style={{ color: C.accent, fontWeight: 700, cursor: "pointer",
                          textDecoration: "underline" }}>
                        Ver en Google Maps
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
        );
      })}
    </div>
  );

  // ============================================================
  // VISTA: MARCACION
  // ============================================================
  if (vista === "marcacion") return (
    <div>
      {showJustif && pendJustif && (
        <ModalJustificacion
          minutos_extra={pendJustif.minutos_extra}
          onGuardar={enviarJustificacion}
          onCerrar={() => { setShowJustif(false); setPendJustif(null); }}
          loading={loading}
        />
      )}

      <PageHeader title="Marcacion de Personal"
        subtitle="Registra tu jornada laboral" onBack={() => { setVista("menu"); setGpsEstado("idle"); setGpsCoordsActual(null); cargarUltimaMarca(); }} />
      {msg && <Alert tipo={msg.tipo} texto={msg.texto} onClose={() => setMsg(null)} />}
      {!canCreateHorarios && (
        <div style={{
          marginBottom: 14,
          padding: "10px 14px",
          borderRadius: 10,
          background: "#F59E0B10",
          border: "1px solid #F59E0B30",
          color: "#9A6700",
          fontSize: 12,
          fontWeight: 700
        }}>
          Modo solo lectura. Puedes revisar tu jornada, pero no registrar marcaciones.
        </div>
      )}
      <div style={!canCreateHorarios ? horariosReadOnlyStyle : {}}>

      {/* Banner GPS - solo visible si la jornada no esta cerrada */}
      {ultimaMarca !== "CIERRE" && <div style={{ padding: "10px 14px", borderRadius: 10, marginBottom: 16,
        background: gpsEstado === "ok" ? "#06D6A010"
          : gpsEstado === "error" ? "#EF444410"
          : gpsEstado === "refinando" ? "#F59E0B10" : "#00B4D810",
        border: "1px solid " + (gpsEstado === "ok" ? "#06D6A028"
          : gpsEstado === "error" ? "#EF444428"
          : gpsEstado === "refinando" ? "#F59E0B28" : "#00B4D828"),
        display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
          background: gpsEstado === "ok" ? C.success
            : gpsEstado === "error" ? C.danger
            : gpsEstado === "refinando" ? "#F59E0B" : C.accent,
          boxShadow: gpsEstado === "ok" ? "0 0 6px " + C.success
            : gpsEstado === "refinando" ? "0 0 6px #F59E0B" : "none" }} />
        <div style={{ fontSize: 12, flex: 1 }}>
          {gpsEstado === "idle"       && <span style={{ color: C.accent, fontWeight: 600 }}>GPS se activara al marcar. Asegurate de tener permisos habilitados en tu navegador.</span>}
          {gpsEstado === "obteniendo" && <span style={{ color: C.accent, fontWeight: 600 }}>Obteniendo ubicacion GPS...</span>}
          {gpsEstado === "refinando"  && <span style={{ color: "#F59E0B", fontWeight: 600 }}>Mejorando precision GPS... {gpsCoordsActual ? "(" + Math.round(gpsCoordsActual.precision) + "m)" : ""}</span>}
          {gpsEstado === "ok"         && <span style={{ color: C.success, fontWeight: 600 }}>GPS activo {gpsCoordsActual ? "(" + Math.round(gpsCoordsActual.precision) + "m)" : ""}.</span>}
          {gpsEstado === "error"      && <span style={{ color: C.danger, fontWeight: 700 }}>GPS no disponible. Activa la ubicacion en tu navegador para poder marcar.</span>}
        </div>
        {gpsCoordsActual && (
          <span
            onClick={() => window.open(
              "https://www.google.com/maps?q=" + gpsCoordsActual.lat + "," + gpsCoordsActual.lon + "&z=16",
              "_blank"
            )}
            style={{ fontSize: 10, color: C.accent, fontWeight: 700,
              cursor: "pointer", textDecoration: "underline", whiteSpace: "nowrap" }}>
            Ver ubicacion
          </span>
        )}
      </div>}

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 11,
          letterSpacing: 0.5, color: C.muted }}>DATOS DE LA MARCACION</div>

        {/* Usuario logueado - solo lectura */}
        <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10,
          background: "#06D6A010", border: "1px solid #06D6A028",
          display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%",
            background: "#06D6A020", border: "2px solid #06D6A0",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: 11, color: "#06D6A0", flexShrink: 0 }}>
            {(nombreUsuario||"??").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13 }}>{nombreUsuario || "Sin usuario"}</div>
            <div style={{ fontSize: 10, color: "#06D6A0", fontWeight: 700 }}>
              {user?.rol?.toUpperCase() || "EMPLEADO"}
            </div>
          </div>
          <div style={{ marginLeft: "auto", fontSize: 10, color: C.muted }}>
            {rutasUsuario.length > 0
              ? rutasUsuario.length + " ruta(s) hoy"
              : "Sin rutas asignadas hoy"}
          </div>
        </div>

        {/* Sin rutas asignadas */}
        {rutasUsuario.length === 0 && (
          <div style={{ padding: "12px 14px", borderRadius: 10,
            background: "#F59E0B0D", border: "1px solid #F59E0B28",
            fontSize: 12, color: "#F59E0B", fontWeight: 600, marginBottom: 12 }}>
            No tienes rutas asignadas para hoy. Contacta a tu supervisor.
          </div>
        )}

        {/* Seleccionar ruta si hay mas de una */}
        {rutasUsuario.length > 1 && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: C.muted,
              display: "block", marginBottom: 4 }}>SELECCIONA TU RUTA DE HOY</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {rutasUsuario.map(r => {
                const seleccionada = marcForm.vehiculo_placa === r.placa;
                return (
                  <div key={r.placa}
                    onClick={() => setMarcForm(prev => ({
                      ...prev, vehiculo_placa: r.placa, ruta_id: r.id ? String(r.id) : null
                    }))}
                    style={{ padding: "8px 14px", borderRadius: 10, cursor: "pointer",
                      fontSize: 12, fontWeight: 700, transition: "all 0.15s",
                      background: seleccionada ? "#00B4D815" : C.bg,
                      border: "1px solid " + (seleccionada ? C.accent : C.border),
                      color: seleccionada ? C.accent : C.text }}>
                    <div>{r.placa}</div>
                    <div style={{ fontSize: 10, color: C.muted, fontWeight: 400 }}>
                      {r.h_inicio} - {r.h_fin}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Info de la ruta seleccionada */}
        {marcForm.vehiculo_placa && (
          <div style={{ padding: "8px 12px", borderRadius: 8,
            background: C.bg, border: "1px solid " + C.border,
            display: "flex", gap: 16, fontSize: 11, flexWrap: "wrap" }}>
            <div>
              <span style={{ color: C.muted }}>Vehiculo: </span>
              <strong>{marcForm.vehiculo_placa}</strong>
            </div>
            {rutasUsuario.find(r => r.placa === marcForm.vehiculo_placa) && (() => {
              const r = rutasUsuario.find(rt => rt.placa === marcForm.vehiculo_placa);
              return (
                <>
                  <div>
                    <span style={{ color: C.muted }}>Horario: </span>
                    <strong>{r.h_inicio} - {r.h_fin}</strong>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </Card>

      {marcForm.usuario && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.muted,
            marginBottom: 10, letterSpacing: 0.5 }}>ESTADO DE TU JORNADA HOY</div>
          <div style={{ display: "flex", alignItems: "stretch" }}>
            {ORDEN_MARCAS.map((tipo, idx) => {
              const cfg    = MARCAS_CFG[tipo];
              const yaHizo = ultimaMarca && ORDEN_MARCAS.indexOf(ultimaMarca) >= idx;
              const esProx = tipo === proximaMarca;
              const esLast = idx === ORDEN_MARCAS.length - 1;
              return (
                <div key={tipo} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                    <div style={{ width: 26, height: 26, borderRadius: "50%",
                      background: yaHizo ? cfg.color : esProx ? cfg.color + "25" : C.bg,
                      border: "2px solid " + (yaHizo ? cfg.color : esProx ? cfg.color : C.border),
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 9, fontWeight: 900,
                      color: yaHizo ? "#fff" : esProx ? cfg.color : C.muted }}>
                      {cfg.icon}
                    </div>
                    <div style={{ fontSize: 8, marginTop: 3, fontWeight: 700,
                      color: yaHizo ? cfg.color : esProx ? cfg.color : C.muted }}>
                      {tipo}
                    </div>
                  </div>
                  {!esLast && (
                    <div style={{ flex: 1, height: 2, marginBottom: 14,
                      background: yaHizo ? cfg.color : C.border }} />
                  )}
                </div>
              );
            })}
          </div>
          {!cargandoUltima && proximaMarca && (
            <div style={{ marginTop: 10, fontSize: 12, color: C.muted }}>
              {"Siguiente: "}
              <strong style={{ color: MARCAS_CFG[proximaMarca].color }}>
                {MARCAS_CFG[proximaMarca].label}
              </strong>
            </div>
          )}
          {!cargandoUltima && ultimaMarca === "CIERRE" && (
            <div style={{ marginTop: 10, fontSize: 12, color: "#8B5CF6", fontWeight: 700 }}>
              Jornada completada
            </div>
          )}
        </Card>
      )}

      {/* Bloqueo visual si no hay ruta asignada */}
      {rutasUsuario.length === 0 ? (
        <div style={{ padding:"24px", borderRadius:12, textAlign:"center",
          background:"#F59E0B08", border:"2px dashed #F59E0B40" }}>
          <div style={{ fontSize:28, marginBottom:8, opacity:0.4 }}>!</div>
          <div style={{ fontWeight:800, fontSize:14, color:"#F59E0B",
            marginBottom:6 }}>SIN RUTA ASIGNADA</div>
          <div style={{ fontSize:12, color:C.muted, lineHeight:1.6 }}>
            No puedes marcar sin una ruta asignada para hoy.
            <br/>Contacta a tu supervisor para que registre tu ruta.
          </div>
        </div>
      ) : (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
        {Object.entries(MARCAS_CFG).map(([tipo, m]) => {
          const habilitada = marcaHabilitada(tipo);
          const yaHizo     = ultimaMarca &&
            ORDEN_MARCAS.indexOf(ultimaMarca) >= ORDEN_MARCAS.indexOf(tipo);
          return (
            <Card key={tipo} onClick={habilitada && !loading ? () => realizarMarcacion(tipo) : null}
              style={{
                borderLeft: `4px solid ${habilitada ? m.color : "#E5E7EB"}`,
                opacity: habilitada ? 1 : 0.45,
                cursor: habilitada && !loading ? "pointer" : "not-allowed",
                background: yaHizo ? m.color + "08" : habilitada ? "#fff" : "#F9FAFB",
                transition: "all 0.2s", position: "relative",
                boxShadow: habilitada && !yaHizo ? `0 2px 12px ${m.color}20` : "none",
              }}
              onMouseEnter={e => { if (habilitada && !yaHizo) e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "none"; }}
            >
              {yaHizo && (
                <div style={{ position: "absolute", top: 12, right: 12, width: 22, height: 22,
                  borderRadius: "50%", background: m.color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, color: "white", fontWeight: 900 }}>✓</div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                  background: (habilitada ? m.color : "#6B7280") + "18",
                  border: `2px solid ${(habilitada ? m.color : "#6B7280")}30`,
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%",
                    background: habilitada ? m.color : "#6B7280",
                    boxShadow: habilitada ? `0 0 8px ${m.color}60` : "none" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: habilitada ? "#111111" : "#6B7280" }}>{m.label}</div>
                  <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>
                    {yaHizo ? "Registrado correctamente" : habilitada ? m.desc : "No disponible aun"}
                  </div>
                </div>
                {habilitada && !yaHizo && (
                  <div style={{ width: 32, height: 32, borderRadius: "50%",
                    background: m.color + "15", border: `1.5px solid ${m.color}40`,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke={m.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      )}

      {resultMarca && !showJustif && (
        <Card style={{ marginTop: 20, borderLeft: "4px solid #06D6A0",
          background: "#06D6A006" }}>
          <div style={{ fontWeight: 800, fontSize: 12, color: "#06D6A0",
            marginBottom: 10, letterSpacing: 0.5 }}>
            {(MARCAS_CFG[resultMarca.tipo]?.label||"").toUpperCase() + " REGISTRADO"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
            <div><span style={{ color: C.muted }}>Empleado: </span><strong>{marcForm.usuario}</strong></div>
            <div><span style={{ color: C.muted }}>Hora: </span><strong>{resultMarca.hora}</strong></div>
            <div><span style={{ color: C.muted }}>Vehiculo: </span><strong>{marcForm.vehiculo_placa||"--"}</strong></div>
            <div><span style={{ color: C.muted }}>Estado: </span><strong style={{ color: "#06D6A0" }}>Guardado</strong></div>
          </div>
          {resultMarca.gps?.lat && (
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10,
              padding: "8px 12px", background: "#00B4D810",
              borderRadius: 8, border: "1px solid #00B4D828" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.accent }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.accent }}>GPS CAPTURADO</div>
                <div style={{ fontSize: 9, color: C.muted }}>
                  {resultMarca.gps.lat.toFixed(6)}{", "}{resultMarca.gps.lon.toFixed(6)}
                  {resultMarca.gps.precision && (" (" + Math.round(resultMarca.gps.precision) + "m)")}
                </div>
              </div>
              <div onClick={() => window.open(
                "https://www.google.com/maps?q=" + resultMarca.gps.lat + "," + resultMarca.gps.lon + "&z=16",
                "_blank"
              )}
                style={{ padding: "6px 12px", borderRadius: 8, background: C.accent,
                  color: "white", fontSize: 10, fontWeight: 700,
                  cursor: "pointer", whiteSpace: "nowrap" }}>
                VER MAPA
              </div>
            </div>
          )}
        </Card>
      )}
      </div>
    </div>
  );

  // ============================================================
  // VISTA: PLANEACION DE RUTAS
  // ============================================================
  if (vista === "planeacion") return (
    <div>
      <PageHeader title="Planeacion de Rutas" subtitle="Crear y asignar rutas del dia"
        onBack={() => { setVista("menu"); setGpsEstado("idle"); setGpsCoordsActual(null); cargarUltimaMarca(); }} />
      {msg && <Alert tipo={msg.tipo} texto={msg.texto} onClose={() => setMsg(null)} />}
      {!canCreateHorarios && (
        <div style={{
          marginBottom: 14,
          padding: "10px 14px",
          borderRadius: 10,
          background: "#F59E0B10",
          border: "1px solid #F59E0B30",
          color: "#9A6700",
          fontSize: 12,
          fontWeight: 700
        }}>
          Modo solo lectura. Puedes revisar rutas, pero no crear ni asignar.
        </div>
      )}
      <div style={!canCreateHorarios ? horariosReadOnlyStyle : {}}>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 11,
          letterSpacing: 0.5, color: C.muted }}>NUEVA RUTA</div>

        {/* Fila 1: Fecha + Vehiculo + Notas */}
        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr 1fr",
          gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: C.muted,
              display: "block", marginBottom: 4 }}>FECHA</label>
            <input type="date" value={rutaForm.fecha}
              onChange={e=>setRutaForm(f=>({...f,fecha:e.target.value}))}
              style={{ width:"100%", padding:"9px 10px", border:"1px solid "+C.border,
                borderRadius:8, fontSize:12, boxSizing:"border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: C.muted,
              display: "block", marginBottom: 4 }}>VEHICULO *</label>
            <select value={rutaForm.placa}
              onChange={e=>setRutaForm(f=>({...f,placa:e.target.value}))}
              style={{ width:"100%", padding:"9px 10px", border:"1px solid "+C.border,
                borderRadius:8, fontSize:12, background:C.bg, boxSizing:"border-box" }}>
              <option value="">-- Seleccionar vehiculo --</option>
              {vehiculos.map(v=>(
                <option key={v.placa} value={v.placa}>
                  {v.placa}{v.modelo ? " - "+v.modelo : ""}{v.tipo ? " ("+v.tipo+")" : ""}
                </option>
              ))}
            </select>
            {vehiculos.length === 0 && (
              <div style={{ fontSize:9, color:C.danger, marginTop:3 }}>
                Cargando vehiculos...
              </div>
            )}
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: C.muted,
              display: "block", marginBottom: 4 }}>NOTAS</label>
            <input value={rutaForm.notas}
              onChange={e=>setRutaForm(f=>({...f,notas:e.target.value}))}
              placeholder="Observaciones opcionales"
              style={{ width:"100%", padding:"9px 10px", border:"1px solid "+C.border,
                borderRadius:8, fontSize:12, boxSizing:"border-box" }} />
          </div>
        </div>

        {/* Fila 2: Hora inicio + Hora fin + Tolerancia + Viaticos */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr",
          gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: C.muted,
              display: "block", marginBottom: 4 }}>HORA INICIO</label>
            <select
              value={rutaForm.h_inicio}
              onChange={e => setRutaForm(f => ({ ...f, h_inicio: e.target.value }))}
              style={{ width:"100%", padding:"9px 10px",
                border:"1px solid "+C.border, borderRadius:8,
                fontSize:12, boxSizing:"border-box", background:C.bg }}
            >
              {TIME_OPTIONS_12H.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: C.muted,
              display: "block", marginBottom: 4 }}>HORA FIN</label>
            <select
              value={rutaForm.h_fin}
              onChange={e => setRutaForm(f => ({ ...f, h_fin: e.target.value }))}
              style={{ width:"100%", padding:"9px 10px",
                border:"1px solid "+C.border, borderRadius:8,
                fontSize:12, boxSizing:"border-box", background:C.bg }}
            >
              {TIME_OPTIONS_12H.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          {[
            { label:"TOLERANCIA (min)", key:"tolerancia_minutos", placeholder:"15" },
            { label:"VIATICOS ($)",     key:"viaticos",           placeholder:"0"  },
          ].map(field => (
            <div key={field.key}>
              <label style={{ fontSize: 10, fontWeight: 700, color: C.muted,
                display: "block", marginBottom: 4 }}>{field.label}</label>
              <input
                type="number"
                value={rutaForm[field.key]}
                placeholder={field.placeholder}
                onChange={e => setRutaForm(f => ({
                  ...f,
                  [field.key]: field.key === "viaticos"
                    ? parseFloat(e.target.value)||0
                    : parseInt(e.target.value)||0
                }))}
                style={{ width:"100%", padding:"9px 10px",
                  border:"1px solid "+C.border, borderRadius:8,
                  fontSize:12, boxSizing:"border-box" }}
              />
            </div>
          ))}
        </div>

        {/* Empleados */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display:"flex", justifyContent:"space-between",
            alignItems:"center", marginBottom: 8 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: C.muted }}>
              EMPLEADOS *
            </label>
            {empSeleccionados.length > 0 && (
              <span style={{ fontSize:10, fontWeight:700,
                color:"#06D6A0", background:"#06D6A014",
                padding:"2px 8px", borderRadius:20,
                border:"1px solid #06D6A040" }}>
                {empSeleccionados.length} seleccionado(s)
              </span>
            )}
          </div>
          {personal.length === 0 ? (
            <div style={{ fontSize:12, color:C.muted, padding:"12px 0" }}>
              Cargando personal...
            </div>
          ) : (
            <div style={{ display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(150px,1fr))", gap: 7 }}>
              {personal.map(p => {
                const claveEmpleado = getEmpleadoClave(p);
                const sel = empSeleccionados.includes(claveEmpleado);
                return (
                  <div key={claveEmpleado}
                    onClick={()=>setEmpSeleccionados(s=>
                      sel ? s.filter(x=>x!==claveEmpleado) : [...s, claveEmpleado]
                    )}
                    style={{ padding:"8px 12px", borderRadius:8, cursor:"pointer",
                      fontSize:12, fontWeight:600, transition:"all 0.15s",
                      display:"flex", alignItems:"center", gap:6,
                      background: sel ? "#06D6A012" : C.bg,
                      border: "1px solid "+(sel ? "#06D6A0" : C.border),
                      color: sel ? "#06D6A0" : C.text }}>
                    <div style={{ width:16, height:16, borderRadius:4, flexShrink:0,
                      border:"2px solid "+(sel ? "#06D6A0" : C.border),
                      background: sel ? "#06D6A0" : "transparent",
                      display:"flex", alignItems:"center", justifyContent:"center" }}>
                      {sel && (
                        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                          <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5"
                            strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <span style={{ overflow:"hidden", textOverflow:"ellipsis",
                      whiteSpace:"nowrap" }}>{p.nombre}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Btn onClick={crearRuta} disabled={loading || !rutaForm.placa || empSeleccionados.length === 0}>
          {loading ? "CREANDO..." : "CREAR RUTA"}
        </Btn>
      </Card>

      {/* Rutas recientes */}
      {rutas.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.muted,
            marginBottom: 10, letterSpacing: 0.5 }}>RUTAS RECIENTES</div>
          {rutas.slice(0,5).map(r=>(
            <Card key={r.id || r.placa} style={{ marginBottom:8, display:"flex",
              justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontWeight:700, fontSize:13 }}>{r.placa} - {r.fecha}</div>
                <div style={{ fontSize:11, color:C.muted }}>
                  {(r.equipo || r.empleados || []).map(getEmpleadoNombreVisible).join(", ")}
                </div>
                {(r.h_inicio || r.h_fin) && (
                  <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>
                    {r.h_inicio} - {r.h_fin}
                  </div>
                )}
              </div>
              <span style={{ padding:"3px 10px", borderRadius:12, fontSize:10,
                fontWeight:700, background:"#06D6A014", color:"#06D6A0",
                flexShrink:0 }}>Activa</span>
            </Card>
          ))}
        </div>
      )}
      </div>
    </div>
  );

  // ============================================================
  // VISTA: MENU PRINCIPAL
  // ============================================================
  return (
    <div>
      <PageHeader title="Control de Horarios" subtitle="Gestion de tiempos y rutas" onBack={onBack} />
      {msg && <Alert tipo={msg.tipo} texto={msg.texto} onClose={() => setMsg(null)} />}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(220px, 1fr))", gap:16 }}>
        {[
          { id:"marcacion",  label:"Marcacion",           desc:"Registrar ingreso, almuerzo, retorno o cierre",    color:"#06D6A0" },
          { id:"planeacion", label:"Planeacion de Rutas",  desc:"Crear rutas con horario, tolerancia y viaticos",   color:"#00B4D8" },
          { id:"monitor",    label:"Monitor en Vivo",      desc:"Timeline GPS, horas trabajadas y horas extra",     color:"#F59E0B" },
          { id:"mapa",       label:"Mapa GPS",             desc:"Seguimiento en vivo e historico de operarios",     color:"#8B5CF6" },
        ].map(item => (
          <Card key={item.id} onClick={
              ((item.id === "marcacion" || item.id === "planeacion") && !canCreateHorarios)
                ? null
                : () => {
              if (item.id === "marcacion") { cargarRutasUsuario(); cargarUltimaMarca(); }
              setVista(item.id);
            }}
            style={{ cursor: ((item.id === "marcacion" || item.id === "planeacion") && !canCreateHorarios) ? "not-allowed" : "pointer", opacity: ((item.id === "marcacion" || item.id === "planeacion") && !canCreateHorarios) ? 0.55 : 1, borderBottom:"3px solid "+item.color,
              transition:"transform 0.15s" }}>
            <div style={{ width:38, height:38, borderRadius:10,
              background:item.color+"14", display:"flex", alignItems:"center",
              justifyContent:"center", marginBottom:12 }}>
              <div style={{ width:14, height:14, borderRadius:"50%", background:item.color }} />
            </div>
            <div style={{ fontWeight:800, fontSize:14, marginBottom:4 }}>{item.label}</div>
            <div style={{ fontSize:11, color:C.muted, lineHeight:1.5 }}>{item.desc}</div>
          </Card>
        ))}
      </div>

      {user && (
        <Card style={{ marginTop:20 }}>
          <div style={{ fontSize:10, fontWeight:700, color:C.muted,
            marginBottom:12, letterSpacing:0.5 }}>TU ESTADO HOY</div>
          <div style={{ display:"flex", alignItems:"stretch", marginBottom:10 }}>
            {ORDEN_MARCAS.map((tipo, idx) => {
              const cfg    = MARCAS_CFG[tipo];
              const done   = ultimaMarca && ORDEN_MARCAS.indexOf(ultimaMarca) >= idx;
              const next   = tipo === proximaMarca;
              const esLast = idx === ORDEN_MARCAS.length - 1;
              return (
                <div key={tipo} style={{ display:"flex", alignItems:"center", flex:1 }}>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flex:1 }}>
                    <div style={{ width:26, height:26, borderRadius:"50%",
                      background: done ? cfg.color : next ? cfg.color+"20" : C.bg,
                      border: "2px solid " + (done ? cfg.color : next ? cfg.color : C.border),
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:9, fontWeight:900,
                      color: done ? "#fff" : next ? cfg.color : C.muted }}>
                      {cfg.icon}
                    </div>
                    <div style={{ fontSize:8, marginTop:3, fontWeight:700,
                      color: done ? cfg.color : next ? cfg.color : C.muted }}>
                      {tipo}
                    </div>
                  </div>
                  {!esLast && (
                    <div style={{ flex:1, height:2, marginBottom:14,
                      background: done ? cfg.color : C.border }} />
                  )}
                </div>
              );
            })}
          </div>
          {proximaMarca && (
            <div style={{ fontSize:12, color:C.muted }}>
              {"Siguiente: "}
              <strong style={{ color:MARCAS_CFG[proximaMarca].color }}>
                {MARCAS_CFG[proximaMarca].label}
              </strong>
            </div>
          )}
          {ultimaMarca === "CIERRE" && (
            <div style={{ fontSize:12, color:"#8B5CF6", fontWeight:700 }}>
              Jornada completada hoy
            </div>
          )}
          {ultimaMarca === null && !cargandoUltima && (
            <div style={{ fontSize:12, color:C.muted }}>
              Sin marcaciones hoy. Registra tu INGRESO.
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default Horarios;
