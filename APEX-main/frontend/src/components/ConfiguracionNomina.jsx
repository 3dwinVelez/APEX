import { useEffect, useMemo, useState } from "react";
import { API_URL, C } from "../shared/constants";
import { Btn, Card, PageHeader, Toast } from "../shared/ui";
import { can } from "../shared/permissions";

const DIAS_SEMANA = [
  { value: 0, label: "Lun" },
  { value: 1, label: "Mar" },
  { value: 2, label: "Mie" },
  { value: 3, label: "Jue" },
  { value: 4, label: "Vie" },
  { value: 5, label: "Sab" },
  { value: 6, label: "Dom" },
];

const emptyHorario = {
  id: null,
  nombre: "",
  hora_entrada: "08:00",
  hora_salida: "17:00",
  hora_inicio_almuerzo: "12:00",
  hora_fin_almuerzo: "13:00",
  dias_laborables: [0, 1, 2, 3, 4],
  activo: true,
};

const emptyConcepto = {
  codigo: "",
  nombre: "",
  tipo: "recargo_ordinario",
  porcentaje: 0,
  activo: true,
};

const cardTitle = { fontSize: 12, fontWeight: 800, color: C.muted, marginBottom: 12, letterSpacing: 0.4 };

const inputStyle = {
  width: "100%",
  padding: "9px 10px",
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  fontSize: 12,
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const TIME_OPTIONS_24H = Array.from({ length: 48 }, (_, index) => {
  const totalMinutes = index * 30;
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
});

const ConfiguracionNomina = ({ onBack, user }) => {
  const [tab, setTab] = useState("horarios");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [horarios, setHorarios] = useState([]);
  const [conceptos, setConceptos] = useState([]);
  const [parametros, setParametros] = useState({});
  const [festivos, setFestivos] = useState([]);
  const [horarioForm, setHorarioForm] = useState(emptyHorario);
  const [conceptoForm, setConceptoForm] = useState(emptyConcepto);
  const [festivoForm, setFestivoForm] = useState({ fecha: "", nombre: "" });

  const canEdit = can(user, "configuracion", "edit");
  const readOnlyStyle = !canEdit ? { opacity: 0.58, pointerEvents: "none", filter: "grayscale(0.12)" } : {};

  const cargar = async () => {
    setLoading(true);
    try {
      const [horariosRes, conceptosRes, parametrosRes, festivosRes] = await Promise.all([
        fetch(`${API_URL}/config/horarios-contrato`).then((r) => r.json()).catch(() => []),
        fetch(`${API_URL}/config/conceptos-nomina`).then((r) => r.json()).catch(() => []),
        fetch(`${API_URL}/config/parametros-tiempo`).then((r) => r.json()).catch(() => ({})),
        fetch(`${API_URL}/config/festivos-colombia`).then((r) => r.json()).catch(() => []),
      ]);
      setHorarios(Array.isArray(horariosRes) ? horariosRes : []);
      setConceptos(Array.isArray(conceptosRes) ? conceptosRes : []);
      setParametros(parametrosRes && typeof parametrosRes === "object" ? parametrosRes : {});
      setFestivos(Array.isArray(festivosRes) ? festivosRes : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const conceptosPorTipo = useMemo(() => ({
    recargo_ordinario: conceptos.filter((item) => item.tipo === "recargo_ordinario" || item.tipo === "recargo"),
    hora_extra: conceptos.filter((item) => item.tipo === "hora_extra" || item.tipo === "extra"),
  }), [conceptos]);

  const guardarHorario = async () => {
    try {
      const method = horarioForm.id ? "PUT" : "POST";
      const url = horarioForm.id
        ? `${API_URL}/config/horarios-contrato/${horarioForm.id}`
        : `${API_URL}/config/horarios-contrato`;
      await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(horarioForm),
      });
      setToast({ msg: "Horario contractual guardado", type: "success" });
      setHorarioForm(emptyHorario);
      cargar();
    } catch {
      setToast({ msg: "No fue posible guardar el horario", type: "error" });
    }
  };

  const guardarConcepto = async () => {
    try {
      const endpoint = conceptoForm.id
        ? `${API_URL}/config/conceptos-nomina/${conceptoForm.id}`
        : `${API_URL}/config/conceptos-nomina`;
      await fetch(endpoint, {
        method: conceptoForm.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo: conceptoForm.codigo,
          nombre: conceptoForm.nombre,
          tipo: conceptoForm.tipo,
          porcentaje: Number(conceptoForm.porcentaje || 0),
          activo: conceptoForm.activo !== false,
        }),
      });
      setToast({ msg: "Concepto actualizado", type: "success" });
      setConceptoForm(emptyConcepto);
      cargar();
    } catch {
      setToast({ msg: "No fue posible guardar el concepto", type: "error" });
    }
  };

  const guardarParametros = async () => {
    try {
      await fetch(`${API_URL}/config/parametros-tiempo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parametros }),
      });
      setToast({ msg: "Parametros de tiempo actualizados", type: "success" });
      cargar();
    } catch {
      setToast({ msg: "No fue posible guardar los parametros", type: "error" });
    }
  };

  const guardarFestivo = async () => {
    try {
      await fetch(`${API_URL}/config/festivos-colombia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(festivoForm),
      });
      setToast({ msg: "Festivo guardado", type: "success" });
      setFestivoForm({ fecha: "", nombre: "" });
      cargar();
    } catch {
      setToast({ msg: "No fue posible guardar el festivo", type: "error" });
    }
  };

  const tabStyle = (key) => ({
    padding: "8px 16px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
    background: tab === key ? C.dark : C.bg,
    color: tab === key ? "#fff" : C.muted,
    border: `1px solid ${tab === key ? C.dark : C.border}`,
  });

  return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <PageHeader title="Configuracion de Nomina" subtitle="Horarios, recargos, parametros y festivos" onBack={onBack} />

      {!canEdit && (
        <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 10, background: "#F59E0B10", border: "1px solid #F59E0B30", color: "#9A6700", fontSize: 12, fontWeight: 700 }}>
          Modo solo lectura. Puedes revisar la parametrizacion, pero no cambiarla.
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={tabStyle("horarios")} onClick={() => setTab("horarios")}>Horarios</div>
        <div style={tabStyle("conceptos")} onClick={() => setTab("conceptos")}>Conceptos</div>
        <div style={tabStyle("parametros")} onClick={() => setTab("parametros")}>Parametros</div>
        <div style={tabStyle("festivos")} onClick={() => setTab("festivos")}>Festivos</div>
      </div>

      {loading && <div style={{ marginBottom: 14, color: C.muted, fontSize: 12 }}>Cargando configuracion...</div>}

      {tab === "horarios" && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 420px) 1fr", gap: 16 }}>
          <div style={readOnlyStyle}>
            <Card>
              <div style={cardTitle}>HORARIO CONTRACTUAL</div>
              <div style={{ display: "grid", gap: 12 }}>
                <input style={inputStyle} value={horarioForm.nombre} placeholder="Nombre del horario" onChange={(e) => setHorarioForm({ ...horarioForm, nombre: e.target.value })} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <select style={inputStyle} value={horarioForm.hora_entrada} onChange={(e) => setHorarioForm({ ...horarioForm, hora_entrada: e.target.value })}>
                    {TIME_OPTIONS_24H.map((timeValue) => (
                      <option key={timeValue} value={timeValue}>{timeValue}</option>
                    ))}
                  </select>
                  <select style={inputStyle} value={horarioForm.hora_salida} onChange={(e) => setHorarioForm({ ...horarioForm, hora_salida: e.target.value })}>
                    {TIME_OPTIONS_24H.map((timeValue) => (
                      <option key={timeValue} value={timeValue}>{timeValue}</option>
                    ))}
                  </select>
                  <select style={inputStyle} value={horarioForm.hora_inicio_almuerzo} onChange={(e) => setHorarioForm({ ...horarioForm, hora_inicio_almuerzo: e.target.value })}>
                    <option value="">Sin almuerzo</option>
                    {TIME_OPTIONS_24H.map((timeValue) => (
                      <option key={timeValue} value={timeValue}>{timeValue}</option>
                    ))}
                  </select>
                  <select style={inputStyle} value={horarioForm.hora_fin_almuerzo} onChange={(e) => setHorarioForm({ ...horarioForm, hora_fin_almuerzo: e.target.value })}>
                    <option value="">Sin almuerzo</option>
                    {TIME_OPTIONS_24H.map((timeValue) => (
                      <option key={timeValue} value={timeValue}>{timeValue}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, marginBottom: 6 }}>DIAS LABORABLES</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {DIAS_SEMANA.map((dia) => {
                      const selected = horarioForm.dias_laborables.includes(dia.value);
                      return (
                        <div
                          key={dia.value}
                          onClick={() => {
                            const next = selected
                              ? horarioForm.dias_laborables.filter((item) => item !== dia.value)
                              : [...horarioForm.dias_laborables, dia.value].sort();
                            setHorarioForm({ ...horarioForm, dias_laborables: next });
                          }}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 999,
                            background: selected ? C.accent : C.bg,
                            color: selected ? "#fff" : C.muted,
                            border: `1px solid ${selected ? C.accent : C.border}`,
                            cursor: "pointer",
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {dia.label}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
                  <input type="checkbox" checked={horarioForm.activo} onChange={(e) => setHorarioForm({ ...horarioForm, activo: e.target.checked })} />
                  Horario activo
                </label>
                <Btn onClick={guardarHorario}>{horarioForm.id ? "GUARDAR CAMBIOS" : "CREAR HORARIO"}</Btn>
              </div>
            </Card>
          </div>

          <Card>
            <div style={cardTitle}>HORARIOS REGISTRADOS</div>
            <div style={{ display: "grid", gap: 10 }}>
              {horarios.map((horario) => (
                <div key={horario.id} style={{ padding: 12, border: `1px solid ${C.border}`, borderRadius: 10, display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>{horario.nombre}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>
                      {horario.hora_entrada} - {horario.hora_salida} | Almuerzo {horario.hora_inicio_almuerzo || "--"} - {horario.hora_fin_almuerzo || "--"}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                      Dias: {(horario.dias_laborables || []).map((item) => DIAS_SEMANA.find((dia) => dia.value === item)?.label || item).join(", ")}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: horario.activo ? "#06D6A0" : C.muted }}>
                      {horario.activo ? "ACTIVO" : "INACTIVO"}
                    </span>
                    {canEdit && <Btn variant="ghost" onClick={() => setHorarioForm({ ...horario })}>Editar</Btn>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === "conceptos" && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 400px) 1fr", gap: 16 }}>
          <div style={readOnlyStyle}>
            <Card>
              <div style={cardTitle}>CONCEPTO DE NOMINA</div>
              <div style={{ display: "grid", gap: 12 }}>
                <input style={inputStyle} value={conceptoForm.codigo} placeholder="Codigo: RN, HED..." onChange={(e) => setConceptoForm({ ...conceptoForm, codigo: e.target.value.toUpperCase() })} />
                <input style={inputStyle} value={conceptoForm.nombre} placeholder="Nombre visible" onChange={(e) => setConceptoForm({ ...conceptoForm, nombre: e.target.value })} />
                <select style={inputStyle} value={conceptoForm.tipo} onChange={(e) => setConceptoForm({ ...conceptoForm, tipo: e.target.value })}>
                  <option value="recargo_ordinario">Recargo ordinario</option>
                  <option value="hora_extra">Hora extra</option>
                </select>
                <input style={inputStyle} type="number" value={conceptoForm.porcentaje} onChange={(e) => setConceptoForm({ ...conceptoForm, porcentaje: e.target.value })} placeholder="Porcentaje de recargo" />
                <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
                  Este porcentaje es el recargo adicional parametrizable del concepto.
                  Ejemplo: RN = 35 significa 35% adicional sobre la hora base.
                </div>
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
                  <input type="checkbox" checked={conceptoForm.activo !== false} onChange={(e) => setConceptoForm({ ...conceptoForm, activo: e.target.checked })} />
                  Concepto activo
                </label>
                <Btn onClick={guardarConcepto}>{conceptoForm.id ? "GUARDAR CAMBIOS" : "CREAR CONCEPTO"}</Btn>
              </div>
            </Card>
          </div>

          <div style={{ display: "grid", gap: 16 }}>
            {[
              ["recargo_ordinario", "Recargos ordinarios"],
              ["hora_extra", "Horas extra"],
            ].map(([tipo, titulo]) => (
              <Card key={tipo}>
                <div style={cardTitle}>{titulo.toUpperCase()}</div>
                <div style={{ display: "grid", gap: 10 }}>
                  {conceptosPorTipo[tipo].length === 0 && (
                    <div style={{ fontSize: 12, color: C.muted }}>
                      No hay conceptos registrados en esta categoria todavia.
                    </div>
                  )}
                  {conceptosPorTipo[tipo].map((concepto) => (
                    <div key={concepto.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: 12, border: `1px solid ${C.border}`, borderRadius: 10 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 13 }}>{concepto.codigo} - {concepto.nombre}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>Recargo parametrizado: {Number(concepto.porcentaje || 0).toFixed(2)}%</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: concepto.activo ? "#06D6A0" : C.muted }}>{concepto.activo ? "ACTIVO" : "INACTIVO"}</span>
                        {canEdit && <Btn variant="ghost" onClick={() => setConceptoForm({ ...concepto })}>Editar</Btn>}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {tab === "parametros" && (
        <div style={{ display: "grid", gap: 16 }}>
          <Card>
            <div style={cardTitle}>PARAMETROS DE TIEMPO Y LIQUIDACION</div>
            <div style={{ ...readOnlyStyle, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              {[
                ["tiempo_almuerzo_minutos", "Almuerzo imputado (min)"],
                ["horas_ordinarias_dia", "Horas ordinarias por dia"],
                ["horas_ordinarias_semana", "Horas ordinarias por semana"],
                ["auxilio_transporte_mensual", "Auxilio transporte mensual"],
                ["tope_auxilio_transporte_mensual", "Tope auxilio transporte"],
              ].map(([key, label]) => (
                <div key={key}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, marginBottom: 4 }}>{label.toUpperCase()}</div>
                  <input style={inputStyle} value={parametros[key] || ""} onChange={(e) => setParametros({ ...parametros, [key]: e.target.value })} />
                </div>
              ))}
              {[
                ["horario_nocturno_inicio", "Inicio nocturno"],
                ["horario_nocturno_fin", "Fin nocturno"],
              ].map(([key, label]) => (
                <div key={key}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, marginBottom: 4 }}>{label.toUpperCase()}</div>
                  <select
                    style={inputStyle}
                    value={parametros[key] || ""}
                    onChange={(e) => setParametros({ ...parametros, [key]: e.target.value })}
                  >
                    <option value="">Selecciona una hora</option>
                    {TIME_OPTIONS_24H.map((timeValue) => (
                      <option key={timeValue} value={timeValue}>{timeValue}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            {canEdit && <Btn onClick={guardarParametros} style={{ marginTop: 14 }}>GUARDAR PARAMETROS</Btn>}
          </Card>
        </div>
      )}

      {tab === "festivos" && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 420px) 1fr", gap: 16 }}>
          <div style={readOnlyStyle}>
            <Card>
              <div style={cardTitle}>REGISTRAR FESTIVO</div>
              <div style={{ display: "grid", gap: 12 }}>
                <input style={inputStyle} type="date" value={festivoForm.fecha} onChange={(e) => setFestivoForm({ ...festivoForm, fecha: e.target.value })} />
                <input style={inputStyle} value={festivoForm.nombre} placeholder="Nombre del festivo" onChange={(e) => setFestivoForm({ ...festivoForm, nombre: e.target.value })} />
                <Btn onClick={guardarFestivo}>GUARDAR FESTIVO</Btn>
              </div>
            </Card>
          </div>

          <Card>
            <div style={cardTitle}>CALENDARIO DE FESTIVOS</div>
            <div style={{ display: "grid", gap: 8 }}>
              {festivos.map((festivo) => (
                <div key={festivo.fecha} style={{ padding: 12, border: `1px solid ${C.border}`, borderRadius: 10, display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>{festivo.nombre}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{festivo.fecha}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ConfiguracionNomina;
