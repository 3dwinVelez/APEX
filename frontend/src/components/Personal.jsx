import { useEffect, useState } from "react";
import { C, API_URL } from "../shared/constants";
import { Card, Btn, Input, Sel, PageHeader, Toast } from "../shared/ui";
import { can } from "../shared/permissions";
import { useData } from "../context/DataContext";

const ESTADOS_LABORALES = [
  { value: "activo", label: "Activo" },
  { value: "suspendido", label: "Suspendido" },
  { value: "vacaciones", label: "Vacaciones" },
  { value: "licencia remunerada", label: "Licencia remunerada" },
  { value: "licencia no remunerada", label: "Licencia no remunerada" },
  { value: "incapacidad", label: "Incapacidad" },
];

const Personal = ({ user }) => {
  const { getData, invalidateCache } = useData();
  const [vista, setVista] = useState("lista");
  const [rolSel, setRolSel] = useState(null);
  const [lista, setLista] = useState([]);
  const [horariosContrato, setHorariosContrato] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [filtroRol, setFiltroRol] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [empSel, setEmpSel] = useState(null);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    doc: "",
    pass: "",
    empresa: "Apex",
    costo: "",
    salario: "",
    extra: "",
    horario_id: "",
    estado_laboral: "activo",
  });

  const canCreatePersonal = can(user, "personal", "create");
  const canEditPersonal = can(user, "personal", "edit");
  const isReadOnlyForm = (modoEdicion && !canEditPersonal) || (!modoEdicion && !canCreatePersonal);

  const resetForm = () => {
    setForm({
      nombre: "",
      doc: "",
      pass: "",
      empresa: "Apex",
      costo: "",
      salario: "",
      extra: "",
      horario_id: "",
      estado_laboral: "activo",
    });
  };

  const cargar = async (force = false) => {
    setLoading(true);
    try {
      const [personalRes, horariosRes] = await Promise.all([
        force
          ? fetch(`${API_URL}/personal`).then((r) => r.json()).catch(() => [])
          : getData("personal", "/personal"),
        fetch(`${API_URL}/config/horarios-contrato`).then((r) => r.json()).catch(() => []),
      ]);
      setLista(Array.isArray(personalRes) ? personalRes : []);
      setHorariosContrato(Array.isArray(horariosRes) ? horariosRes : []);
    } catch {
      setLista([]);
      setHorariosContrato([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    cargar();
  }, []);

  const nuevoId = (() => {
    const activos = lista.filter((p) => p.rol === rolSel).length;
    const n = String(activos + 1).padStart(3, "0");
    if (rolSel === "tecnico") return "APXTEC" + n;
    if (rolSel === "empleado") return "APXEMP" + n;
    return "APXADM" + n;
  })();

  const guardar = async () => {
    if (isReadOnlyForm) {
      setToast({ msg: "No tienes permisos para modificar personal", type: "error" });
      return;
    }
    if (!form.nombre) {
      setToast({ msg: "El nombre es obligatorio", type: "error" });
      return;
    }

    const payload = {
      nombre: form.nombre,
      doc: form.doc,
      user: modoEdicion && empSel ? empSel.username : nuevoId,
      pass: form.pass || "1234",
      rol: modoEdicion && empSel ? empSel.rol : rolSel,
      id_interno: modoEdicion && empSel ? empSel.id_interno : nuevoId,
      empresa: form.empresa,
      costo: parseFloat(form.costo || 0),
      salario: parseFloat(form.salario || 0),
      extra: parseFloat(form.extra || 0),
      horario_id: form.horario_id ? Number(form.horario_id) : null,
      estado_laboral: form.estado_laboral || "activo",
    };

    try {
      await fetch(
        modoEdicion && empSel ? `${API_URL}/personal/${empSel.id}` : `${API_URL}/personal`,
        {
          method: modoEdicion && empSel ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      setToast({
        msg: modoEdicion ? "Usuario actualizado correctamente" : `Usuario creado: ${nuevoId}`,
        type: "success",
      });
      setTimeout(() => {
        setVista("lista");
        setModoEdicion(false);
        setEmpSel(null);
        resetForm();
        invalidateCache("personal");
        cargar(true);
      }, 1200);
    } catch {
      setToast({ msg: "Error al guardar", type: "error" });
    }
  };

  const toggleEstado = async (emp) => {
    try {
      await fetch(`${API_URL}/personal/${emp.id}/estado?activo=${!emp.activo}`, { method: "PATCH" });
      invalidateCache("personal");
      setLista((prev) => prev.map((p) => (p.id === emp.id ? { ...p, activo: !emp.activo } : p)));
      setEmpSel((prev) => (prev ? { ...prev, activo: !prev.activo } : null));
    } catch {}
  };

  const abrirEdicion = (emp) => {
    setEmpSel(emp);
    setModoEdicion(true);
    setRolSel(emp.rol);
    setForm({
      nombre: emp.nombre || "",
      doc: emp.documento || "",
      pass: "",
      empresa: emp.empresa || "Apex",
      costo: emp.costo_servicio || "",
      salario: emp.salario_base || "",
      extra: emp.tasa_extra || "",
      horario_id: emp.horario_id || "",
      estado_laboral: emp.estado_laboral || "activo",
    });
    setVista("form");
  };

  const rolColor = { tecnico: C.accent, empleado: C.success, admin: "#8B5CF6" };
  const rolLabel = { tecnico: "TECNICO", empleado: "EMPLEADO", admin: "ADMIN" };

  const listaFiltrada = lista.filter((p) => {
    if (filtroRol && p.rol !== filtroRol) return false;
    if (filtroEstado === "activo" && !p.activo) return false;
    if (filtroEstado === "inactivo" && p.activo !== false) return false;
    return true;
  });

  if (vista === "detalle" && empSel) {
    return (
      <div>
        {toast && <Toast {...toast} onClose={() => setToast(null)} />}
        <PageHeader title="Detalle Empleado" onBack={() => { setVista("lista"); setEmpSel(null); }} />
        <div style={{ maxWidth: 640 }}>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: (rolColor[empSel.rol] || C.accent) + "20",
                  border: `3px solid ${rolColor[empSel.rol] || C.accent}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                  fontWeight: 900,
                  color: rolColor[empSel.rol] || C.accent,
                }}
              >
                {empSel.nombre?.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{empSel.nombre}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                  <span
                    style={{
                      padding: "3px 10px",
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 700,
                      background: (rolColor[empSel.rol] || C.accent) + "20",
                      color: rolColor[empSel.rol] || C.accent,
                    }}
                  >
                    {rolLabel[empSel.rol] || empSel.rol?.toUpperCase()}
                  </span>
                  <span
                    style={{
                      padding: "3px 10px",
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 700,
                      background: empSel.activo !== false ? "#06D6A015" : "#EF444415",
                      color: empSel.activo !== false ? "#06D6A0" : "#EF4444",
                    }}
                  >
                    {empSel.activo !== false ? "ACTIVO" : "INACTIVO"}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              {[
                { label: "ID INTERNO", value: empSel.id_interno },
                { label: "DOCUMENTO", value: empSel.documento || "-" },
                { label: "USUARIO", value: empSel.username },
                { label: "EMPRESA", value: empSel.empresa || "-" },
                { label: "HORARIO", value: empSel.horario_nombre || "Sin asignar" },
                { label: "ESTADO LABORAL", value: empSel.estado_laboral || "activo" },
                { label: "SALARIO BASE", value: empSel.salario_base ? `$${Number(empSel.salario_base).toLocaleString()}` : "-" },
                { label: "VALOR H. EXTRA", value: empSel.tasa_extra ? `$${Number(empSel.tasa_extra).toLocaleString()}` : "-" },
              ].map((f) => (
                <div
                  key={f.label}
                  style={{ padding: "10px 14px", background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}
                >
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, marginBottom: 3 }}>{f.label}</div>
                  <div style={{ fontWeight: 700, fontSize: 14, textTransform: f.label === "ESTADO LABORAL" ? "capitalize" : "none" }}>
                    {f.value}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <Btn onClick={() => abrirEdicion(empSel)} style={{ flex: 1 }}>EDITAR</Btn>
              <Btn
                variant="ghost"
                onClick={() => toggleEstado(empSel)}
                disabled={!canEditPersonal}
                style={{ color: empSel.activo !== false ? C.danger : "#06D6A0", borderColor: empSel.activo !== false ? C.danger : "#06D6A0" }}
              >
                {empSel.activo !== false ? "DESACTIVAR" : "ACTIVAR"}
              </Btn>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (vista === "form" && rolSel) {
    return (
      <div>
        {toast && <Toast {...toast} onClose={() => setToast(null)} />}
        <PageHeader
          title={modoEdicion ? "Editar " + (rolLabel[rolSel] || rolSel) : "Nuevo " + (rolLabel[rolSel] || rolSel)}
          onBack={() => { setVista(modoEdicion ? "detalle" : "roles"); setModoEdicion(false); }}
        />
        <div style={{ maxWidth: 520 }}>
          {isReadOnlyForm && (
            <div
              style={{
                marginBottom: 14,
                padding: "10px 14px",
                borderRadius: 10,
                background: "#F59E0B10",
                border: "1px solid #F59E0B30",
                color: "#9A6700",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              Modo solo lectura. Puedes revisar la informacion, pero no modificarla.
            </div>
          )}
          <div style={isReadOnlyForm ? { opacity: 0.55, pointerEvents: "none", filter: "grayscale(0.15)" } : {}}>
            <Card>
              {!modoEdicion && (
                <div style={{ background: C.dark, borderRadius: 10, padding: "16px 20px", marginBottom: 20, textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "#8892A4", letterSpacing: 1 }}>ID GENERADO</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: 2 }}>{nuevoId}</div>
                </div>
              )}
              <Input label="NOMBRE COMPLETO" value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} />
              <Input label="DOCUMENTO" value={form.doc} onChange={(v) => setForm({ ...form, doc: v })} />
              <Input
                label="CONTRASENA"
                value={form.pass}
                onChange={(v) => setForm({ ...form, pass: v })}
                type="password"
                placeholder={modoEdicion ? "Dejar vacio para no cambiar" : "Minimo 4 caracteres"}
              />
              {rolSel === "tecnico" && (
                <>
                  <Sel
                    label="EMPRESA"
                    value={form.empresa}
                    onChange={(v) => setForm({ ...form, empresa: v })}
                    options={[
                      { value: "Apex", label: "Apex" },
                      { value: "Externo", label: "Externo" },
                    ]}
                  />
                  <Input label="COSTO SERVICIO ($)" value={form.costo} onChange={(v) => setForm({ ...form, costo: v })} />
                </>
              )}
              <Sel
                label="HORARIO CONTRACTUAL"
                value={String(form.horario_id || "")}
                onChange={(v) => setForm({ ...form, horario_id: v })}
                options={[
                  { value: "", label: "Sin asignar" },
                  ...horariosContrato.map((horario) => ({ value: String(horario.id), label: horario.nombre })),
                ]}
              />
              <Sel
                label="ESTADO LABORAL"
                value={form.estado_laboral}
                onChange={(v) => setForm({ ...form, estado_laboral: v })}
                options={ESTADOS_LABORALES}
              />
              {(rolSel === "empleado" || rolSel === "tecnico") && (
                <>
                  <Input label="SALARIO BASE ($)" value={form.salario} onChange={(v) => setForm({ ...form, salario: v })} />
                  <Input label="VALOR HORA EXTRA ($)" value={form.extra} onChange={(v) => setForm({ ...form, extra: v })} />
                </>
              )}
              <Btn onClick={guardar} style={{ marginTop: 8, width: "100%" }}>
                {modoEdicion ? "GUARDAR CAMBIOS" : "CREAR USUARIO"}
              </Btn>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (vista === "roles") {
    return (
      <div>
        <PageHeader title="Nuevo Usuario" subtitle="Selecciona el perfil" onBack={() => setVista("lista")} />
        <div style={{ maxWidth: 480 }}>
          {[
            { rol: "admin", label: "Administrador", desc: "Acceso total al sistema", icon: "ADM" },
            { rol: "tecnico", label: "Tecnico", desc: "Servicios e inspecciones", icon: "TEC" },
            { rol: "empleado", label: "Empleado", desc: "Operaciones y horarios", icon: "USR" },
          ].map((r) => (
            <Card
              key={r.rol}
              onClick={canCreatePersonal ? () => { setRolSel(r.rol); setVista("form"); } : null}
              style={{ cursor: canCreatePersonal ? "pointer" : "not-allowed", opacity: canCreatePersonal ? 1 : 0.55, display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: C.bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 12,
                    color: C.muted,
                    border: `1px solid ${C.border}`,
                  }}
                >
                  {r.icon}
                </div>
                <div>
                  <div style={{ fontWeight: 700 }}>{r.label}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{r.desc}</div>
                </div>
              </div>
              <span style={{ color: C.muted, fontSize: 18 }}>{">"}</span>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Gestion de Personal</h2>
          <p style={{ margin: 0, fontSize: 13, color: C.muted }}>
            {listaFiltrada.length} de {lista.length} colaboradores
          </p>
        </div>
        <Btn onClick={() => setVista("roles")} disabled={!canCreatePersonal} title={!canCreatePersonal ? "Este perfil no puede crear usuarios" : ""}>
          + NUEVO USUARIO
        </Btn>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { value: "", label: "Todos" },
          { value: "admin", label: "Admin" },
          { value: "tecnico", label: "Tecnicos" },
          { value: "empleado", label: "Empleados" },
        ].map((f) => (
          <div
            key={f.value}
            onClick={() => setFiltroRol(f.value)}
            style={{
              padding: "6px 16px",
              borderRadius: 20,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 700,
              background: filtroRol === f.value ? C.accent : C.bg,
              color: filtroRol === f.value ? "#fff" : C.muted,
              border: `1px solid ${filtroRol === f.value ? C.accent : C.border}`,
            }}
          >
            {f.label}
          </div>
        ))}
        <div style={{ width: 1, background: C.border, margin: "0 4px" }} />
        {[
          { value: "", label: "Activos e inactivos" },
          { value: "activo", label: "Solo activos" },
          { value: "inactivo", label: "Solo inactivos" },
        ].map((f) => (
          <div
            key={f.value}
            onClick={() => setFiltroEstado(f.value)}
            style={{
              padding: "6px 16px",
              borderRadius: 20,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 700,
              background: filtroEstado === f.value ? C.dark : C.bg,
              color: filtroEstado === f.value ? "#fff" : C.muted,
              border: `1px solid ${filtroEstado === f.value ? C.dark : C.border}`,
            }}
          >
            {f.label}
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: C.muted }}>Cargando...</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
          {listaFiltrada.map((p) => (
            <Card
              key={p.id}
              onClick={() => { setEmpSel(p); setVista("detalle"); }}
              style={{ cursor: "pointer", opacity: p.activo === false ? 0.6 : 1, borderLeft: `4px solid ${rolColor[p.rol] || C.border}` }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: (rolColor[p.rol] || C.accent) + "20",
                    border: `2px solid ${rolColor[p.rol] || C.accent}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    fontWeight: 900,
                    color: rolColor[p.rol] || C.accent,
                  }}
                >
                  {p.nombre?.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{p.nombre}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{p.id_interno}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{p.horario_nombre || "Sin horario"}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <span
                    style={{
                      padding: "3px 8px",
                      borderRadius: 20,
                      fontSize: 10,
                      fontWeight: 700,
                      background: (rolColor[p.rol] || C.accent) + "20",
                      color: rolColor[p.rol] || C.accent,
                    }}
                  >
                    {rolLabel[p.rol] || p.rol?.toUpperCase()}
                  </span>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 20,
                      fontSize: 10,
                      fontWeight: 700,
                      background: p.activo !== false ? "#06D6A015" : "#EF444415",
                      color: p.activo !== false ? "#06D6A0" : "#EF4444",
                    }}
                  >
                    {p.activo !== false ? "ACTIVO" : "INACTIVO"}
                  </span>
                </div>
              </div>
              <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 9, color: C.muted, fontWeight: 700 }}>ESTADO LABORAL</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: C.text, textTransform: "capitalize" }}>
                    {p.estado_laboral || "activo"}
                  </div>
                </div>
                {p.salario_base > 0 && (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 9, color: C.muted, fontWeight: 700 }}>SALARIO</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: C.text }}>
                      ${Number(p.salario_base).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Personal;
