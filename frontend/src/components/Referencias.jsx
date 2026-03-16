import { useState, useEffect } from "react";
import { C, API_URL } from "../shared/constants";
import { Card, Btn, Input, Sel, PageHeader, Toast } from "../shared/ui";
import { useData } from "../context/DataContext";

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

const Referencias = ({ onBack }) => {
  const [vista, setVista]     = useState("lista");
  const [lista, setLista]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast]     = useState(null);
  const [refSel, setRefSel]   = useState(null);
  const [filtroCat, setFiltroCat] = useState("");
  const [piezas, setPiezas]   = useState([{ nombre:"", cantidad:1, unidad:"und", descripcion:"" }]);
  const [form, setForm]       = useState({
    codigo:"", nombre:"", categoria:"muebles", descripcion:"",
    tiempo_estimado_min:60, marca:"", modelo:"", activo:true
  });

  const cargar = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/referencias`);
      const d = await r.json();
      setLista(Array.isArray(d) ? d : []);
    } catch { setLista([]); }
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const addPieza = () => setPiezas(p => [...p, { nombre:"", cantidad:1, unidad:"und", descripcion:"" }]);
  const delPieza = (i) => setPiezas(p => p.filter((_,idx) => idx !== i));
  const updPieza = (i, field, val) => setPiezas(p => p.map((x,idx) => idx===i ? {...x,[field]:val} : x));

  const guardar = async () => {
    if (!form.nombre || !form.codigo) { setToast({ msg:"Codigo y nombre son obligatorios", type:"error" }); return; }
    if (piezas.some(p => !p.nombre)) { setToast({ msg:"Todas las piezas deben tener nombre", type:"error" }); return; }
    try {
      const url = refSel ? `${API_URL}/referencias/${refSel.id}` : `${API_URL}/referencias`;
      const method = refSel ? "PUT" : "POST";
      const res = await fetch(url, {
        method, headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ ...form, piezas })
      });
      if (res.ok) {
        setToast({ msg: refSel ? "Referencia actualizada" : "Referencia creada exitosamente", type:"success" });
        setTimeout(() => { setVista("lista"); setRefSel(null); cargar(); }, 1400);
      } else {
        const e = await res.json();
        setToast({ msg: e.detail || "Error al guardar", type:"error" });
      }
    } catch { setToast({ msg:"Error de conexion", type:"error" }); }
  };

  const abrirEdicion = (ref) => {
    setRefSel(ref);
    setForm({
      codigo: ref.codigo, nombre: ref.nombre, categoria: ref.categoria,
      descripcion: ref.descripcion, tiempo_estimado_min: ref.tiempo_estimado_min,
      marca: ref.marca, modelo: ref.modelo, activo: ref.activo
    });
    setPiezas(ref.piezas?.length > 0 ? ref.piezas.map(p=>({nombre:p.nombre,cantidad:p.cantidad,unidad:p.unidad,descripcion:p.descripcion})) : [{ nombre:"", cantidad:1, unidad:"und", descripcion:"" }]);
    setVista("form");
  };

  const listFiltrada = filtroCat ? lista.filter(r=>r.categoria===filtroCat) : lista;
  const catInfo = (id) => CATEGORIAS_REF.find(c=>c.id===id) || { label:id, icon:"??" };
  const catColores = { muebles:"#06D6A0",closets:"#00B4D8",escritorios:"#F59E0B",cocinas:"#EF4444",bibliotecas:"#8B5CF6",camas:"#EC4899",salas:"#14B8A6",oficina:"#F97316",otro:"#94A3B8" };

  // ---- VISTA DETALLE ----
  if (vista === "detalle" && refSel) return (
    <div>
      {toast && <Toast {...toast} onClose={()=>setToast(null)} />}
      <PageHeader title="Detalle Referencia" onBack={()=>{ setVista("lista"); setRefSel(null); }} />
      <div style={{ maxWidth:640 }}>
        <Card style={{ marginBottom:14 }}>
          <div style={{ display:"flex", alignItems:"flex-start", gap:14, marginBottom:16 }}>
            <div style={{ width:56,height:56,borderRadius:12,flexShrink:0,
              background:(catColores[refSel.categoria]||C.accent)+"20",
              border:`2px solid ${catColores[refSel.categoria]||C.accent}`,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontWeight:900,fontSize:13,color:catColores[refSel.categoria]||C.accent }}>
              {catInfo(refSel.categoria).icon}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11,fontWeight:700,color:catColores[refSel.categoria]||C.accent }}>
                {catInfo(refSel.categoria).label} - {refSel.codigo}
              </div>
              <div style={{ fontSize:20,fontWeight:900,marginBottom:2 }}>{refSel.nombre}</div>
              <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                {refSel.marca && <span style={{ fontSize:11,color:C.muted }}>{refSel.marca}</span>}
                {refSel.modelo && <span style={{ fontSize:11,color:C.muted }}>/ {refSel.modelo}</span>}
                <span style={{ padding:"2px 8px",borderRadius:10,fontSize:10,fontWeight:700,
                  background:refSel.activo?"#06D6A015":"#EF444415",
                  color:refSel.activo?"#06D6A0":"#EF4444" }}>{refSel.activo?"ACTIVO":"INACTIVO"}</span>
              </div>
            </div>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14 }}>
            <div style={{ padding:"10px 14px",background:C.bg,borderRadius:8,border:`1px solid ${C.border}` }}>
              <div style={{ fontSize:10,fontWeight:700,color:C.muted }}>TIEMPO ESTIMADO</div>
              <div style={{ fontSize:16,fontWeight:800 }}>{refSel.tiempo_estimado_min} min</div>
            </div>
            <div style={{ padding:"10px 14px",background:C.bg,borderRadius:8,border:`1px solid ${C.border}` }}>
              <div style={{ fontSize:10,fontWeight:700,color:C.muted }}>TOTAL PIEZAS</div>
              <div style={{ fontSize:16,fontWeight:800 }}>{refSel.piezas?.length || 0} items</div>
            </div>
          </div>
          {refSel.descripcion && (
            <div style={{ padding:"10px 14px",background:"#F59E0B10",borderRadius:8,border:"1px solid #F59E0B30",marginBottom:14 }}>
              <div style={{ fontSize:10,fontWeight:700,color:"#F59E0B",marginBottom:4 }}>DESCRIPCION</div>
              <div style={{ fontSize:13 }}>{refSel.descripcion}</div>
            </div>
          )}
        </Card>

        {/* Lista de piezas */}
        <Card>
          <div style={{ fontWeight:700,fontSize:13,color:C.muted,marginBottom:12 }}>
            LISTA DE PIEZAS ({refSel.piezas?.length || 0})
          </div>
          {refSel.piezas?.map((p,i) => (
            <div key={i} style={{ display:"flex",alignItems:"center",gap:10,
              padding:"10px 12px",marginBottom:8,background:C.bg,
              borderRadius:8,border:`1px solid ${C.border}` }}>
              <div style={{ width:28,height:28,borderRadius:"50%",flexShrink:0,
                background:(catColores[refSel.categoria]||C.accent)+"20",
                display:"flex",alignItems:"center",justifyContent:"center",
                fontWeight:800,fontSize:12,color:catColores[refSel.categoria]||C.accent }}>
                {i+1}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700,fontSize:13 }}>{p.nombre}</div>
                {p.descripcion && <div style={{ fontSize:11,color:C.muted }}>{p.descripcion}</div>}
              </div>
              <div style={{ textAlign:"right",flexShrink:0 }}>
                <div style={{ fontWeight:800,fontSize:14 }}>{p.cantidad}</div>
                <div style={{ fontSize:10,color:C.muted }}>{p.unidad}</div>
              </div>
            </div>
          ))}
          {(!refSel.piezas || refSel.piezas.length===0) && (
            <div style={{ textAlign:"center",padding:20,color:C.muted,fontSize:13 }}>Sin piezas registradas</div>
          )}
          <div style={{ display:"flex",gap:10,marginTop:14 }}>
            <Btn onClick={()=>abrirEdicion(refSel)} style={{ flex:1 }}>EDITAR</Btn>
          </div>
        </Card>
      </div>
    </div>
  );

  // ---- VISTA FORM ----
  if (vista === "form") return (
    <div>
      {toast && <Toast {...toast} onClose={()=>setToast(null)} />}
      <PageHeader title={refSel?"Editar Referencia":"Nueva Referencia"}
        onBack={()=>{ setVista("lista"); setRefSel(null); }} />
      <div style={{ maxWidth:680 }}>

        {/* Datos basicos */}
        <Card style={{ marginBottom:14 }}>
          <div style={{ fontWeight:700,fontSize:13,color:C.muted,marginBottom:12 }}>IDENTIFICACION</div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
            <Input label="CODIGO *" value={form.codigo} onChange={v=>setForm(f=>({...f,codigo:v.toUpperCase()}))} placeholder="Ej: MU-001" />
            <Input label="NOMBRE *" value={form.nombre} onChange={v=>setForm(f=>({...f,nombre:v}))} placeholder="Ej: Closet 3 puertas" />
            <Sel label="CATEGORIA" value={form.categoria} onChange={v=>setForm(f=>({...f,categoria:v}))}
              options={CATEGORIAS_REF.map(c=>({value:c.id,label:c.label}))} />
            <Input label="TIEMPO ESTIMADO (min)" value={String(form.tiempo_estimado_min)}
              onChange={v=>setForm(f=>({...f,tiempo_estimado_min:parseInt(v)||60}))} />
            <Input label="MARCA" value={form.marca} onChange={v=>setForm(f=>({...f,marca:v}))} />
            <Input label="MODELO / REFERENCIA" value={form.modelo} onChange={v=>setForm(f=>({...f,modelo:v}))} />
          </div>
          <div style={{ marginTop:12 }}>
            <label style={{ fontSize:11,fontWeight:600,color:C.muted,display:"block",marginBottom:4 }}>DESCRIPCION</label>
            <textarea value={form.descripcion} onChange={e=>setForm(f=>({...f,descripcion:e.target.value}))}
              placeholder="Descripcion del producto, materiales, caracteristicas..."
              style={{ width:"100%",minHeight:70,padding:"10px 12px",border:`1px solid ${C.border}`,
                borderRadius:8,fontSize:13,fontFamily:"inherit",resize:"vertical",background:C.bg }} />
          </div>
          <div style={{ marginTop:12,display:"flex",alignItems:"center",gap:10 }}>
            <input type="checkbox" id="activo" checked={form.activo} onChange={e=>setForm(f=>({...f,activo:e.target.checked}))} />
            <label htmlFor="activo" style={{ fontSize:13,fontWeight:600 }}>Referencia activa</label>
          </div>
        </Card>

        {/* Foto placeholder */}
        <Card style={{ marginBottom:14 }}>
          <div style={{ fontWeight:700,fontSize:13,color:C.muted,marginBottom:12 }}>FOTO DE REFERENCIA</div>
          <div style={{ border:`2px dashed ${C.border}`,borderRadius:10,padding:20,
            textAlign:"center",background:C.bg }}>
            <div style={{ fontSize:28,marginBottom:6 }}>[ FOTO ]</div>
            <div style={{ fontSize:12,color:C.muted,marginBottom:10 }}>Foto del producto armado (funcion proxima)</div>
            <div style={{ display:"inline-block",padding:"8px 16px",borderRadius:8,
              background:C.card,border:`1px solid ${C.border}`,
              fontSize:12,color:C.muted,cursor:"not-allowed",opacity:0.6 }}>
              Cargar foto (proximamente)
            </div>
          </div>
        </Card>

        {/* Lista de piezas */}
        <Card style={{ marginBottom:14 }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
            <div style={{ fontWeight:700,fontSize:13,color:C.muted }}>
              LISTA DE PIEZAS ({piezas.length})
            </div>
            <Btn onClick={addPieza} variant="ghost" style={{ fontSize:11 }}>+ AGREGAR PIEZA</Btn>
          </div>

          {/* Header */}
          <div style={{ display:"grid",gridTemplateColumns:"32px 1fr 80px 70px 120px 32px",
            gap:8,padding:"6px 8px",marginBottom:4 }}>
            {["#","NOMBRE PIEZA","CANT.","UNIDAD","DESCRIPCION",""].map((h,i)=>(
              <div key={i} style={{ fontSize:10,fontWeight:700,color:C.muted }}>{h}</div>
            ))}
          </div>

          {piezas.map((p,i) => (
            <div key={i} style={{ display:"grid",gridTemplateColumns:"32px 1fr 80px 70px 120px 32px",
              gap:8,alignItems:"center",marginBottom:8,
              padding:"6px 8px",background:C.bg,borderRadius:8,border:`1px solid ${C.border}` }}>
              <div style={{ width:28,height:28,borderRadius:"50%",
                background:(catColores[form.categoria]||C.accent)+"20",
                display:"flex",alignItems:"center",justifyContent:"center",
                fontWeight:800,fontSize:11,color:catColores[form.categoria]||C.accent }}>
                {i+1}
              </div>
              <input value={p.nombre} onChange={e=>updPieza(i,"nombre",e.target.value)}
                placeholder="Nombre de la pieza..."
                style={{ padding:"7px 10px",border:`1px solid ${C.border}`,borderRadius:6,
                  fontSize:12,background:"white",width:"100%" }} />
              <input type="number" min="1" value={p.cantidad} onChange={e=>updPieza(i,"cantidad",parseInt(e.target.value)||1)}
                style={{ padding:"7px 10px",border:`1px solid ${C.border}`,borderRadius:6,
                  fontSize:12,textAlign:"center",background:"white" }} />
              <select value={p.unidad} onChange={e=>updPieza(i,"unidad",e.target.value)}
                style={{ padding:"7px 6px",border:`1px solid ${C.border}`,borderRadius:6,
                  fontSize:11,background:"white" }}>
                {["und","pza","par","set","mts","kg"].map(u=><option key={u}>{u}</option>)}
              </select>
              <input value={p.descripcion} onChange={e=>updPieza(i,"descripcion",e.target.value)}
                placeholder="Nota opcional..."
                style={{ padding:"7px 10px",border:`1px solid ${C.border}`,borderRadius:6,
                  fontSize:11,background:"white",width:"100%" }} />
              <div onClick={()=>delPieza(i)}
                style={{ width:28,height:28,borderRadius:"50%",background:"#EF444415",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  cursor:"pointer",color:"#EF4444",fontSize:14,fontWeight:700 }}>x</div>
            </div>
          ))}

          <div onClick={addPieza}
            style={{ border:`2px dashed ${C.border}`,borderRadius:8,padding:10,
              textAlign:"center",cursor:"pointer",color:C.muted,fontSize:12,marginTop:4 }}>
            + Agregar otra pieza
          </div>
        </Card>

        <Btn onClick={guardar} style={{ width:"100%",padding:14 }}>
          {refSel ? "GUARDAR CAMBIOS" : "CREAR REFERENCIA"}
        </Btn>
      </div>
    </div>
  );

  // ---- VISTA LISTA ----
  return (
    <div>
      {toast && <Toast {...toast} onClose={()=>setToast(null)} />}
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16 }}>
        <div>
          <h2 style={{ margin:0,fontSize:22,fontWeight:800 }}>Maestro de Referencias</h2>
          <p style={{ margin:0,fontSize:13,color:C.muted }}>{listFiltrada.length} referencia(s) registrada(s)</p>
        </div>
        <Btn onClick={()=>{ setRefSel(null); setForm({codigo:"",nombre:"",categoria:"muebles",descripcion:"",tiempo_estimado_min:60,marca:"",modelo:"",activo:true}); setPiezas([{nombre:"",cantidad:1,unidad:"und",descripcion:""}]); setVista("form"); }}>
          + NUEVA REFERENCIA
        </Btn>
      </div>

      {/* Filtros categoria */}
      <div style={{ display:"flex",gap:8,marginBottom:18,flexWrap:"wrap" }}>
        <div onClick={()=>setFiltroCat("")} style={{ padding:"6px 14px",borderRadius:20,cursor:"pointer",
          fontSize:12,fontWeight:700,
          background:filtroCat===""?C.accent:C.bg,
          color:filtroCat===""?"#fff":C.muted,
          border:`1px solid ${filtroCat===""?C.accent:C.border}` }}>Todos</div>
        {CATEGORIAS_REF.map(cat => {
          const cnt = lista.filter(r=>r.categoria===cat.id).length;
          if (cnt === 0) return null;
          return (
            <div key={cat.id} onClick={()=>setFiltroCat(cat.id)}
              style={{ padding:"6px 14px",borderRadius:20,cursor:"pointer",
                fontSize:12,fontWeight:700,display:"flex",alignItems:"center",gap:6,
                background:filtroCat===cat.id?(catColores[cat.id]||C.accent):C.bg,
                color:filtroCat===cat.id?"#fff":C.muted,
                border:`1px solid ${filtroCat===cat.id?(catColores[cat.id]||C.accent):C.border}` }}>
              {cat.label}
              <span style={{ background:"rgba(0,0,0,0.15)",borderRadius:10,padding:"1px 6px",fontSize:10 }}>{cnt}</span>
            </div>
          );
        })}
      </div>

      {loading ? (
        <div style={{ textAlign:"center",padding:40,color:C.muted }}>Cargando...</div>
      ) : (
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:14 }}>
          {listFiltrada.map((ref,i) => (
            <Card key={i} onClick={()=>{ setRefSel(ref); setVista("detalle"); }}
              style={{ cursor:"pointer",borderLeft:`4px solid ${catColores[ref.categoria]||C.accent}` }}>
              <div style={{ display:"flex",alignItems:"flex-start",gap:12,marginBottom:10 }}>
                <div style={{ width:48,height:48,borderRadius:10,flexShrink:0,
                  background:(catColores[ref.categoria]||C.accent)+"20",
                  border:`2px solid ${catColores[ref.categoria]||C.accent}`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontWeight:900,fontSize:12,color:catColores[ref.categoria]||C.accent }}>
                  {catInfo(ref.categoria).icon}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:10,fontWeight:700,color:catColores[ref.categoria]||C.accent }}>
                    {catInfo(ref.categoria).label} - {ref.codigo}
                  </div>
                  <div style={{ fontWeight:800,fontSize:14,marginBottom:2 }}>{ref.nombre}</div>
                  {(ref.marca||ref.modelo) && (
                    <div style={{ fontSize:11,color:C.muted }}>{[ref.marca,ref.modelo].filter(Boolean).join(" / ")}</div>
                  )}
                </div>
                <span style={{ padding:"2px 8px",borderRadius:10,fontSize:10,fontWeight:700,flexShrink:0,
                  background:ref.activo?"#06D6A015":"#EF444415",
                  color:ref.activo?"#06D6A0":"#EF4444" }}>{ref.activo?"ACTIVO":"INACTIVO"}</span>
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,
                paddingTop:10,borderTop:`1px solid ${C.border}` }}>
                <div>
                  <div style={{ fontSize:9,color:C.muted,fontWeight:700 }}>PIEZAS</div>
                  <div style={{ fontSize:13,fontWeight:800 }}>{ref.total_piezas} items</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:9,color:C.muted,fontWeight:700 }}>TIEMPO EST.</div>
                  <div style={{ fontSize:13,fontWeight:800 }}>{ref.tiempo_estimado_min} min</div>
                </div>
              </div>
            </Card>
          ))}
          {listFiltrada.length === 0 && (
            <div style={{ gridColumn:"1/-1",textAlign:"center",padding:40 }}>
              <div style={{ fontSize:36,marginBottom:10 }}>[ REF ]</div>
              <div style={{ color:C.muted }}>No hay referencias registradas</div>
              <div style={{ fontSize:12,color:C.muted,marginTop:4 }}>
                {filtroCat ? "Prueba con otra categoria" : "Crea la primera referencia"}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Referencias;
