import { useState, useEffect, useRef } from "react";
import { C, API_URL } from "../shared/constants";
import { Card, Btn, Input, Sel, PageHeader, Toast, Alert } from "../shared/ui";

const ESTADO_ORDEN = {
  pendiente:   { color: "#94A3B8", label: "Pendiente",   icon: "o" },
  en_curso:    { color: "#00B4D8", label: "En Curso",    icon: ">" },
  inspeccion:  { color: "#F59E0B", label: "Inspeccion",  icon: "" },
  completado:  { color: "#06D6A0", label: "Completado",  icon: "v" },
  cancelado:   { color: "#EF4444", label: "Cancelado",   icon: "?" },
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
  const [novedades, setNovedades]       = useState([]);
  const [formNovedad, setFormNovedad]   = useState({ descripcion:"", tipo:"averia", accion:"cambio" });
  const [showNovedad, setShowNovedad]   = useState(false);
  const firmaRef = useRef(null);
  const [firmando, setFirmando]         = useState(false);

  const [formOrden, setFormOrden] = useState({
    referencia_id:"", tecnico_id:"", tipo_servicio:"montaje",
    cliente_nombre:"", cliente_direccion:"", cliente_telefono:"",
    num_factura:"", observaciones:"", fecha_programada:""
  });

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
        setTimeout(() => { setVista("lista"); cargar(); }, 1400);
      } else { const e=await res.json(); setToast({ msg:e.detail||"Error", type:"error" }); }
    } catch { setToast({ msg:"Error de conexion", type:"error" }); }
  };

  const abrirOrden = async (ord) => {
    setOrdenSel(ord);
    // Cargar piezas de la referencia para inspeccion
    if (ord.referencia_id) {
      const refData = refs.find(r=>r.id===ord.referencia_id);
      if (refData?.piezas) {
        setInspeccion(refData.piezas.map(p=>({ pieza_id:p.id, nombre_pieza:p.nombre, estado:"ok", novedad_descripcion:"", accion_solicitada:"ninguna" })));
      }
    }
    const novsRes = await fetch(`${API_URL}/ordenes/${ord.id}/detalle`).then(r=>r.json()).catch(()=>({}));
    setNovedades(novsRes.novedades||[]);
    setPasoServicio(ord.estado==="pendiente"?1:ord.estado==="en_curso"?2:ord.estado==="inspeccion"?3:ord.estado==="ejecucion"?4:5);
    setVista("servicio");
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
      setPasoServicio(2);
      setToast({ msg:"Orden iniciada - GPS registrado", type:"success" });
    } catch { setToast({ msg:"Error al iniciar", type:"error" }); }
  };

  const guardarInspeccion = async () => {
    try {
      await fetch(`${API_URL}/ordenes/${ordenSel.id}/inspeccion`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify(inspeccion)
      });
      setOrdenSel(o=>({...o, estado:"inspeccion"}));
      setPasoServicio(3);
      setToast({ msg:"Inspeccion guardada", type:"success" });
    } catch { setToast({ msg:"Error al guardar inspeccion", type:"error" }); }
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
    setPasoServicio(4);
  };

  const cerrarOrden = async () => {
    try {
      await fetch(`${API_URL}/ordenes/${ordenSel.id}/cerrar`, { method:"PATCH" });
      setOrdenSel(o=>({...o, estado:"cerrada"}));
      setToast({ msg:"Servicio cerrado exitosamente", type:"success" });
      setTimeout(()=>{ setVista("lista"); cargar(); }, 1600);
    } catch { setToast({ msg:"Error al cerrar", type:"error" }); }
  };

  const ordFiltradas = filtroEstado ? ordenes.filter(o=>o.estado===filtroEstado) : ordenes;
  const refSel = refs.find(r=>r.id===parseInt(formOrden.referencia_id));

  // ---- PASOS INDICADOR ----
  const PasosIndicador = ({ paso }) => {
    const pasos = ["Inicio","Fachada","Inspeccion","Ejecucion","Cierre"];
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

  // ---- VISTA SERVICIO (flujo tecnico) ----
  if (vista === "servicio" && ordenSel) return (
    <div>
      {toast && <Toast {...toast} onClose={()=>setToast(null)} />}
      <PageHeader title={`Orden ${ordenSel.consecutivo}`}
        subtitle={`${ordenSel.tipo_servicio?.toUpperCase()} - ${ordenSel.referencia_nombre}`}
        onBack={()=>{ setVista("lista"); cargar(); }} />
      <div style={{ maxWidth:600 }}>
        <PasosIndicador paso={pasoServicio} />

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

        {/* PASO 1: Iniciar */}
        {pasoServicio === 1 && (
          <Card>
            <div style={{ textAlign:"center",padding:"10px 0 16px" }}>
              <div style={{ fontSize:32,marginBottom:8 }}>[ GPS ]</div>
              <div style={{ fontWeight:800,fontSize:16,marginBottom:6 }}>Iniciar Orden de Servicio</div>
              <div style={{ fontSize:13,color:C.muted,marginBottom:16,lineHeight:1.5 }}>
                Al iniciar se registrara tu ubicacion GPS y comenzara el cronometro del servicio.
              </div>
              <div style={{ border:`2px dashed ${C.border}`,borderRadius:10,padding:16,marginBottom:16,background:C.bg }}>
                <div style={{ fontSize:28,marginBottom:6 }}>[ FOTO ]</div>
                <div style={{ fontSize:12,color:C.muted,marginBottom:8 }}>Foto de fachada del inmueble (obligatoria a futuro)</div>
                <div style={{ display:"inline-block",padding:"8px 16px",borderRadius:8,
                  background:C.card,border:`1px solid ${C.border}`,
                  fontSize:12,color:C.muted,cursor:"not-allowed",opacity:0.6 }}>
                  Capturar foto (proximamente)
                </div>
              </div>
              <Btn onClick={iniciarOrden} style={{ width:"100%",padding:14,fontSize:15 }}>
                INICIAR SERVICIO + GPS
              </Btn>
            </div>
          </Card>
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
                        style={{ padding:"7px 10px",border:`1px solid ${C.border}`,borderRadius:6,fontSize:12,background:"white" }}>
                        <option value="ninguna">Sin accion requerida</option>
                        <option value="cambio">Solicitar cambio</option>
                        <option value="garantia">Solicitar garantia al proveedor</option>
                      </select>
                    </div>
                  )}
                </div>
              ))}
              {inspeccion.length === 0 && (
                <div style={{ textAlign:"center",padding:20,color:C.muted }}>
                  Esta referencia no tiene piezas registradas
                </div>
              )}
              <Btn onClick={guardarInspeccion} style={{ width:"100%",marginTop:8,padding:12 }}>
                GUARDAR INSPECCION
              </Btn>
            </Card>
          </div>
        )}

        {/* PASO 3: Novedades + avanzar */}
        {pasoServicio === 3 && (
          <Card style={{ marginBottom:14 }}>
            <div style={{ fontWeight:700,fontSize:13,color:C.muted,marginBottom:12 }}>NOVEDADES REGISTRADAS</div>
            {novedades.map((n,i)=>(
              <div key={i} style={{ padding:"10px 12px",marginBottom:8,borderRadius:8,
                background: n.tipo==="averia"?"#F59E0B10":n.tipo==="faltante"?"#EF444410":"#00B4D810",
                border:`1px solid ${n.tipo==="averia"?"#F59E0B40":n.tipo==="faltante"?"#EF444440":"#00B4D840"}` }}>
                <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                  <span style={{ fontSize:11,fontWeight:700,
                    color:n.tipo==="averia"?"#F59E0B":n.tipo==="faltante"?"#EF4444":"#00B4D8",
                    textTransform:"uppercase" }}>{n.tipo}</span>
                  <span style={{ fontSize:10,color:C.muted }}>{n.accion}</span>
                </div>
                <div style={{ fontSize:13 }}>{n.descripcion}</div>
              </div>
            ))}
            {novedades.length===0 && (
              <div style={{ textAlign:"center",padding:16,color:C.muted,fontSize:13 }}>
                Sin novedades adicionales registradas
              </div>
            )}
            {showNovedad && (
              <div style={{ padding:"14px",background:C.bg,borderRadius:10,border:`1px solid ${C.border}`,marginBottom:12 }}>
                <div style={{ fontWeight:700,fontSize:12,color:C.muted,marginBottom:10 }}>NUEVA NOVEDAD</div>
                <select value={formNovedad.tipo} onChange={e=>setFormNovedad(f=>({...f,tipo:e.target.value}))}
                  style={{ width:"100%",padding:"8px 10px",border:`1px solid ${C.border}`,borderRadius:6,fontSize:12,marginBottom:8,background:"white" }}>
                  <option value="averia">Averia / Dano</option>
                  <option value="faltante">Pieza Faltante</option>
                  <option value="otro">Otro</option>
                </select>
                <textarea value={formNovedad.descripcion} onChange={e=>setFormNovedad(f=>({...f,descripcion:e.target.value}))}
                  placeholder="Describe la novedad en detalle..."
                  style={{ width:"100%",minHeight:70,padding:"8px 10px",border:`1px solid ${C.border}`,
                    borderRadius:6,fontSize:12,fontFamily:"inherit",resize:"vertical",marginBottom:8 }}/>
                <select value={formNovedad.accion} onChange={e=>setFormNovedad(f=>({...f,accion:e.target.value}))}
                  style={{ width:"100%",padding:"8px 10px",border:`1px solid ${C.border}`,borderRadius:6,fontSize:12,marginBottom:10,background:"white" }}>
                  <option value="cambio">Solicitar cambio de pieza</option>
                  <option value="garantia">Solicitar garantia al proveedor</option>
                  <option value="informativo">Solo informativo</option>
                </select>
                <div style={{ border:`2px dashed ${C.border}`,borderRadius:8,padding:12,textAlign:"center",marginBottom:10,background:"white" }}>
                  <div style={{ fontSize:24,marginBottom:4 }}>[ FOTO ]</div>
                  <div style={{ fontSize:11,color:C.muted }}>Foto evidencia (proximamente)</div>
                </div>
                <div style={{ display:"flex",gap:8 }}>
                  <Btn onClick={guardarNovedad} style={{ flex:1 }}>GUARDAR</Btn>
                  <Btn variant="ghost" onClick={()=>setShowNovedad(false)} style={{ color:C.danger }}>CANCELAR</Btn>
                </div>
              </div>
            )}
            {!showNovedad && (
              <Btn variant="ghost" onClick={()=>setShowNovedad(true)} style={{ width:"100%",marginBottom:10 }}>
                + AGREGAR NOVEDAD
              </Btn>
            )}
            <Btn onClick={avanzarEjecucion} style={{ width:"100%",padding:12 }}>
              INICIAR EJECUCION
            </Btn>
          </Card>
        )}

        {/* PASO 4: Ejecucion */}
        {pasoServicio === 4 && (
          <Card>
            <div style={{ textAlign:"center",padding:"8px 0 14px" }}>
              <div style={{ fontSize:32,marginBottom:8 }}>[ TOOLS ]</div>
              <div style={{ fontWeight:800,fontSize:16,marginBottom:6 }}>En Ejecucion</div>
              <div style={{ fontSize:13,color:C.muted,marginBottom:16 }}>
                Servicio en progreso. Al terminar registra la foto del resultado final y cierra la orden.
              </div>
              <div style={{ border:`2px dashed ${C.border}`,borderRadius:10,padding:16,marginBottom:16,background:C.bg }}>
                <div style={{ fontSize:28,marginBottom:6 }}>[ FOTO FINAL ]</div>
                <div style={{ fontSize:12,color:C.muted,marginBottom:8 }}>Foto del producto instalado (obligatoria a futuro)</div>
                <div style={{ display:"inline-block",padding:"8px 16px",borderRadius:8,
                  background:C.card,border:`1px solid ${C.border}`,
                  fontSize:12,color:C.muted,cursor:"not-allowed",opacity:0.6 }}>
                  Capturar foto (proximamente)
                </div>
              </div>
              <Btn onClick={()=>setPasoServicio(5)} style={{ width:"100%",padding:12 }}>
                FINALIZAR - IR A CIERRE
              </Btn>
            </div>
          </Card>
        )}

        {/* PASO 5: Cierre y firma */}
        {pasoServicio === 5 && (
          <Card>
            <div style={{ fontWeight:700,fontSize:13,color:C.muted,marginBottom:16 }}>CIERRE DEL SERVICIO</div>
            <div style={{ padding:"12px 14px",background:"#06D6A010",borderRadius:8,
              border:"1px solid #06D6A040",marginBottom:14 }}>
              <div style={{ fontSize:11,color:C.muted,marginBottom:4 }}>RESUMEN</div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
                <div><div style={{ fontSize:9,color:C.muted }}>CLIENTE</div><div style={{ fontWeight:700 }}>{ordenSel.cliente_nombre}</div></div>
                <div><div style={{ fontSize:9,color:C.muted }}>TIPO</div><div style={{ fontWeight:700,textTransform:"capitalize" }}>{ordenSel.tipo_servicio}</div></div>
                <div><div style={{ fontSize:9,color:C.muted }}>REFERENCIA</div><div style={{ fontWeight:700 }}>{ordenSel.referencia_nombre}</div></div>
                <div><div style={{ fontSize:9,color:C.muted }}>NOVEDADES</div><div style={{ fontWeight:700 }}>{novedades.length}</div></div>
              </div>
            </div>

            {/* Firma digital placeholder */}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:12,fontWeight:700,color:C.muted,marginBottom:8 }}>FIRMA DEL CLIENTE</div>
              <div style={{ border:`2px dashed ${C.border}`,borderRadius:10,padding:30,
                textAlign:"center",background:C.bg,minHeight:120,
                display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center" }}>
                <div style={{ fontSize:28,marginBottom:6 }}>[ FIRMA ]</div>
                <div style={{ fontSize:12,color:C.muted }}>Firma digital del cliente (proximamente)</div>
              </div>
            </div>

            <Btn onClick={cerrarOrden} style={{ width:"100%",padding:14,background:"#06D6A0",fontSize:15 }}>
              CERRAR SERVICIO
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
    { label:"EN CURSO",   val:ordenes.filter(o=>["en_curso","inspeccion","ejecucion"].includes(o.estado)).length, color:"#F59E0B" },
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
