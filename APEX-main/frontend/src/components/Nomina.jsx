import { useEffect, useMemo, useState } from "react";
import { API_URL, C } from "../shared/constants";
import { Btn, Card, KPI, PageHeader, Toast } from "../shared/ui";
import { can } from "../shared/permissions";
import { useData } from "../context/DataContext";

const money = (value) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(value || 0));

const minsToHours = (min) => `${(Number(min || 0) / 60).toFixed(2)} h`;

const csvDownload = (rows, name) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(","), ...rows.map((row) => headers.map((key) => `"${String(row[key] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const Nomina = ({ onBack, user }) => {
  const { getData } = useData();
  const hoy = new Date();
  const currentYear = hoy.getFullYear();
  const currentMonth = hoy.getMonth();
  const fechaInicioDefault = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${hoy.getDate() <= 15 ? "01" : "16"}`;
  const fechaFinDefault = hoy.getDate() <= 15
    ? `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-15`
    : new Date(currentYear, currentMonth + 1, 0).toISOString().split("T")[0];

  const [tab, setTab] = useState("dashboard");
  const [fechaInicio, setFechaInicio] = useState(fechaInicioDefault);
  const [fechaFin, setFechaFin] = useState(fechaFinDefault);
  const [dashboard, setDashboard] = useState(null);
  const [jornadas, setJornadas] = useState([]);
  const [quincenas, setQuincenas] = useState([]);
  const [personal, setPersonal] = useState([]);
  const [usuariosSeleccionados, setUsuariosSeleccionados] = useState([]);
  const [showUserFilter, setShowUserFilter] = useState(false);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState(null);

  const canCreateNomina = can(user, "nomina", "create");
  const canExportNomina = can(user, "nomina", "export");

  const usuarioIdsParam = usuariosSeleccionados.join(",");

  const cargar = async () => {
    setLoading(true);
    try {
      const [dashboardRes, jornadasRes, quincenasRes, personalRes] = await Promise.all([
        fetch(`${API_URL}/nomina/dashboard?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}${usuarioIdsParam ? `&usuario_ids=${usuarioIdsParam}` : ""}`).then((r) => r.json()).catch(() => null),
        fetch(`${API_URL}/nomina/jornadas?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}${usuarioIdsParam ? `&usuario_ids=${usuarioIdsParam}` : ""}`).then((r) => r.json()).catch(() => []),
        fetch(`${API_URL}/nomina/quincenas?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}${usuarioIdsParam ? `&usuario_ids=${usuarioIdsParam}` : ""}`).then((r) => r.json()).catch(() => []),
        getData("personal", "/personal").catch(() => []),
      ]);
      setDashboard(dashboardRes && typeof dashboardRes === "object" ? dashboardRes : null);
      setJornadas(Array.isArray(jornadasRes) ? jornadasRes : []);
      setQuincenas(Array.isArray(quincenasRes) ? quincenasRes : []);
      setPersonal(Array.isArray(personalRes) ? personalRes.filter((item) => item.rol !== "admin") : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const resumenAlertas = useMemo(() => ({
    extras: dashboard?.alertas?.empleados_mas_12h_extra || [],
    inconsistentes: dashboard?.alertas?.jornadas_inconsistentes || [],
    ausencias: dashboard?.alertas?.ausencias_sin_validar || [],
  }), [dashboard]);

  const nombresFiltro = useMemo(() => {
    if (!usuariosSeleccionados.length) return "Todos los empleados";
    const selected = personal.filter((item) => usuariosSeleccionados.includes(item.id));
    if (selected.length === 1) return selected[0].nombre;
    if (selected.length === 2) return `${selected[0].nombre} y ${selected[1].nombre}`;
    return `${selected.length} empleados`;
  }, [personal, usuariosSeleccionados]);

  const tecnicos = useMemo(
    () => personal.filter((item) => item.rol === "tecnico").map((item) => item.id),
    [personal]
  );

  const empleados = useMemo(
    () => personal.filter((item) => item.rol === "empleado").map((item) => item.id),
    [personal]
  );

  const toggleUsuario = (usuarioId) => {
    setUsuariosSeleccionados((prev) =>
      prev.includes(usuarioId) ? prev.filter((item) => item !== usuarioId) : [...prev, usuarioId]
    );
  };

  const filtroBtnStyle = {
    padding: "9px 12px",
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    background: "#fff",
    fontFamily: "inherit",
    fontSize: 12,
    minWidth: 260,
    textAlign: "left",
    cursor: "pointer",
  };

  const procesarRango = async () => {
    setProcessing(true);
    try {
      await fetch(`${API_URL}/nomina/procesar-rango`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha_inicio: fechaInicio, fecha_fin: fechaFin }),
      });
      setToast({ msg: "Jornadas procesadas correctamente", type: "success" });
      cargar();
    } catch {
      setToast({ msg: "No fue posible procesar jornadas", type: "error" });
    } finally {
      setProcessing(false);
    }
  };

  const liquidarQuincena = async () => {
    setProcessing(true);
    try {
      await fetch(`${API_URL}/nomina/liquidar-quincena`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha_inicio: fechaInicio, fecha_fin: fechaFin }),
      });
      setToast({ msg: "Liquidacion quincenal generada", type: "success" });
      cargar();
    } catch {
      setToast({ msg: "No fue posible liquidar la quincena", type: "error" });
    } finally {
      setProcessing(false);
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
      <PageHeader title="Nomina Quincenal" subtitle="Procesamiento diario, liquidacion y alertas" onBack={onBack} />

      <Card style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, marginBottom: 4 }}>DESDE</div>
            <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} style={{ padding: "9px 10px", border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: "inherit" }} />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, marginBottom: 4 }}>HASTA</div>
            <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} style={{ padding: "9px 10px", border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: "inherit" }} />
          </div>
          <Btn onClick={cargar} disabled={loading}>{loading ? "CARGANDO..." : "ACTUALIZAR"}</Btn>
          <Btn onClick={procesarRango} disabled={!canCreateNomina || processing}>{processing ? "PROCESANDO..." : "PROCESAR JORNADAS"}</Btn>
          <Btn onClick={liquidarQuincena} disabled={!canCreateNomina || processing}>{processing ? "LIQUIDANDO..." : "LIQUIDAR QUINCENA"}</Btn>
        </div>
        <div style={{ marginTop: 14, position: "relative", maxWidth: 360 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, marginBottom: 8 }}>FILTRAR EMPLEADOS</div>
          <button type="button" onClick={() => setShowUserFilter((prev) => !prev)} style={filtroBtnStyle}>
            {nombresFiltro} {showUserFilter ? "▲" : "▼"}
          </button>
          {showUserFilter && (
            <div
              style={{
                position: "absolute",
                top: 62,
                left: 0,
                width: "100%",
                background: "#fff",
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                boxShadow: "0 12px 30px rgba(0,0,0,0.12)",
                zIndex: 20,
                overflow: "hidden",
              }}
            >
              <div style={{ padding: 12, borderBottom: `1px solid ${C.border}`, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Btn variant="ghost" onClick={() => setUsuariosSeleccionados([])}>Todos</Btn>
                <Btn variant="ghost" onClick={() => setUsuariosSeleccionados(tecnicos)}>Solo tecnicos</Btn>
                <Btn variant="ghost" onClick={() => setUsuariosSeleccionados(empleados)}>Solo empleados</Btn>
                <Btn variant="ghost" onClick={() => setUsuariosSeleccionados([])}>Limpiar filtros</Btn>
              </div>
              <div style={{ maxHeight: 280, overflowY: "auto", padding: 8 }}>
                {personal.map((item) => {
                  const selected = usuariosSeleccionados.includes(item.id);
                  return (
                    <label
                      key={item.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 10px",
                        borderRadius: 8,
                        cursor: "pointer",
                        background: selected ? "#14B8A60D" : "transparent",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleUsuario(item.id)}
                      />
                      <span style={{ flex: 1, fontSize: 12, color: C.text }}>{item.nombre}</span>
                      <span style={{ fontSize: 10, color: C.muted, textTransform: "uppercase" }}>{item.rol}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
            Analizando: <strong style={{ color: C.text }}>{nombresFiltro}</strong>
          </div>
        </div>
      </Card>

      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={tabStyle("dashboard")} onClick={() => setTab("dashboard")}>Dashboard</div>
        <div style={tabStyle("jornadas")} onClick={() => setTab("jornadas")}>Jornadas</div>
        <div style={tabStyle("quincenas")} onClick={() => setTab("quincenas")}>Liquidaciones</div>
      </div>

      {tab === "dashboard" && (
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <KPI label="TOTAL NOMINA" value={money(dashboard?.total_nomina)} color="#14B8A6" />
            <KPI label="% EXTRAS / BASE" value={`${dashboard?.porcentaje_extras_sobre_salario || 0}%`} color="#F59E0B" />
            <KPI label="JORNADAS PROCESADAS" value={jornadas.length} color="#2563EB" />
            <KPI label="LIQUIDACIONES" value={quincenas.length} color="#8B5CF6" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            <Card>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.muted, marginBottom: 12 }}>ANALISIS POR SEMANA</div>
              {(dashboard?.analisis_semana || []).map((item) => (
                <div key={item.semana} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span>{item.semana}</span>
                    <strong>{minsToHours(item.minutos_extra)}</strong>
                  </div>
                  <div style={{ height: 7, borderRadius: 99, background: C.border }}>
                    <div style={{ height: 7, borderRadius: 99, background: "#14B8A6", width: `${Math.min(100, (item.minutos_extra / 720) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </Card>

            <Card>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.muted, marginBottom: 12 }}>DESGLOSE DE CONCEPTOS</div>
              {Object.entries(dashboard?.desglose_conceptos || {}).map(([key, value]) => (
                <div key={key} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{key}</span>
                  <span style={{ fontSize: 12 }}>{money(value)}</span>
                </div>
              ))}
            </Card>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            <Card>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.muted, marginBottom: 12 }}>ALERTA: MAS DE 12H EXTRA</div>
              {resumenAlertas.extras.length === 0 ? (
                <div style={{ fontSize: 12, color: C.muted }}>Sin alertas en el periodo.</div>
              ) : resumenAlertas.extras.map((item, index) => (
                <div key={index} style={{ padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ fontWeight: 700, fontSize: 12 }}>{item.empleado}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{minsToHours(item.minutos_extra)}</div>
                </div>
              ))}
            </Card>

            <Card>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.muted, marginBottom: 12 }}>JORNADAS INCONSISTENTES</div>
              {resumenAlertas.inconsistentes.length === 0 ? (
                <div style={{ fontSize: 12, color: C.muted }}>Sin inconsistencias detectadas.</div>
              ) : resumenAlertas.inconsistentes.slice(0, 8).map((item, index) => (
                <div key={index} style={{ padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ fontWeight: 700, fontSize: 12 }}>{item.empleado} - {item.fecha}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{(item.alertas || []).join(", ") || "Marcacion incompleta"}</div>
                </div>
              ))}
            </Card>

            <Card>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.muted, marginBottom: 12 }}>AUSENCIAS SIN VALIDAR</div>
              {resumenAlertas.ausencias.length === 0 ? (
                <div style={{ fontSize: 12, color: C.muted }}>No hay ausencias sin validar.</div>
              ) : resumenAlertas.ausencias.slice(0, 8).map((item, index) => (
                <div key={index} style={{ padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ fontWeight: 700, fontSize: 12 }}>{item.empleado}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{item.fecha}</div>
                </div>
              ))}
            </Card>
          </div>
        </div>
      )}

      {tab === "jornadas" && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 18px" }}>
            <div style={{ fontWeight: 800 }}>Jornadas procesadas</div>
            {canExportNomina && (
              <Btn
                variant="ghost"
                onClick={() => csvDownload(jornadas, `jornadas-${fechaInicio}-${fechaFin}`)}
              >
                EXPORTAR CSV
              </Btn>
            )}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  {["Empleado", "Estado", "Fecha", "Ruta", "Placa", "Horario", "Ord. dia", "Ord. noche", "Ord. dom/fest", "Extra dia", "Extra noche", "Extra dom/fest", "Alertas"].map((head) => (
                    <th key={head} style={{ padding: "10px 12px", textAlign: "left", color: C.muted, borderBottom: `2px solid ${C.border}`, whiteSpace: "nowrap" }}>{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jornadas.map((row) => (
                  <tr key={row.id}>
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}` }}>{row.empleado}</td>
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}`, textTransform: "capitalize" }}>{row.estado_laboral || "activo"}</td>
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}` }}>{row.fecha}</td>
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}` }}>{row.ruta_id || "-"}</td>
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}` }}>{row.vehiculo_placa || "-"}</td>
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}` }}>{row.horario_nombre || "-"}</td>
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}` }}>{minsToHours(row.minutos_ordinarios_diurnos)}</td>
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}` }}>{minsToHours(row.minutos_ordinarios_nocturnos)}</td>
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}` }}>
                      {minsToHours((row.minutos_ordinarios_dom_fest_diurnos || 0) + (row.minutos_ordinarios_dom_fest_nocturnos || 0))}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}` }}>{minsToHours(row.minutos_extra_diurnos)}</td>
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}` }}>{minsToHours(row.minutos_extra_nocturnos)}</td>
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}` }}>
                      {minsToHours((row.minutos_extra_dom_fest_diurnos || 0) + (row.minutos_extra_dom_fest_nocturnos || 0))}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}`, color: row.alertas?.length ? "#F59E0B" : C.muted }}>
                      {row.alertas?.length ? row.alertas.join(", ") : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "quincenas" && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 18px" }}>
            <div style={{ fontWeight: 800 }}>Liquidaciones quincenales</div>
            {canExportNomina && (
              <Btn
                variant="ghost"
                onClick={() => csvDownload(quincenas, `nomina-${fechaInicio}-${fechaFin}`)}
              >
                EXPORTAR CSV
              </Btn>
            )}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  {["Empleado", "Dias", "Salario", "Auxilio", "RN", "RDF", "RNDF", "Extras", "Devengado", "Neto"].map((head) => (
                    <th key={head} style={{ padding: "10px 12px", textAlign: "left", color: C.muted, borderBottom: `2px solid ${C.border}`, whiteSpace: "nowrap" }}>{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quincenas.map((row) => {
                  const totalExtras = (row.valor_HED || 0) + (row.valor_HEN || 0) + (row.valor_HEDDF || 0) + (row.valor_HENDF || 0);
                  return (
                    <tr key={row.id}>
                      <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}` }}>{row.empleado}</td>
                      <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}` }}>{row.dias_trabajados}</td>
                      <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}` }}>{money(row.salario_proporcional)}</td>
                      <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}` }}>{money(row.auxilio_transporte)}</td>
                      <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}` }}>{money(row.valor_RN)}</td>
                      <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}` }}>{money(row.valor_RDF)}</td>
                      <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}` }}>{money(row.valor_RNDF)}</td>
                      <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}` }}>{money(totalExtras)}</td>
                      <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}`, fontWeight: 700 }}>{money(row.total_devengado)}</td>
                      <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}`, fontWeight: 800, color: "#14B8A6" }}>{money(row.neto_pagar)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default Nomina;
