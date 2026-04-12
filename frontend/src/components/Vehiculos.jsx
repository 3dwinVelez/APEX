import { useState, useEffect } from "react";
import { C, API_URL } from "../shared/constants";
import { Card, Btn, Input, Sel, PageHeader, Toast } from "../shared/ui";
import { TruckIcon } from "./MapaOperarios";
import { useData } from "../context/DataContext";

const TIPOS_VEHICULO = [
  {
    tipo: "Camion",
    categoria: "Carga pesada",
    marca: "Multiple marcas",
    combustible: "Diesel",
    cilindraje: "6000cc+",
    capacidad: "5 - 10 toneladas",
    color_cat: "#EF4444"
  },
  {
    tipo: "Camioneta",
    categoria: "Carga mediana",
    marca: "Multiple marcas",
    combustible: "Gasolina/Diesel",
    cilindraje: "2000cc - 3500cc",
    capacidad: "1 - 3 toneladas",
    color_cat: "#F59E0B"
  },
  {
    tipo: "Furgon",
    categoria: "Carga cerrada",
    marca: "Multiple marcas",
    combustible: "Diesel",
    cilindraje: "2500cc - 4000cc",
    capacidad: "2 - 5 toneladas",
    color_cat: "#8B5CF6"
  },
  {
    tipo: "Moto",
    categoria: "Mensajeria",
    marca: "Multiple marcas",
    combustible: "Gasolina",
    cilindraje: "125cc - 250cc",
    capacidad: "hasta 50kg",
    color_cat: "#06B6D4"
  },
  {
    tipo: "Otro",
    categoria: "Otro tipo",
    marca: "",
    combustible: "",
    cilindraje: "",
    capacidad: "",
    color_cat: "#6B7280"
  }
];


const Vehiculos = ({ onBack }) => {
  const [vista, setVista]       = useState("lista");
  const [lista, setLista]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [toast, setToast]       = useState(null);
  const [vehSel, setVehSel]     = useState(null);
  const [tipoSel, setTipoSel]   = useState(null);
  const [paso, setPaso]         = useState(1); // 1=tipo, 2=datos
  const [form, setForm]         = useState({
    placa:"", modelo:"", tipo:"", marca:"", anio: new Date().getFullYear(),
    color:"", cilindraje:"", capacidad_carga:"", combustible:"",
    kilometraje:"", num_serie:"", num_motor:"",
    soat_vence:"", tecnomecanica_vence:"", seguro_vence:"",
    propietario:"", observaciones:"", estado:"activo"
  });

  const cargar = async () => {
    setLoading(true);
    try {
      const r = await fetch(API_URL + "/vehiculos");
      const d = await r.json();
      setLista(Array.isArray(d) ? d : []);
    } catch { setLista([]); }
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const seleccionarTipo = (t) => {
    setTipoSel(t);
    setForm(f => ({
      ...f,
      tipo: t.tipo,
      marca: f.marca || "",
      combustible: t.combustible,
      cilindraje: t.cilindraje,
      capacidad_carga: t.capacidad,
      modelo: f.modelo || t.tipo
    }));
    setPaso(2);
  };

  const guardar = async () => {
    if (!form.placa) { setToast({ msg: "La placa es obligatoria", type: "error" }); return; }
    try {
      const url = vehSel ? `${API_URL}/vehiculos/${vehSel.id}` : `${API_URL}/vehiculos`;
      const method = vehSel ? "PUT" : "POST";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, kilometraje: parseInt(form.kilometraje || 0), anio: parseInt(form.anio) })
      });
      if (res.ok) {
        setToast({ msg: vehSel ? "Vehiculo actualizado" : "Vehiculo registrado exitosamente", type: "success" });
        setTimeout(() => { setVista("lista"); setVehSel(null); setPaso(1); setTipoSel(null); cargar(); }, 1400);
      } else {
        const e = await res.json();
        setToast({ msg: e.detail || "Error al guardar", type: "error" });
      }
    } catch { setToast({ msg: "Error de conexion", type: "error" }); }
  };

  const abrirEdicion = (v) => {
    setVehSel(v);
    setForm({
      placa: v.placa||"", modelo: v.modelo||"", tipo: v.tipo||"",
      marca: v.marca||"", anio: v.anio||new Date().getFullYear(),
      color: v.color||"", cilindraje: v.cilindraje||"",
      capacidad_carga: v.capacidad_carga||"", combustible: v.combustible||"",
      kilometraje: v.kilometraje||"", num_serie: v.num_serie||"",
      num_motor: v.num_motor||"", soat_vence: v.soat_vence||"",
      tecnomecanica_vence: v.tecnomecanica_vence||"",
      seguro_vence: v.seguro_vence||"", propietario: v.propietario||"",
      observaciones: v.observaciones||"", estado: v.estado||"activo"
    });
    const t = TIPOS_VEHICULO.find(t => t.tipo === v.tipo) || TIPOS_VEHICULO[TIPOS_VEHICULO.length-1];
    setTipoSel(t); setPaso(2); setVista("form");
  };

  const estadoColor = { activo: "#06D6A0", inactivo: "#EF4444", mantenimiento: "#F59E0B" };

  // ---- VISTA DETALLE ----
  if (vista === "detalle" && vehSel) return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <PageHeader title="Detalle Vehiculo" onBack={() => { setVista("lista"); setVehSel(null); }} />
      <div style={{ maxWidth: 640 }}>
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 16, marginBottom: 20, alignItems: "flex-start" }}>
            <div style={{
              width: 64, height: 64, borderRadius: 12, background: C.accent+"20",
              border: `2px solid ${C.accent}`, display: "flex", alignItems: "center",
              justifyContent: "center", fontWeight: 900, fontSize: 13, color: C.accent, flexShrink: 0
            }}>{vehSel.placa?.slice(0,3)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 22, fontWeight: 900 }}>{vehSel.placa}</div>
              <div style={{ fontSize: 13, color: C.muted }}>{vehSel.marca} {vehSel.modelo} {vehSel.anio ? `(${vehSel.anio})` : ""}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                <span style={{ padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700, background: C.accent+"20", color: C.accent }}>{vehSel.tipo || "Sin tipo"}</span>
                <span style={{ padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700, background: (estadoColor[vehSel.estado]||"#ccc")+"20", color: estadoColor[vehSel.estado]||C.muted }}>{(vehSel.estado||"activo").toUpperCase()}</span>
                {vehSel.color && <span style={{ padding:"3px 10px", borderRadius:20, fontSize:11, background:C.bg, border:`1px solid ${C.border}`, color:C.muted }}>{vehSel.color}</span>}
              </div>
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:16 }}>
            {[
              { icon:"[eng]", label:"CILINDRAJE",    val: vehSel.cilindraje||"-" },
              { icon:"[gas]", label:"COMBUSTIBLE",   val: vehSel.combustible||"-" },
              { icon:"[caja]", label:"CAPACIDAD",     val: vehSel.capacidad_carga||"-" },
              { icon:"[ruta]", label:"KILOMETRAJE",   val: vehSel.kilometraje ? `${Number(vehSel.kilometraje).toLocaleString()} km` : "-" },
              { icon:"[serie]", label:"N. SERIE",      val: vehSel.num_serie||"-" },
              { icon:"[motor]", label:"N. MOTOR",      val: vehSel.num_motor||"-" },
            ].map(f => (
              <div key={f.label} style={{ padding:"10px 12px", background:C.bg, borderRadius:8, border:`1px solid ${C.border}` }}>
                <div style={{ fontSize:16, marginBottom:4 }}>{f.icon}</div>
                <div style={{ fontSize:9, fontWeight:700, color:C.muted }}>{f.label}</div>
                <div style={{ fontSize:13, fontWeight:700 }}>{f.val}</div>
              </div>
            ))}
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:16 }}>
            {[
              { label:"SOAT VENCE",         val:vehSel.soat_vence, warn: vehSel.soat_vence && new Date(vehSel.soat_vence) < new Date() },
              { label:"TECNOMECANICA",      val:vehSel.tecnomecanica_vence, warn: vehSel.tecnomecanica_vence && new Date(vehSel.tecnomecanica_vence) < new Date() },
              { label:"SEGURO VENCE",       val:vehSel.seguro_vence, warn: vehSel.seguro_vence && new Date(vehSel.seguro_vence) < new Date() },
            ].map(f => (
              <div key={f.label} style={{ padding:"10px 12px", background: f.warn ? "#EF444410" : C.bg, borderRadius:8, border:`1px solid ${f.warn ? "#EF444440" : C.border}` }}>
                <div style={{ fontSize:9, fontWeight:700, color: f.warn ? "#EF4444" : C.muted }}>{f.label} {f.warn ? "VENCIDO" : ""}</div>
                <div style={{ fontSize:13, fontWeight:700, color: f.warn ? "#EF4444" : C.text }}>{f.val||"-"}</div>
              </div>
            ))}
          </div>

          {vehSel.propietario && (
            <div style={{ padding:"10px 14px", background:C.bg, borderRadius:8, border:`1px solid ${C.border}`, marginBottom:12 }}>
              <div style={{ fontSize:10, color:C.muted, fontWeight:700 }}>PROPIETARIO</div>
              <div style={{ fontWeight:700 }}>{vehSel.propietario}</div>
            </div>
          )}
          {vehSel.observaciones && (
            <div style={{ padding:"10px 14px", background:"#F59E0B10", borderRadius:8, border:"1px solid #F59E0B30", marginBottom:12 }}>
              <div style={{ fontSize:10, color:"#F59E0B", fontWeight:700 }}>OBSERVACIONES</div>
              <div style={{ fontSize:13 }}>{vehSel.observaciones}</div>
            </div>
          )}

          <div style={{ display:"flex", gap:10 }}>
            <Btn onClick={() => abrirEdicion(vehSel)} style={{ flex:1 }}>EDITAR</Btn>
          </div>
        </Card>
      </div>
    </div>
  );

  // ---- VISTA FORM ----
  if (vista === "form") return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <PageHeader
        title={vehSel ? "Editar Vehiculo" : paso === 1 ? "Tipo de Vehiculo" : `Registro: ${tipoSel?.tipo}`}
        onBack={() => {
          if (paso === 2 && !vehSel) { setPaso(1); setTipoSel(null); }
          else { setVista("lista"); setVehSel(null); setPaso(1); setTipoSel(null); }
        }} />

      {/* PASO 1: Seleccion de tipo */}
      {paso === 1 && (
        <div>
          <p style={{ color:C.muted, marginBottom:20 }}>Selecciona el tipo de vehiculo para precargar sus datos tecnicos</p>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))", gap:14 }}>
            {TIPOS_VEHICULO.map(t => (
              <Card key={t.tipo} onClick={() => seleccionarTipo(t)}
                style={{ cursor:"pointer", padding:0, overflow:"hidden",
                  border: tipoSel?.tipo === t.tipo ? `2px solid ${C.accent}` : `1px solid ${C.border}` }}>
                <div style={{
                  height:110, background:(t.color_cat||C.accent)+"12",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  borderBottom:`1px solid ${(t.color_cat||C.accent)}30`
                }}>
                  <TruckIcon tipo={t.tipo} color={t.color_cat||C.accent} size={80} />
                </div>
                <div style={{ padding:"12px 14px" }}>
                  <div style={{ fontWeight:800, fontSize:14 }}>{t.tipo}</div>
                  <div style={{ fontSize:11, color:C.muted }}>{t.marca}</div>
                  <div style={{ fontSize:11, color:C.accent, fontWeight:600 }}>{t.categoria}</div>
                  {t.capacidad && <div style={{ fontSize:10, color:C.muted, marginTop:4 }}>Cap: {t.capacidad}</div>}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* PASO 2: Datos del vehiculo */}
      {paso === 2 && (
        <div style={{ maxWidth:640 }}>
          {tipoSel && (
            <Card style={{ marginBottom:16, padding:0, overflow:"hidden", borderTop:`4px solid ${tipoSel.color_cat || C.accent}` }}>
              <div style={{ display:"flex", alignItems:"center", gap:0 }}>
                <div style={{ width:140, flexShrink:0, background: (tipoSel.color_cat||C.accent)+"15",
                  display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:12, minHeight:100 }}>
                  <TruckIcon tipo={tipoSel.tipo} color={tipoSel.color_cat || C.accent} size={90} />
                  <div style={{ fontSize:10, fontWeight:800, color: tipoSel.color_cat || C.accent, marginTop:4 }}>{tipoSel.codigo}</div>
                </div>
                <div style={{ padding:"16px 20px", flex:1 }}>
                  <div style={{ fontSize:18, fontWeight:900 }}>{tipoSel.tipo}</div>
                  <div style={{ fontSize:11, fontWeight:700, color: tipoSel.color_cat || C.accent }}>{tipoSel.categoria} - Codigo {tipoSel.codigo}</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginTop:8 }}>
                    {tipoSel.capacidad && <div><span style={{fontSize:9,color:C.muted}}>CAPACIDAD </span><strong style={{fontSize:12}}>{tipoSel.capacidad}</strong></div>}
                    {tipoSel.pbv && <div><span style={{fontSize:9,color:C.muted}}>PBV </span><strong style={{fontSize:12}}>{tipoSel.pbv}</strong></div>}
                    {tipoSel.licencia && <div><span style={{fontSize:9,color:C.muted}}>LICENCIA </span><strong style={{fontSize:12}}>{tipoSel.licencia}</strong></div>}
                    {tipoSel.ejes > 0 && <div><span style={{fontSize:9,color:C.muted}}>EJES </span><strong style={{fontSize:12}}>{tipoSel.ejes}</strong></div>}
                  </div>
                  {tipoSel.motor && <div style={{fontSize:11,color:C.muted,marginTop:4}}>{tipoSel.motor}</div>}
                </div>
              </div>
            </Card>
          )}

          <Card style={{ marginBottom:14 }}>
            <div style={{ fontWeight:700, fontSize:13, color:C.muted, marginBottom:12 }}>IDENTIFICACION</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <Input label="PLACA *" value={form.placa} onChange={v => setForm(f=>({...f, placa: v.toUpperCase()}))} placeholder="Ej: ABC123" />
              <Input label="ANo" value={String(form.anio)} onChange={v => setForm(f=>({...f, anio:v}))} placeholder={String(new Date().getFullYear())} />
              <Input label="MARCA" value={form.marca} onChange={v => setForm(f=>({...f, marca:v}))} />
              <Input label="MODELO" value={form.modelo} onChange={v => setForm(f=>({...f, modelo:v}))} />
              <Input label="COLOR" value={form.color} onChange={v => setForm(f=>({...f, color:v}))} placeholder="Ej: Blanco" />
              <Sel label="ESTADO" value={form.estado} onChange={v => setForm(f=>({...f, estado:v}))}
                options={[
                  {value:"activo",label:"Activo"},
                  {value:"inactivo",label:"Inactivo"},
                  {value:"mantenimiento",label:"En Mantenimiento"}
                ]} />
            </div>
          </Card>

          <Card style={{ marginBottom:14 }}>
            <div style={{ fontWeight:700, fontSize:13, color:C.muted, marginBottom:12 }}>DATOS TECNICOS</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <Sel label="COMBUSTIBLE" value={form.combustible} onChange={v => setForm(f=>({...f, combustible:v}))}
                options={["Diesel","Gasolina","Gas Natural","Electrico","Hibrido"].map(x=>({value:x,label:x}))} />
              <Input label="CILINDRAJE" value={form.cilindraje} onChange={v => setForm(f=>({...f, cilindraje:v}))} placeholder="Ej: 5.2L" />
              <Input label="CAPACIDAD DE CARGA" value={form.capacidad_carga} onChange={v => setForm(f=>({...f, capacidad_carga:v}))} placeholder="Ej: 3.5 ton" />
              <Input label="KILOMETRAJE ACTUAL" value={String(form.kilometraje)} onChange={v => setForm(f=>({...f, kilometraje:v}))} placeholder="km" />
              <Input label="NUMERO DE SERIE" value={form.num_serie} onChange={v => setForm(f=>({...f, num_serie:v}))} />
              <Input label="NUMERO DE MOTOR" value={form.num_motor} onChange={v => setForm(f=>({...f, num_motor:v}))} />
            </div>
          </Card>

          <Card style={{ marginBottom:14 }}>
            <div style={{ fontWeight:700, fontSize:13, color:C.muted, marginBottom:12 }}>DOCUMENTOS Y VENCIMIENTOS</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
              <Input label="SOAT VENCE" value={form.soat_vence} onChange={v => setForm(f=>({...f, soat_vence:v}))} type="date" />
              <Input label="TECNOMECANICA" value={form.tecnomecanica_vence} onChange={v => setForm(f=>({...f, tecnomecanica_vence:v}))} type="date" />
              <Input label="SEGURO VENCE" value={form.seguro_vence} onChange={v => setForm(f=>({...f, seguro_vence:v}))} type="date" />
            </div>
          </Card>

          <Card style={{ marginBottom:14 }}>
            <div style={{ fontWeight:700, fontSize:13, color:C.muted, marginBottom:12 }}>PROPIETARIO Y NOTAS</div>
            <Input label="PROPIETARIO / EMPRESA" value={form.propietario} onChange={v => setForm(f=>({...f, propietario:v}))} />
            <div style={{ marginTop:12 }}>
              <label style={{ fontSize:11, fontWeight:600, color:C.muted, display:"block", marginBottom:4 }}>OBSERVACIONES</label>
              <textarea value={form.observaciones} onChange={e => setForm(f=>({...f, observaciones:e.target.value}))}
                placeholder="Notas adicionales, condicion del vehiculo..."
                style={{ width:"100%", minHeight:80, padding:"10px 12px", border:`1px solid ${C.border}`,
                  borderRadius:8, fontSize:13, fontFamily:"inherit", resize:"vertical", background:C.bg }} />
            </div>
          </Card>

          <Btn onClick={guardar} style={{ width:"100%", padding:"14px" }}>
            {vehSel ? "GUARDAR CAMBIOS" : "REGISTRAR VEHICULO"}
          </Btn>
        </div>
      )}
    </div>
  );

  // ---- VISTA LISTA ----
  const estadoBadge = (e) => ({
    activo:        { label:"ACTIVO",         color:"#06D6A0" },
    inactivo:      { label:"INACTIVO",       color:"#EF4444" },
    mantenimiento: { label:"MANTENIMIENTO",  color:"#F59E0B" },
  }[e] || { label: (e||"ACTIVO").toUpperCase(), color: "#06D6A0" });

  const docVencida = (v) =>
    (v.soat_vence && new Date(v.soat_vence) < new Date()) ||
    (v.tecnomecanica_vence && new Date(v.tecnomecanica_vence) < new Date()) ||
    (v.seguro_vence && new Date(v.seguro_vence) < new Date());

  return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
        <div>
          <h2 style={{ margin:0, fontSize:22, fontWeight:800 }}>Flota de Vehiculos</h2>
          <p style={{ margin:0, fontSize:13, color:C.muted }}>{lista.length} vehiculo(s) registrado(s)</p>
        </div>
        <Btn onClick={() => { setPaso(1); setTipoSel(null); setVehSel(null);
          setForm({ placa:"",modelo:"",tipo:"",marca:"",anio:new Date().getFullYear(),color:"",
            cilindraje:"",capacidad_carga:"",combustible:"",kilometraje:"",num_serie:"",
            num_motor:"",soat_vence:"",tecnomecanica_vence:"",seguro_vence:"",
            propietario:"",observaciones:"",estado:"activo" });
          setVista("form"); }}>+ NUEVO VEHICULO</Btn>
      </div>

      {loading ? (
        <div style={{ textAlign:"center", padding:40, color:C.muted }}>Cargando...</div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(300px, 1fr))", gap:14 }}>
          {lista.map((v,i) => {
            const badge = estadoBadge(v.estado);
            const vencida = docVencida(v);
            return (
              <Card key={i} onClick={() => { setVehSel(v); setVista("detalle"); }}
                style={{ cursor:"pointer", borderLeft:`4px solid ${badge.color}`,
                  outline: vencida ? "2px solid #EF444440" : "none" }}>
                <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10 }}>
                  <div style={{
                    width:52, height:52, borderRadius:10, flexShrink:0,
                    background: C.accent+"20", border:`2px solid ${C.accent}`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontWeight:900, fontSize:11, color:C.accent
                  }}>{v.placa?.slice(0,3)}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:800, fontSize:15 }}>{v.placa}</div>
                    <div style={{ fontSize:12, color:C.muted }}>{v.marca} {v.modelo} {v.anio ? `(${v.anio})` : ""}</div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
                    <span style={{ padding:"3px 8px", borderRadius:20, fontSize:10, fontWeight:700, background: badge.color+"20", color: badge.color }}>{badge.label}</span>
                    {v.tipo && <span style={{ padding:"2px 8px", borderRadius:20, fontSize:10, background:C.bg, border:`1px solid ${C.border}`, color:C.muted }}>{v.tipo}</span>}
                  </div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
                  {v.combustible && (
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontSize:9, color:C.muted }}>COMBUSTIBLE</div>
                      <div style={{ fontSize:11, fontWeight:700 }}>{v.combustible}</div>
                    </div>
                  )}
                  {v.capacidad_carga && (
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontSize:9, color:C.muted }}>CAPACIDAD</div>
                      <div style={{ fontSize:11, fontWeight:700 }}>{v.capacidad_carga}</div>
                    </div>
                  )}
                  {v.kilometraje > 0 && (
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontSize:9, color:C.muted }}>KM</div>
                      <div style={{ fontSize:11, fontWeight:700 }}>{Number(v.kilometraje).toLocaleString()}</div>
                    </div>
                  )}
                </div>
                {vencida && (
                  <div style={{ marginTop:8, padding:"4px 8px", borderRadius:6, background:"#EF444415", border:"1px solid #EF444430", fontSize:10, fontWeight:700, color:"#EF4444" }}>
                    Documento(s) vencido(s) - Requiere atencion
                  </div>
                )}
              </Card>
            );
          })}
          {lista.length === 0 && (
            <div style={{ gridColumn:"1/-1", textAlign:"center", padding:40, color:C.muted }}>
              <div style={{ fontSize:40, marginBottom:12 }}>[camion]</div>
              <div>No hay vehiculos registrados</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};


const CATEGORIAS_REF = [
  { id: "muebles",      label: "Muebles",          icon: "MU" },
  { id: "closets",      label: "Closets",           icon: "CL" },
  { id: "escritorios",  label: "Escritorios",       icon: "ES" },
  { id: "cocinas",      label: "Cocinas",           icon: "CO" },
  { id: "bibliotecas",  label: "Bibliotecas",       icon: "BI" },
  { id: "camas",        label: "Camas y Camarotes", icon: "CA" },
  { id: "salas",        label: "Salas y Comedores", icon: "SC" },
  { id: "oficina",      label: "Mobiliario Oficina", icon: "OF" },
  { id: "otro",         label: "Otro",              icon: "OT" },
];

export default Vehiculos;
