import { useState, useEffect } from "react";
import { C, API_URL } from "../shared/constants";
import { Card, Btn, PageHeader, Alert } from "../shared/ui";
import MapaOperarios from "./MapaOperarios";

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

export default Horarios;
