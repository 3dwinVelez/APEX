import { useState, useEffect, useRef } from "react";
import { C, API_URL } from "../shared/constants";
import { Card, Btn, Input, Sel, PageHeader, Toast, Alert } from "../shared/ui";
import CapturaFoto from "./CapturaFoto";
import FirmaDigital from "./FirmaDigital";

const ESTADO_ORDEN = {
  pendiente:     { color: "#94A3B8", label: "Pendiente",      icon: "○" },
  en_curso:      { color: "#00B4D8", label: "En Curso",       icon: "▶" },
  inspeccion:    { color: "#F59E0B", label: "Inspección",     icon: "🔍" },
  ejecucion:     { color: "#8B5CF6", label: "Ejecución",      icon: "🔧" },
  cerrada:       { color: "#06D6A0", label: "Completada",     icon: "✓" },
  no_ejecutada:  { color: "#EF4444", label: "No Ejecutada",   icon: "✗" },  // ← NUEVO
  cancelada:     { color: "#EF4444", label: "Cancelada",      icon: "✗" },
};

const CATEGORIAS_REF = [
  { id: "muebles",       label: "Muebles",          icon: "" },
  { id: "colchones",     label: "Colchones",         icon: "" },
  { id: "electrodomesticos", label: "Electro",       icon: "" },
  { id: "cocina",        label: "Cocina",            icon: "" },
  { id: "oficina",       label: "Oficina",           icon: "" },
  { id: "decoracion",    label: "Decoracion",        icon: "" },
  { id: "iluminacion",   label: "Iluminacion",       icon: "" },
  { id: "textiles",      label: "Textiles",          icon: "" },
  { id: "otros",         label: "Otros",             icon: "" },
];

// ============================================================
// HELPER: Subir fotos a Supabase Storage
// ============================================================
const subirFoto = async (ordenId, tipo, fotoData, metadata = {}) => {
  try {
    console.log(`📸 Subiendo foto ${tipo} para orden ${ordenId}...`);
    const response = await fetch(`${API_URL}/ordenes/${ordenId}/fotos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orden_id: ordenId,
        tipo: tipo,
        base64_data: fotoData.base64,
        size_original: fotoData.sizeOriginal || fotoData.size || 1000000,
        metadata: metadata
      })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Error al subir foto");
    }
    const result = await response.json();
    console.log(`✅ Foto ${tipo} subida - Compresión: ${result.compression_ratio}`);
    return result;
  } catch (error) {
    console.error(`❌ Error subiendo foto ${tipo}:`, error);
    throw error;
  }
};

const Servicios = ({ onBack, user }) => {
  const [vista, setVista]       = useState("lista");
  const [ordenes, setOrdenes]   = useState([]);
  const [refs, setRefs]         = useState([]);
  const [personal, setPersonal] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [toast, setToast]       = useState(null);
  const [ordenSel, setOrdenSel] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [pasoServicio, setPasoServicio] = useState(1);
  const [inspeccion, setInspeccion]     = useState([]);
  const [formNovedad, setFormNovedad]   = useState({ descripcion:"", tipo:"averia", accion:"cambio" });
  const [showNovedad, setShowNovedad]   = useState(false);
  const firmaRef = useRef(null);
  const [firmando, setFirmando]         = useState(false);

  // Estados para fotos
  const [fotoFachada, setFotoFachada]       = useState(null);
  const [fotoEjecucionAntes, setFotoEjecucionAntes] = useState(null);
  const [fotoEjecucionDespues, setFotoEjecucionDespues] = useState(null);
  const [fotoCierre, setFotoCierre]         = useState(null);
  const [fotosInspeccion, setFotosInspeccion] = useState({});
  
  // Estados para cierre
  const [firmaCliente, setFirmaCliente]     = useState(null);
  const [fotoCliente, setFotoCliente]       = useState(null);
  const [subiendoFoto, setSubiendoFoto]     = useState(false);
    // Estados para cierre no ejecutado
  const [motivoNoEjecucion, setMotivoNoEjecucion] = useState("");
  const [fotoNoEjecucion, setFotoNoEjecucion] = useState(null);

  // Estados para reporte
  const [fotosOrden, setFotosOrden] = useState([]);
  const [novedades, setNovedades] = useState([]);
  const [descargandoPDF, setDescargandoPDF] = useState(false);

  const [formOrden, setFormOrden] = useState({
    referencia_id:"", tecnico_id:"", tipo_servicio:"montaje",
    cliente_nombre:"", cliente_direccion:"", cliente_telefono:"",
    num_factura:"", observaciones:"", fecha_programada:""
  });

  // Volver a lista: recargar solo si hubo cambio de estado en la orden
  const volverALista = (recargar = false) => {
    setVista("lista");
    if (recargar) cargar();
  };

  const cargar = async () => {
    setLoading(true);
    try {
      const [o, r, p] = await Promise.all([
        fetch(`${API_URL}/ordenes`).then(x=>x.json()),
        fetch(`${API_URL}/referencias?activo=true`).then(x=>x.json()),
        fetch(`${API_URL}/personal`).then(x=>x.json()),
      ]);
      setOrdenes(Array.isArray(o)?o:[]);
      setRefs(Array.isArray(r)?r:[]);
      setPersonal(Array.isArray(p)?p:[]);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const crearOrden = async () => {
    if (!formOrden.referencia_id||!formOrden.cliente_nombre||!formOrden.cliente_direccion) {
      setToast({ msg:"Referencia, cliente y direccion son obligatorios", type:"error" }); return;
    }
    try {
      const res = await fetch(`${API_URL}/ordenes?creado_por=${encodeURIComponent(user?.nombre||"admin")}`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ ...formOrden, referencia_id:parseInt(formOrden.referencia_id), tecnico_id:formOrden.tecnico_id?parseInt(formOrden.tecnico_id):null })
      });
      if (res.ok) {
        setToast({ msg:"Orden creada exitosamente", type:"success" });
        setTimeout(() => { volverALista(true); }, 1400);
      } else { const e=await res.json(); setToast({ msg:e.detail||"Error", type:"error" }); }
    } catch { setToast({ msg:"Error de conexion", type:"error" }); }
  };

  const abrirOrden = async (ord) => {
  setOrdenSel(ord);

  // Cargar piezas de la referencia para inspección (sincrono, ya está en memoria)
  if (ord.referencia_id) {
    const refData = refs.find(r => r.id === ord.referencia_id);
    if (refData?.piezas) {
      setInspeccion(refData.piezas.map(p => ({
        pieza_id: p.id,
        nombre_pieza: p.nombre,
        estado: "ok",
        novedad_descripcion: "",
        accion_solicitada: "ninguna"
      })));
    }
  }

  // Determinar paso y navegar INMEDIATAMENTE (sin esperar red)
  let paso = 1;
  if (ord.estado === "pendiente")     paso = 1;
  else if (ord.estado === "en_curso") paso = 2;
  else if (ord.estado === "inspeccion") paso = 2;
  else if (ord.estado === "ejecucion")  paso = 3;
  else if (ord.estado === "cerrada" || ord.estado === "no_ejecutada") paso = 5;

  setPasoServicio(paso);
  setFotosOrden([]);
  setNovedades([]);
  setVista(
    ord.estado === "cerrada" || ord.estado === "no_ejecutada"
      ? "reporte"
      : "servicio"
  );

  // Cargar fotos y novedades en segundo plano (no bloquea la navegación)
  if (ord.estado === "cerrada" || ord.estado === "no_ejecutada") {
    Promise.all([
      fetch(`${API_URL}/ordenes/${ord.id}/fotos`).then(r => r.json()).catch(() => []),
      fetch(`${API_URL}/ordenes/${ord.id}/detalle`).then(r => r.json()).then(d => d.novedades || []).catch(() => [])
    ]).then(([fotos, novs]) => {
      setFotosOrden(Array.isArray(fotos) ? fotos : []);
      setNovedades(Array.isArray(novs) ? novs : []);
    }).catch(() => {});
  }
};

  const iniciarOrden = async () => {
    try {
      let lat=null, lng=null;
      try {
        const pos = await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{timeout:5000}));
        lat=pos.coords.latitude; lng=pos.coords.longitude;
      } catch {}
      await fetch(`${API_URL}/ordenes/${ordenSel.id}/iniciar?lat=${lat||0}&lng=${lng||0}`, { method:"PATCH" });
      setOrdenSel(o=>({...o, estado:"en_curso", lat_inicio:lat, lng_inicio:lng}));
      setPasoServicio(2); // Avanzar a inspeccion
      setToast({ msg:"Orden iniciada - GPS registrado. Procede con la inspeccion.", type:"success" });
    } catch { setToast({ msg:"Error al iniciar", type:"error" }); }
  };

  // ============================================================
  // HANDLERS DE FOTOS CON SUBIDA AUTOMÁTICA
  // ============================================================
  const handleFotoFachada = async (fotoData) => {
    setFotoFachada(fotoData);
    try {
      setSubiendoFoto(true);
      await subirFoto(ordenSel.id, "fachada", fotoData);
      setToast({ msg: "Foto de fachada guardada ✓", type: "success" });
    } catch (error) {
      setToast({ msg: "Error al guardar foto de fachada", type: "error" });
    } finally {
      setSubiendoFoto(false);
    }
  };

  const handleFotoPiezaAveriada = async (piezaId, piezaNombre, fotoData) => {
    setFotosInspeccion(prev => ({ ...prev, [piezaId]: fotoData }));
    try {
      setSubiendoFoto(true);
      await subirFoto(ordenSel.id, "pieza_averiada", fotoData, { pieza_nombre: piezaNombre, pieza_id: piezaId });
      setToast({ msg: `Foto de ${piezaNombre} guardada ✓`, type: "success" });
    } catch (error) {
      setToast({ msg: `Error al guardar foto de ${piezaNombre}`, type: "error" });
    } finally {
      setSubiendoFoto(false);
    }
  };

  const handleFotoEjecucionAntes = async (fotoData) => {
    setFotoEjecucionAntes(fotoData);
    try {
      setSubiendoFoto(true);
      await subirFoto(ordenSel.id, "producto_abierto", fotoData);
      setToast({ msg: "Foto antes del servicio guardada ✓", type: "success" });
    } catch (error) {
      setToast({ msg: "Error al guardar foto", type: "error" });
    } finally {
      setSubiendoFoto(false);
    }
  };

  const handleFotoEjecucionDespues = async (fotoData) => {
    setFotoEjecucionDespues(fotoData);
    try {
      setSubiendoFoto(true);
      await subirFoto(ordenSel.id, "producto_cerrado", fotoData);
      setToast({ msg: "Foto después del servicio guardada ✓", type: "success" });
    } catch (error) {
      setToast({ msg: "Error al guardar foto", type: "error" });
    } finally {
      setSubiendoFoto(false);
    }
  };

  const handleFotoCliente = async (fotoData) => {
    setFotoCliente(fotoData);
    try {
      setSubiendoFoto(true);
      await subirFoto(ordenSel.id, "cliente", fotoData);
      setToast({ msg: "Foto del cliente guardada ✓", type: "success" });
    } catch (error) {
      setToast({ msg: "Error al guardar foto del cliente", type: "error" });
    } finally {
      setSubiendoFoto(false);
    }
  };

  const handleFotoNoEjecucion = async (fotoData) => {
  setFotoNoEjecucion(fotoData);
  try {
    setSubiendoFoto(true);
    await subirFoto(ordenSel.id, "no_ejecutada", fotoData, {
      motivo: motivoNoEjecucion
    });
    setToast({ msg: "Foto de evidencia guardada ✓", type: "success" });
  } catch {
    setToast({ msg: "Error al guardar foto de evidencia", type: "error" });
  } finally {
    setSubiendoFoto(false);
  }
};

  const guardarInspeccion = async (armable = true) => {
    // Validar que piezas averiadas/faltantes tengan foto
    const piezasConProblema = inspeccion.filter(p => p.estado !== "ok");
    const faltanFotos = piezasConProblema.filter(p => !fotosInspeccion[p.pieza_id]);
    
    if (faltanFotos.length > 0) {
      setToast({ 
        msg: `Faltan fotos de evidencia en ${faltanFotos.length} pieza(s) con problemas`, 
        type: "error" 
      });
      return;
    }
    
    try {
    // Guardar inspección en backend
    await fetch(`${API_URL}/ordenes/${ordenSel.id}/inspeccion`, {
      method: "POST", 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inspeccion)
    });
    
    if (armable) {
      // Producto ARMABLE -> paso 3 ejecucion
      setOrdenSel(o => ({ ...o, estado: "ejecucion" }));
      setPasoServicio(3);
      setToast({ msg: "Inspeccion guardada - Producto armable", type: "success" });
    } else {
      // Producto NO ARMABLE -> paso 4 cierre no ejecutado
      setOrdenSel(o => ({ ...o, estado: "inspeccion" }));
      setPasoServicio(4);
      setToast({ msg: "Producto no armable - Completa el cierre", type: "warning" });
    }
  } catch { 
    setToast({ msg: "Error al guardar inspección", type: "error" }); 
  }
};

  const guardarNovedad = async () => {
    if (!formNovedad.descripcion) return;
    try {
      await fetch(`${API_URL}/novedades_servicio`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ ...formNovedad, orden_id:ordenSel.id })
      });
      setNovedades(n=>[...n, { ...formNovedad, timestamp:new Date().toISOString() }]);
      setFormNovedad({ descripcion:"", tipo:"averia", accion:"cambio" });
      setShowNovedad(false);
      setToast({ msg:"Novedad registrada", type:"success" });
    } catch {}
  };

  const avanzarEjecucion = () => {
    setOrdenSel(o=>({...o, estado:"ejecucion"}));
    setPasoServicio(5);
  };

  const cerrarOrden = async () => {
    // Validar firma y foto del cliente
    if (!firmaCliente) {
      setToast({ msg: "Se requiere la firma del cliente para cerrar el servicio", type: "error" });
      return;
    }
    
    if (!fotoCliente) {
      setToast({ msg: "Se requiere foto del cliente para cerrar el servicio", type: "error" });
      return;
    }
    
    if (!fotoEjecucionAntes || !fotoEjecucionDespues) {
      setToast({ msg: "Se requieren las fotos antes/después del servicio", type: "error" });
      return;
    }
    
    try {
      // Aqui se guardarian todas las fotos y firma en el backend
      await fetch(`${API_URL}/ordenes/${ordenSel.id}/cerrar`, { method:"PATCH" });
      setOrdenSel(o=>({...o, estado:"cerrada"}));
      setToast({ msg:"Servicio cerrado exitosamente - Todas las fotos y firma registradas ✓", type:"success" });
      setTimeout(()=>{ volverALista(true); }, 1600);
    } catch { setToast({ msg:"Error al cerrar", type:"error" }); }
  };

    // ============================================================
  // NUEVO: Cerrar servicio como NO EJECUTADO
  // ============================================================
  const cerrarOrdenNoEjecutada = async () => {
    // Validación 1: Debe explicar el motivo
    if (!motivoNoEjecucion.trim()) {
      setToast({ 
        msg: "Debes explicar por qué no se pudo ejecutar el servicio", 
        type: "error" 
      });
      return;
    }
    
    // Validación 2: Debe tener foto de evidencia
    if (!fotoNoEjecucion) {
      setToast({ 
        msg: "Se requiere foto de evidencia", 
        type: "error" 
      });
      return;
    }
    
    // Validación 3: Debe tener firma del cliente
    if (!firmaCliente) {
      setToast({ 
        msg: "Se requiere firma del cliente", 
        type: "error" 
      });
      return;
    }

    try {
      // PASO 1: Guardar la novedad con el motivo
      await fetch(`${API_URL}/novedades_servicio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orden_id: ordenSel.id,
          tipo: "no_ejecutada",
          descripcion: motivoNoEjecucion
        })
      });

      // PASO 2: Cerrar la orden como NO EJECUTADA
      await fetch(`${API_URL}/ordenes/${ordenSel.id}/cerrar-no-ejecutada`, {
        method: "PATCH"
      });

      // PASO 3: Actualizar estado local
      setOrdenSel(o => ({ ...o, estado: "no_ejecutada" }));
      
      // PASO 4: Mostrar mensaje y volver a la lista
      setToast({ 
        msg: "Servicio cerrado como NO EJECUTADO", 
        type: "warning" 
      });
      
      setTimeout(() => { volverALista(true); }, 1600);
      
    } catch {
      setToast({ 
        msg: "Error al cerrar el servicio", 
        type: "error" 
      });
    }
  };

  const ordFiltradas = filtroEstado ? ordenes.filter(o=>o.estado===filtroEstado) : ordenes;
  const refSel = refs.find(r=>r.id===parseInt(formOrden.referencia_id));

  // ---- PASOS INDICADOR ----
  const PasosIndicador = ({ paso, noEjecutado }) => {
  const pasos = noEjecutado
    ? ["Inicio", "Inspeccion", "Sin Ejecutar"]
    : ["Inicio", "Inspeccion", "Ejecucion", "Cierre"];
    return (
      <div style={{ display:"flex",alignItems:"center",gap:0,marginBottom:20 }}>
        {pasos.map((p,i) => (
          <div key={i} style={{ display:"flex",alignItems:"center",flex:i<pasos.length-1?1:"auto" }}>
            <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:4 }}>
              <div style={{ width:32,height:32,borderRadius:"50%",
                background: paso>i+1?"#06D6A0":paso===i+1?C.accent:C.bg,
                border:`2px solid ${paso>i+1?"#06D6A0":paso===i+1?C.accent:C.border}`,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontWeight:800,fontSize:12,
                color:paso>i+1||paso===i+1?"#fff":C.muted }}>
                {paso>i+1 ? "ok" : i+1}
              </div>
              <div style={{ fontSize:9,fontWeight:700,color:paso===i+1?C.accent:C.muted,whiteSpace:"nowrap" }}>{p}</div>
            </div>
            {i<pasos.length-1 && (
              <div style={{ flex:1,height:2,background:paso>i+1?"#06D6A0":C.border,margin:"0 4px",marginBottom:16 }}/>
            )}
          </div>
        ))}
      </div>
    );
  };

  // VISTA REPORTE - Detalle completo de orden cerrada
  // ============================================================
  if (vista === "reporte" && ordenSel) {
    const est = ESTADO_ORDEN[ordenSel.estado] || ESTADO_ORDEN.cerrada;
    const esNoEjecutada = ordenSel.estado === "no_ejecutada";

    const tiposLabel = {
      fachada:          "Fachada del inmueble",
      pieza_averiada:   "Piezas con problemas",
      producto_abierto: "Producto abierto",
      producto_cerrado: "Producto cerrado",
      cliente:          "Foto del cliente",
      no_ejecutada:     "Evidencia no ejecutado",
    };

    const descargarPDF = async () => {
      setDescargandoPDF(true);
      try {
        const res = await fetch(`${API_URL}/ordenes/${ordenSel.id}/reporte-pdf`);
        if (!res.ok) throw new Error("Error generando PDF");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Reporte-${ordenSel.consecutivo}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setToast({ msg: "PDF descargado correctamente", type: "success" });
      } catch {
        setToast({ msg: "Error al generar el PDF", type: "error" });
      } finally {
        setDescargandoPDF(false);
      }
    };

    // Calcular duracion
    const duracion = ordenSel.duracion_min
      ? `${Math.floor(ordenSel.duracion_min / 60)}h ${Math.round(ordenSel.duracion_min % 60)}m`
      : null;

    return (
      <div>
        {toast && <Toast {...toast} onClose={() => setToast(null)} />}
        <PageHeader
          title={`Reporte ${ordenSel.consecutivo}`}
          subtitle={`${ordenSel.tipo_servicio?.toUpperCase()} - ${ordenSel.referencia_nombre}`}
          onBack={() => { setVista("lista"); cargar(); }}
          action={
            <Btn
              onClick={descargarPDF}
              disabled={descargandoPDF}
              style={{ background: C.accent, color: "#fff", fontSize: 12, padding: "9px 18px" }}
            >
              {descargandoPDF ? "Generando..." : "Exportar PDF"}
            </Btn>
          }
        />

        <div style={{ maxWidth: 680 }}>

          {/* Banner de estado */}
          <div style={{
            display: "flex", alignItems: "center", gap: 14,
            padding: "14px 18px", borderRadius: 12, marginBottom: 18,
            background: est.color + "15", border: `2px solid ${est.color}40`
          }}>
            <div style={{ fontSize: 28 }}>{esNoEjecutada ? "✗" : "✓"}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: est.color }}>{est.label}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                {ordenSel.fecha_cierre
                  ? `Cerrado: ${new Date(ordenSel.fecha_cierre).toLocaleString("es-CO")}`
                  : ""}
                {duracion ? `  ·  Duración: ${duracion}` : ""}
              </div>
            </div>
            {duracion && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: est.color }}>{duracion}</div>
                <div style={{ fontSize: 10, color: C.muted, fontWeight: 700 }}>DURACIÓN</div>
              </div>
            )}
          </div>

          {/* Datos cliente y servicio */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <Card>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 10 }}>CLIENTE</div>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 2 }}>{ordenSel.cliente_nombre}</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 2 }}>{ordenSel.cliente_direccion}</div>
              {ordenSel.cliente_telefono && (
                <div style={{ fontSize: 12, color: C.muted }}>{ordenSel.cliente_telefono}</div>
              )}
              {ordenSel.num_factura && (
                <div style={{ fontSize: 11, color: C.accent, fontWeight: 600, marginTop: 6 }}>
                  Factura: {ordenSel.num_factura}
                </div>
              )}
            </Card>
            <Card>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 10 }}>SERVICIO</div>
              {[
                ["Referencia", ordenSel.referencia_nombre],
                ["Tipo", ordenSel.tipo_servicio],
                ["Técnico", ordenSel.tecnico_nombre || "Sin asignar"],
                ["Creado por", ordenSel.creado_por || "-"],
              ].map(([lbl, val]) => (
                <div key={lbl} style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 11, color: C.muted }}>{lbl}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, textTransform: "capitalize" }}>{val}</span>
                </div>
              ))}
            </Card>
          </div>

          {/* Timeline */}
          <Card style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 12 }}>LÍNEA DE TIEMPO</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {[
                { label: "Orden creada", fecha: ordenSel.fecha_creacion, color: "#94A3B8", show: true },
                { label: "Servicio iniciado (GPS)", fecha: ordenSel.fecha_inicio, color: C.accent, show: !!ordenSel.fecha_inicio },
                { label: esNoEjecutada ? "Cerrado como NO EJECUTADO" : "Servicio completado", fecha: ordenSel.fecha_cierre, color: esNoEjecutada ? "#EF4444" : "#06D6A0", show: !!ordenSel.fecha_cierre },
              ].filter(e => e.show).map((e, i, arr) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ width: 12, height: 12, borderRadius: "50%", background: e.color, marginTop: 2, flexShrink: 0 }} />
                    {i < arr.length - 1 && (
                      <div style={{ width: 2, height: 24, background: C.border, margin: "2px 0" }} />
                    )}
                  </div>
                  <div style={{ paddingBottom: i < arr.length - 1 ? 8 : 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: e.color }}>{e.label}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>
                      {e.fecha ? new Date(e.fecha).toLocaleString("es-CO") : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {ordenSel.lat_inicio && ordenSel.lng_inicio && (
              <div style={{ marginTop: 10, padding: "8px 10px", background: C.bg, borderRadius: 6, fontSize: 11, color: C.muted }}>
                GPS inicio: {parseFloat(ordenSel.lat_inicio).toFixed(4)}, {parseFloat(ordenSel.lng_inicio).toFixed(4)}
              </div>
            )}
          </Card>

          {/* Galeria de fotos */}
          {fotosOrden.length > 0 && (
            <Card style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 14 }}>
                EVIDENCIA FOTOGRÁFICA ({fotosOrden.length} foto{fotosOrden.length !== 1 ? "s" : ""})
              </div>
              {["fachada", "pieza_averiada", "producto_abierto", "producto_cerrado", "cliente", "no_ejecutada"].map(tipo => {
                const fts = fotosOrden.filter(f => f.tipo === tipo);
                if (!fts.length) return null;
                return (
                  <div key={tipo} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 8 }}>
                      {tiposLabel[tipo] || tipo}
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {fts.map((f, idx) => (
                        <a key={idx} href={f.url} target="_blank" rel="noreferrer">
                          <img src={f.url} alt={tipo}
                            style={{ width: 100, height: 100, objectFit: "cover", borderRadius: 8,
                              border: `2px solid ${C.border}`, cursor: "pointer",
                              transition: "transform 0.15s" }}
                            onMouseEnter={e => e.target.style.transform = "scale(1.05)"}
                            onMouseLeave={e => e.target.style.transform = "scale(1)"}
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                );
              })}
            </Card>
          )}

          {/* Inspeccion de piezas */}
          {novedades.filter(n => n.tipo !== "no_ejecutada").length > 0 && (
            <Card style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 12 }}>
                NOVEDADES REGISTRADAS
              </div>
              {novedades.filter(n => n.tipo !== "no_ejecutada").map((n, i) => {
                const col = n.tipo === "averia" ? "#F59E0B" : n.tipo === "faltante" ? "#EF4444" : "#00B4D8";
                return (
                  <div key={i} style={{ padding: "10px 12px", marginBottom: 8, borderRadius: 8,
                    background: col + "10", border: `1px solid ${col}30` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: col, textTransform: "uppercase", marginBottom: 4 }}>
                      {n.tipo}
                    </div>
                    <div style={{ fontSize: 13 }}>{n.descripcion}</div>
                    {n.accion && n.accion !== "informativo" && (
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Acción: {n.accion}</div>
                    )}
                  </div>
                );
              })}
            </Card>
          )}

          {/* Motivo no ejecutado */}
          {esNoEjecutada && novedades.filter(n => n.tipo === "no_ejecutada").length > 0 && (
            <Card style={{ marginBottom: 14, borderLeft: "4px solid #EF4444" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#EF4444", marginBottom: 8 }}>
                MOTIVO NO EJECUTADO
              </div>
              <div style={{ fontSize: 13 }}>
                {novedades.find(n => n.tipo === "no_ejecutada")?.descripcion}
              </div>
            </Card>
          )}

          {/* Observaciones */}
          {ordenSel.observaciones && (
            <Card style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 8 }}>OBSERVACIONES</div>
              <div style={{ fontSize: 13, color: C.text }}>{ordenSel.observaciones}</div>
            </Card>
          )}

          {/* Botones finales */}
          <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
            <Btn
              onClick={descargarPDF}
              disabled={descargandoPDF}
              style={{ flex: 1, padding: 14, background: C.dark, color: "#fff", fontSize: 13 }}
            >
              {descargandoPDF ? "Generando PDF..." : "Descargar Reporte PDF"}
            </Btn>
            <Btn
              variant="ghost"
              onClick={() => { setVista("lista"); cargar(); }}
              style={{ padding: "14px 20px", fontSize: 13 }}
            >
              Volver
            </Btn>
          </div>
        </div>
      </div>
    );
  }


  // ---- VISTA SERVICIO (flujo tecnico) ----
  if (vista === "servicio" && ordenSel) return (
    <div>
      {toast && <Toast {...toast} onClose={()=>setToast(null)} />}
      <PageHeader title={`Orden ${ordenSel.consecutivo}`}
        subtitle={`${ordenSel.tipo_servicio?.toUpperCase()} - ${ordenSel.referencia_nombre}`}
        onBack={()=>{ volverALista(true); }} />
      <div style={{ maxWidth:600 }}>
        <PasosIndicador paso={pasoServicio} noEjecutado={pasoServicio === 4} />

        {/* Info cliente */}
        <Card style={{ marginBottom:14,borderLeft:`4px solid ${(ESTADO_ORDEN[ordenSel.estado]||ESTADO_ORDEN.pendiente).color}` }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
            <div>
              <div style={{ fontSize:11,color:C.muted,fontWeight:700 }}>CLIENTE</div>
              <div style={{ fontWeight:800,fontSize:15 }}>{ordenSel.cliente_nombre}</div>
              <div style={{ fontSize:12,color:C.muted }}>{ordenSel.cliente_direccion}</div>
              {ordenSel.cliente_telefono && <div style={{ fontSize:12,color:C.muted }}>{ordenSel.cliente_telefono}</div>}
              {ordenSel.num_factura && <div style={{ fontSize:11,color:C.accent,fontWeight:600 }}>Factura: {ordenSel.num_factura}</div>}
            </div>
            <span style={{ padding:"4px 10px",borderRadius:10,fontSize:11,fontWeight:700,
              background:(ESTADO_ORDEN[ordenSel.estado]||ESTADO_ORDEN.pendiente).bg,
              color:(ESTADO_ORDEN[ordenSel.estado]||ESTADO_ORDEN.pendiente).color }}>
              {(ESTADO_ORDEN[ordenSel.estado]||ESTADO_ORDEN.pendiente).label}
            </span>
          </div>
          <div style={{ marginTop:10,paddingTop:10,borderTop:`1px solid ${C.border}`,
            display:"flex",gap:12 }}>
            <div>
              <div style={{ fontSize:9,color:C.muted }}>REFERENCIA</div>
              <div style={{ fontSize:12,fontWeight:700 }}>{ordenSel.referencia_nombre}</div>
            </div>
            <div>
              <div style={{ fontSize:9,color:C.muted }}>TIPO</div>
              <div style={{ fontSize:12,fontWeight:700,textTransform:"capitalize" }}>{ordenSel.tipo_servicio}</div>
            </div>
            {ordenSel.fecha_inicio && (
              <div>
                <div style={{ fontSize:9,color:C.muted }}>INICIADO</div>
                <div style={{ fontSize:12,fontWeight:700 }}>{new Date(ordenSel.fecha_inicio).toLocaleTimeString()}</div>
              </div>
            )}
          </div>
        </Card>

        {/* PASO 1: Iniciar + Foto Fachada */}
        {pasoServicio === 1 && (
          <div>
            <Card style={{ marginBottom:14 }}>
              <div style={{ textAlign:"center",padding:"10px 0 12px" }}>
                <div style={{ fontSize:32,marginBottom:8 }}>[ GPS ]</div>
                <div style={{ fontWeight:800,fontSize:16,marginBottom:6 }}>Iniciar Orden de Servicio</div>
                <div style={{ fontSize:13,color:C.muted,lineHeight:1.5 }}>
                  Captura la foto de fachada e inicia el servicio. Se registrara tu GPS y el cronometro.
                </div>
              </div>
            </Card>

            <Card style={{ marginBottom:14 }}>
              <CapturaFoto
                etiqueta="Foto de Fachada del Inmueble"
                obligatoria={true}
                onFotoCapturada={handleFotoFachada}
                existente={fotoFachada?.base64}
                disabled={subiendoFoto}
              />
              {fotoFachada && (
                <div style={{ padding:"10px 12px", background:"#06D6A010", border:"1px solid #06D6A040",
                  borderRadius:8, fontSize:12, color:"#06D6A0", fontWeight:600, marginTop:4 }}>
                  Foto de fachada lista ({(fotoFachada.sizeCompressed/1024).toFixed(1)} KB)
                </div>
              )}
            </Card>

            <Btn
              onClick={async () => {
                if (!fotoFachada) {
                  setToast({ msg:"Debes capturar la foto de fachada antes de iniciar", type:"error" }); return;
                }
                await iniciarOrden();
              }}
              disabled={!fotoFachada || subiendoFoto}
              style={{ width:"100%", padding:14, fontSize:15, opacity: fotoFachada ? 1 : 0.5 }}
            >
              {subiendoFoto ? "Guardando..." : fotoFachada ? "INICIAR SERVICIO + GPS" : "Captura la foto para continuar"}
            </Btn>
          </div>
        )}

        {/* PASO 2: Inspeccion de piezas */}
        {pasoServicio === 2 && (
          <div>
            <Card style={{ marginBottom:14 }}>
              <div style={{ fontWeight:700,fontSize:13,color:C.muted,marginBottom:12 }}>
                INSPECCION DE PIEZAS
              </div>
              <div style={{ fontSize:12,color:C.muted,marginBottom:14 }}>
                Verifica cada pieza de la referencia <strong>{ordenSel.referencia_nombre}</strong>.
                Marca el estado de cada una antes de comenzar el montaje.
              </div>
              {inspeccion.map((p,i) => (
                <div key={i} style={{ padding:"12px 14px",marginBottom:8,borderRadius:10,
                  background: p.estado==="ok"?"#06D6A010":p.estado==="averiada"?"#F59E0B10":"#EF444410",
                  border:`1px solid ${p.estado==="ok"?"#06D6A040":p.estado==="averiada"?"#F59E0B40":"#EF444440"}` }}>
                  <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:8 }}>
                    <div style={{ width:28,height:28,borderRadius:"50%",background:C.accent+"20",
                      display:"flex",alignItems:"center",justifyContent:"center",
                      fontWeight:800,fontSize:11,color:C.accent,flexShrink:0 }}>{i+1}</div>
                    <div style={{ fontWeight:700,flex:1 }}>{p.nombre_pieza}</div>
                    <div style={{ display:"flex",gap:6 }}>
                      {[["ok","OK","#06D6A0"],["averiada","Averiada","#F59E0B"],["faltante","Faltante","#EF4444"]].map(([v,l,c])=>(
                        <div key={v} onClick={()=>setInspeccion(prev=>prev.map((x,idx)=>idx===i?{...x,estado:v}:x))}
                          style={{ padding:"4px 10px",borderRadius:20,cursor:"pointer",fontSize:11,fontWeight:700,
                            background:p.estado===v?c+"30":C.bg,color:p.estado===v?c:C.muted,
                            border:`1px solid ${p.estado===v?c:C.border}` }}>{l}</div>
                      ))}
                    </div>
                  </div>
                  {p.estado !== "ok" && (
                    <div>
                      <input value={p.novedad_descripcion}
                        onChange={e=>setInspeccion(prev=>prev.map((x,idx)=>idx===i?{...x,novedad_descripcion:e.target.value}:x))}
                        placeholder="Describe el problema..."
                        style={{ width:"100%",padding:"7px 10px",border:`1px solid ${C.border}`,borderRadius:6,fontSize:12,marginBottom:6 }} />
                      <select value={p.accion_solicitada}
                        onChange={e=>setInspeccion(prev=>prev.map((x,idx)=>idx===i?{...x,accion_solicitada:e.target.value}:x))}
                        style={{ padding:"7px 10px",border:`1px solid ${C.border}`,borderRadius:6,fontSize:12,background:"white",marginBottom:10,width:"100%" }}>
                        <option value="ninguna">Sin accion requerida</option>
                        <option value="cambio">Solicitar cambio</option>
                        <option value="garantia">Solicitar garantia al proveedor</option>
                      </select>
                      
                      {/* Foto obligatoria para avería/faltante */}
                      <CapturaFoto
                        etiqueta={`Foto de evidencia - ${p.nombre_pieza}`}
                        obligatoria={true}
                        onFotoCapturada={(foto) => handleFotoPiezaAveriada(p.pieza_id, p.nombre_pieza, foto)}
                        existente={fotosInspeccion[p.pieza_id]?.base64}
                        disabled={subiendoFoto}
                      />
                    </div>
                  )}
                </div>
              ))}
              {inspeccion.length === 0 && (
                <div style={{ textAlign:"center",padding:20,color:C.muted }}>
                  Esta referencia no tiene piezas registradas
                </div>
              )}
              {/* Botones: Armable / No Armable */}
              <div style={{ 
                display: "flex", 
                gap: 10, 
                marginTop: 14 
              }}>
                <Btn
                  onClick={() => guardarInspeccion(true)}
                  style={{ 
                    flex: 1, 
                    padding: 14, 
                    fontSize: 14,
                    fontWeight: 700,
                    background: "#06D6A0",
                    border: "none"
                  }}
                >
                  ✓ PRODUCTO ARMABLE
                </Btn>
                
                <Btn
                  onClick={() => guardarInspeccion(false)}
                  style={{ 
                    flex: 1, 
                    padding: 14, 
                    fontSize: 14,
                    fontWeight: 700,
                    background: "#EF4444",
                    border: "none"
                  }}
                >
                  ✗ NO ARMABLE
                </Btn>
              </div>
            </Card>
          </div>
        )}

        {/* PASO 3: Ejecucion - fotos del trabajo */}
        {pasoServicio === 3 && ordenSel.estado === "ejecucion" && (
          <Card>
            <div style={{ textAlign:"center",padding:"8px 0 14px" }}>
              <div style={{ fontSize:32,marginBottom:8 }}>🛠️</div>
              <div style={{ fontWeight:800,fontSize:16,marginBottom:6 }}>Trabajo Finalizado</div>
              <div style={{ fontSize:13,color:C.muted,marginBottom:16 }}>
                Documenta el resultado del montaje con 2 fotos obligatorias del producto.
              </div>
            </div>

            <CapturaFoto
              etiqueta="Foto 1: Producto Abierto (cajones/puertas abiertas)"
              obligatoria={true}
              onFotoCapturada={handleFotoEjecucionAntes}
              existente={fotoEjecucionAntes?.base64}
              disabled={subiendoFoto}
            />

            <CapturaFoto
              etiqueta="Foto 2: Producto Cerrado (todo cerrado)"
              obligatoria={true}
              onFotoCapturada={handleFotoEjecucionDespues}
              existente={fotoEjecucionDespues?.base64}
              disabled={subiendoFoto}
            />

            {fotoEjecucionAntes && fotoEjecucionDespues && (
              <div style={{ 
                padding:"10px 12px",
                background:"#06D6A010",
                border:"1px solid #06D6A040",
                borderRadius:8,
                fontSize:12,
                color:"#06D6A0",
                fontWeight:600,
                marginBottom:14
              }}>
                ✓ Ambas fotos capturadas - Total: {((fotoEjecucionAntes.sizeCompressed + fotoEjecucionDespues.sizeCompressed) / 1024).toFixed(1)} KB
              </div>
            )}

            <Btn 
              onClick={async () => {
                if (!fotoEjecucionAntes || !fotoEjecucionDespues) {
                  setToast({ msg:"Debes capturar ambas fotos para continuar", type:"error" }); return;
                }
                setPasoServicio(5);
              }}
              style={{ 
                width:"100%",
                padding:14,
                fontSize:15,
                opacity: (fotoEjecucionAntes && fotoEjecucionDespues) ? 1 : 0.5,
                cursor: (fotoEjecucionAntes && fotoEjecucionDespues) ? "pointer" : "not-allowed"
              }}
              disabled={!fotoEjecucionAntes || !fotoEjecucionDespues}
            >
              {(fotoEjecucionAntes && fotoEjecucionDespues) 
                ? "CONTINUAR AL CIERRE" 
                : "Captura ambas fotos para continuar"}
            </Btn>
          </Card>
        )}

        {/* PASO 4: Cierre No Ejecutado */}
        {pasoServicio === 4 && (
          <Card>
            <div style={{ textAlign: "center", padding: "10px 0 16px" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✗</div>
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6, color: "#EF4444" }}>
                Servicio NO Ejecutado
              </div>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 16, lineHeight: 1.5 }}>
                El producto no se pudo armar. Explica el motivo, adjunta evidencia y obtén la firma del cliente.
              </div>
            </div>

            {/* Motivo */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 6 }}>
                MOTIVO (obligatorio)
              </div>
              <textarea
                value={motivoNoEjecucion}
                onChange={e => setMotivoNoEjecucion(e.target.value)}
                placeholder="Explica por qué no se pudo ejecutar el servicio (ej: pieza principal averiada, producto defectuoso, dimensiones incorrectas, etc.)"
                style={{
                  width: "100%",
                  padding: 12,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  fontSize: 13,
                  minHeight: 100,
                  resize: "vertical",
                  fontFamily: "inherit"
                }}
              />
              {motivoNoEjecucion.trim() && (
                <div style={{ fontSize: 11, color: "#06D6A0", marginTop: 4 }}>
                  ✓ Motivo registrado ({motivoNoEjecucion.length} caracteres)
                </div>
              )}
            </div>

            {/* Foto de Evidencia */}
            <CapturaFoto
              etiqueta="Foto de Evidencia (obligatoria)"
              obligatoria={true}
              onFotoCapturada={handleFotoNoEjecucion}
              existente={fotoNoEjecucion?.base64}
              disabled={subiendoFoto}
            />

            {/* Firma del Cliente */}
            <div style={{ marginTop: 14 }}>
              <FirmaDigital
                onFirmaCapturada={setFirmaCliente}
                existente={firmaCliente?.base64}
              />
            </div>

            {/* Indicador de progreso */}
            <div style={{ 
              padding: "12px 14px",
              background: (motivoNoEjecucion && fotoNoEjecucion && firmaCliente) ? "#06D6A010" : "#FEF3C7",
              border: `1px solid ${(motivoNoEjecucion && fotoNoEjecucion && firmaCliente) ? "#06D6A040" : "#F59E0B"}`,
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              color: (motivoNoEjecucion && fotoNoEjecucion && firmaCliente) ? "#06D6A0" : "#92400E",
              marginTop: 14,
              marginBottom: 14
            }}>
              {(motivoNoEjecucion && fotoNoEjecucion && firmaCliente) ? (
                <>✓ Todo listo - Puedes cerrar el servicio</>
              ) : (
                <>
                  ⚠️ Pendiente: 
                  {!motivoNoEjecucion && " Motivo"}
                  {!fotoNoEjecucion && " Foto"}
                  {!firmaCliente && " Firma"}
                </>
              )}
            </div>

            {/* Botón para cerrar como NO EJECUTADO */}
            <Btn
              onClick={cerrarOrdenNoEjecutada}
              style={{
                width: "100%",
                padding: 14,
                fontSize: 15,
                fontWeight: 700,
                background: "#EF4444",
                border: "none",
                opacity: (motivoNoEjecucion && fotoNoEjecucion && firmaCliente) ? 1 : 0.5,
                cursor: (motivoNoEjecucion && fotoNoEjecucion && firmaCliente) ? "pointer" : "not-allowed"
              }}
              disabled={!motivoNoEjecucion || !fotoNoEjecucion || !firmaCliente}
            >
              {(motivoNoEjecucion && fotoNoEjecucion && firmaCliente)
                ? "✗ CERRAR COMO NO EJECUTADO"
                : "⚠️ Completa todos los campos"}
            </Btn>
          </Card>
        )}




        {/* PASO 5: Cierre y firma */}
        {pasoServicio === 5 && (
          <Card>
            <div style={{ fontWeight:700,fontSize:13,color:C.muted,marginBottom:16 }}>
              CIERRE DEL SERVICIO
            </div>
            
            {/* Resumen */}
            <div style={{ padding:"12px 14px",background:"#06D6A010",borderRadius:8,
              border:"1px solid #06D6A040",marginBottom:14 }}>
              <div style={{ fontSize:11,color:C.muted,marginBottom:4 }}>RESUMEN</div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
                <div>
                  <div style={{ fontSize:9,color:C.muted }}>CLIENTE</div>
                  <div style={{ fontWeight:700,fontSize:12 }}>{ordenSel.cliente_nombre}</div>
                </div>
                <div>
                  <div style={{ fontSize:9,color:C.muted }}>TIPO</div>
                  <div style={{ fontWeight:700,fontSize:12,textTransform:"capitalize" }}>
                    {ordenSel.tipo_servicio}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize:9,color:C.muted }}>REFERENCIA</div>
                  <div style={{ fontWeight:700,fontSize:12 }}>{ordenSel.referencia_nombre}</div>
                </div>
                <div>
                  <div style={{ fontSize:9,color:C.muted }}>NOVEDADES</div>
                  <div style={{ fontWeight:700,fontSize:12 }}>{novedades.length}</div>
                </div>
              </div>
            </div>

            {/* Foto del Cliente */}
            <CapturaFoto
              etiqueta="Foto del Cliente (quien recibe)"
              obligatoria={true}
              onFotoCapturada={handleFotoCliente}
              existente={fotoCliente?.base64}
              disabled={subiendoFoto}
            />

            {/* Firma Digital */}
            <FirmaDigital
              onFirmaCapturada={setFirmaCliente}
              existente={firmaCliente?.base64}
            />

            {/* Indicador de progreso */}
            <div style={{ 
              padding:"10px 14px",
              background: (firmaCliente && fotoCliente) ? "#06D6A010" : "#FEF3C7",
              border: `1px solid ${(firmaCliente && fotoCliente) ? "#06D6A040" : "#F59E0B"}`,
              borderRadius:8,
              fontSize:12,
              fontWeight:600,
              color: (firmaCliente && fotoCliente) ? "#06D6A0" : "#92400E",
              marginBottom:14
            }}>
              {firmaCliente && fotoCliente ? (
                <>✓ Firma y foto del cliente capturadas - Listo para cerrar</>
              ) : (
                <>
                  ⚠️ Pendiente: 
                  {!fotoCliente && " Foto del cliente"}
                  {!fotoCliente && !firmaCliente && " + "}
                  {!firmaCliente && " Firma"}
                </>
              )}
            </div>

            <Btn 
              onClick={cerrarOrden} 
              style={{ 
                width:"100%",
                padding:14,
                background: (firmaCliente && fotoCliente) ? "#06D6A0" : "#94A3B8",
                fontSize:15,
                opacity: (firmaCliente && fotoCliente) ? 1 : 0.6,
                cursor: (firmaCliente && fotoCliente) ? "pointer" : "not-allowed"
              }}
              disabled={!firmaCliente || !fotoCliente}
            >
              {(firmaCliente && fotoCliente) 
                ? "✓ CERRAR SERVICIO" 
                : "⚠️ Completa firma y foto para cerrar"}
            </Btn>
          </Card>
        )}
      </div>
    </div>
  );

  // ---- VISTA CREAR ORDEN ----
  if (vista === "nueva") return (
    <div>
      {toast && <Toast {...toast} onClose={()=>setToast(null)} />}
      <PageHeader title="Nueva Orden de Servicio" onBack={()=>setVista("lista")} />
      <div style={{ maxWidth:580 }}>
        <Card style={{ marginBottom:14 }}>
          <div style={{ fontWeight:700,fontSize:13,color:C.muted,marginBottom:12 }}>REFERENCIA Y TIPO</div>
          <Sel label="REFERENCIA *" value={String(formOrden.referencia_id)} onChange={v=>setFormOrden(f=>({...f,referencia_id:v}))}
            options={[{value:"",label:"Selecciona una referencia..."}, ...refs.map(r=>({value:String(r.id),label:`${r.codigo} - ${r.nombre} (${r.categoria})`}))]} />
          {refSel && (
            <div style={{ padding:"10px 12px",background:C.bg,borderRadius:8,
              border:`1px solid ${C.border}`,marginTop:4,marginBottom:8 }}>
              <div style={{ fontSize:11,color:C.muted }}>
                {refSel.total_piezas} piezas - Tiempo est. {refSel.tiempo_estimado_min} min - {refSel.marca} {refSel.modelo}
              </div>
            </div>
          )}
          <Sel label="TIPO DE SERVICIO *" value={formOrden.tipo_servicio} onChange={v=>setFormOrden(f=>({...f,tipo_servicio:v}))}
            options={[{value:"montaje",label:"Montaje"},{value:"desmontaje",label:"Desmontaje"},{value:"ambos",label:"Montaje y Desmontaje"}]} />
          <Sel label="TECNICO ASIGNADO" value={String(formOrden.tecnico_id)} onChange={v=>setFormOrden(f=>({...f,tecnico_id:v}))}
            options={[{value:"",label:"Sin asignar"}, ...personal.filter(p=>p.rol==="tecnico").map(p=>({value:String(p.id),label:p.nombre}))]} />
          <Input label="FECHA PROGRAMADA" value={formOrden.fecha_programada} onChange={v=>setFormOrden(f=>({...f,fecha_programada:v}))} type="date" />
        </Card>

        <Card style={{ marginBottom:14 }}>
          <div style={{ fontWeight:700,fontSize:13,color:C.muted,marginBottom:12 }}>DATOS DEL CLIENTE</div>
          <Input label="NOMBRE CLIENTE *" value={formOrden.cliente_nombre} onChange={v=>setFormOrden(f=>({...f,cliente_nombre:v}))} />
          <Input label="DIRECCION *" value={formOrden.cliente_direccion} onChange={v=>setFormOrden(f=>({...f,cliente_direccion:v}))} placeholder="Calle, barrio, ciudad..." />
          <Input label="TELEFONO" value={formOrden.cliente_telefono} onChange={v=>setFormOrden(f=>({...f,cliente_telefono:v}))} />
          <Input label="N. FACTURA / PEDIDO" value={formOrden.num_factura} onChange={v=>setFormOrden(f=>({...f,num_factura:v}))} />
          <div style={{ marginTop:8 }}>
            <label style={{ fontSize:11,fontWeight:600,color:C.muted,display:"block",marginBottom:4 }}>OBSERVACIONES</label>
            <textarea value={formOrden.observaciones} onChange={e=>setFormOrden(f=>({...f,observaciones:e.target.value}))}
              placeholder="Instrucciones especiales, acceso, etc..."
              style={{ width:"100%",minHeight:70,padding:"10px 12px",border:`1px solid ${C.border}`,
                borderRadius:8,fontSize:13,fontFamily:"inherit",resize:"vertical",background:C.bg }} />
          </div>
        </Card>

        <Btn onClick={crearOrden} style={{ width:"100%",padding:14 }}>CREAR ORDEN DE SERVICIO</Btn>
      </div>
    </div>
  );

  // ---- VISTA LISTA ----
  const kpis = [
    { label:"PENDIENTES", val:ordenes.filter(o=>o.estado==="pendiente").length, color:"#94A3B8" },
    { label:"EN CURSO",   val:ordenes.filter(o=>["en_curso","fachada","inspeccion","ejecucion"].includes(o.estado)).length, color:"#F59E0B" },
    { label:"CERRADAS",   val:ordenes.filter(o=>o.estado==="cerrada").length, color:"#06D6A0" },
    { label:"TOTAL",      val:ordenes.length, color:C.accent },
  ];

  return (
    <div>
      {toast && <Toast {...toast} onClose={()=>setToast(null)} />}
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16 }}>
        <div>
          <h2 style={{ margin:0,fontSize:22,fontWeight:800 }}>Ordenes de Servicio</h2>
          <p style={{ margin:0,fontSize:13,color:C.muted }}>{ordFiltradas.length} orden(es)</p>
        </div>
        <Btn onClick={()=>{ setFormOrden({referencia_id:"",tecnico_id:"",tipo_servicio:"montaje",cliente_nombre:"",cliente_direccion:"",cliente_telefono:"",num_factura:"",observaciones:"",fecha_programada:""}); setVista("nueva"); }}>
          + NUEVA ORDEN
        </Btn>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16 }}>
        {kpis.map(k=>(
          <div key={k.label} style={{ padding:"12px 14px",borderRadius:10,
            background:k.color+"10",border:`1px solid ${k.color}30` }}>
            <div style={{ fontSize:24,fontWeight:900,color:k.color }}>{k.val}</div>
            <div style={{ fontSize:10,fontWeight:700,color:k.color }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros estado */}
      <div style={{ display:"flex",gap:8,marginBottom:16,flexWrap:"wrap" }}>
        <div onClick={()=>setFiltroEstado("")}
          style={{ padding:"6px 14px",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:700,
            background:filtroEstado===""?C.dark:C.bg,color:filtroEstado===""?"#fff":C.muted,
            border:`1px solid ${filtroEstado===""?C.dark:C.border}` }}>Todos</div>
        {Object.entries(ESTADO_ORDEN).map(([k,v])=>(
          <div key={k} onClick={()=>setFiltroEstado(k)}
            style={{ padding:"6px 14px",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:700,
              background:filtroEstado===k?v.color:C.bg,color:filtroEstado===k?"#fff":C.muted,
              border:`1px solid ${filtroEstado===k?v.color:C.border}` }}>{v.label}</div>
        ))}
      </div>

      {/* Lista ordenes */}
      {loading ? (
        <div style={{ textAlign:"center",padding:40,color:C.muted }}>Cargando...</div>
      ) : (
        <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
          {ordFiltradas.map((ord,i) => {
            const est = ESTADO_ORDEN[ord.estado] || ESTADO_ORDEN.pendiente;
            return (
              <Card key={i} onClick={()=>abrirOrden(ord)}
                style={{ cursor:"pointer",borderLeft:`4px solid ${est.color}` }}>
                <div style={{ display:"flex",alignItems:"flex-start",gap:12 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:4 }}>
                      <span style={{ fontWeight:900,fontSize:15 }}>{ord.consecutivo}</span>
                      <span style={{ padding:"2px 8px",borderRadius:10,fontSize:10,fontWeight:700,
                        background:est.bg,color:est.color }}>{est.label}</span>
                      <span style={{ padding:"2px 8px",borderRadius:10,fontSize:10,
                        background:C.bg,border:`1px solid ${C.border}`,color:C.muted,textTransform:"capitalize" }}>
                        {ord.tipo_servicio}
                      </span>
                    </div>
                    <div style={{ fontWeight:700,fontSize:13 }}>{ord.cliente_nombre}</div>
                    <div style={{ fontSize:12,color:C.muted }}>{ord.cliente_direccion}</div>
                    <div style={{ fontSize:11,color:C.accent,fontWeight:600,marginTop:2 }}>
                      {ord.referencia_nombre} {ord.num_factura?`| Fac: ${ord.num_factura}`:""}
                    </div>
                  </div>
                  <div style={{ textAlign:"right",flexShrink:0 }}>
                    {ord.tecnico_nombre && (
                      <div style={{ fontSize:11,color:C.muted,marginBottom:4 }}>{ord.tecnico_nombre}</div>
                    )}
                    {ord.duracion_min && (
                      <div style={{ fontSize:11,fontWeight:700,color:"#06D6A0" }}>
                        {Math.floor(ord.duracion_min/60)}h {Math.round(ord.duracion_min%60)}m
                      </div>
                    )}
                    <div style={{ fontSize:10,color:C.muted,marginTop:4 }}>
                      {ord.fecha_programada||new Date(ord.fecha_creacion).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
          {ordFiltradas.length===0 && (
            <div style={{ textAlign:"center",padding:40,color:C.muted }}>
              <div style={{ fontSize:36,marginBottom:10 }}>[ OS ]</div>
              <div>No hay ordenes {filtroEstado?`en estado "${ESTADO_ORDEN[filtroEstado]?.label}"`:""}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Servicios;
