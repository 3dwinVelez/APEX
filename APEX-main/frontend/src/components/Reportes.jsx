import { useState, useEffect } from "react";
import { C, API_URL } from "../shared/constants";
import { Card, Btn, KPI, PageHeader, Toast } from "../shared/ui";
import { can } from "../shared/permissions";

// ============================================================
// HELPERS
// ============================================================
const fmt = (n) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);

const fmtDur = (min) => {
  if (!min) return "-";
  return `${Math.floor(min / 60)}h ${Math.round(min % 60)}m`;
};

const fmtFecha = (f) => {
  if (!f) return "-";
  // Normalizar formato: reemplazar espacio por T para compatibilidad
  const fecha = new Date(String(f).replace(" ", "T").slice(0, 19));
  return fecha.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const exportarCSV = (datos, nombre) => {
  if (!datos.length) return;
  const keys = Object.keys(datos[0]);
  const csv = [
    keys.join(","),
    ...datos.map(row =>
      keys.map(k => `"${String(row[k] ?? "").replace(/"/g, '""')}"`).join(",")
    )
  ].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nombre}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
const Reportes = ({ onBack, user }) => {
  const [ordenes, setOrdenes]       = useState([]);
  const [horasExtra, setHorasExtra] = useState([]);
  const [nominaDashboard, setNominaDashboard] = useState(null);
  const [loading, setLoading]       = useState(false);
  const [toast, setToast]           = useState(null);
  const [tab, setTab]               = useState("resumen");
  const [descargando, setDescargando] = useState(null);

  // Filtros
  const hoy = new Date().toISOString().split("T")[0];
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString().split("T")[0];
  const [fechaInicio, setFechaInicio] = useState(inicioMes);
  const [fechaFin, setFechaFin]       = useState(hoy);
  const [filtroTecnico, setFiltroTecnico] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const canExport = can(user, "reportes", "export") || can(user, "servicios", "export");

  const cargar = async () => {
    setLoading(true);
    try {
      const [ords, extra] = await Promise.all([
        fetch(`${API_URL}/ordenes?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`).then(x => x.json()).catch(() => []),
        fetch(`${API_URL}/reportes/horas-extra?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`)
          .then(x => x.json()).catch(() => []),
      ]);
      const nomina = await fetch(`${API_URL}/nomina/dashboard?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`)
        .then(x => x.json()).catch(() => null);
      const ordsArr = Array.isArray(ords) ? ords : [];
      console.log("=== REPORTES DEBUG ===");
      console.log("Total ordenes:", ordsArr.length);
      if (ordsArr.length > 0) {
        ordsArr.slice(0, 3).forEach((o, i) => {
          const raw = o.fecha_creacion || "";
          const f = raw.replace("T", " ").split(" ")[0];
          console.log(`Orden ${i+1}: fecha_creacion=${JSON.stringify(raw)} -> f=${JSON.stringify(f)}`);
          console.log(`  en periodo [${fechaInicio} - ${fechaFin}]: ${!f || (f >= fechaInicio && f <= fechaFin)}`);
        });
      }
      setOrdenes(ordsArr);
      setHorasExtra(Array.isArray(extra) ? extra : []);
      setNominaDashboard(nomina && typeof nomina === "object" ? nomina : null);
    } catch(err) {
      console.error("Error en cargar:", err);
    }
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  // ---- Filtrado del periodo ----
  const ordenesPeriodo = ordenes.filter(o => {
    // Extraer solo YYYY-MM-DD del campo fecha_creacion en cualquier formato
    const raw = o.fecha_creacion || o.fecha_inicio || "";
    // Soporta: "2026-03-16 10:49...", "2026-03-16T10:49...", "2026-03-16"
    const f = raw.replace("T", " ").split(" ")[0];
    // Si no tiene fecha válida, incluir la orden (no excluir por falta de dato)
    const enPeriodo = !f || (f >= fechaInicio && f <= fechaFin);
    const matchTec = !filtroTecnico || (o.tecnico_nombre || "") === filtroTecnico;
    const matchCat = !filtroCategoria || (o.referencia_categoria || "") === filtroCategoria;
    const matchEst = !filtroEstado || o.estado === filtroEstado;
    return enPeriodo && matchTec && matchCat && matchEst;
  });

  // ---- KPIs calculados ----
  const total       = ordenesPeriodo.length;
  const cerradas    = ordenesPeriodo.filter(o => o.estado === "cerrada");
  const noEjec      = ordenesPeriodo.filter(o => o.estado === "no_ejecutada");
  const enCurso     = ordenesPeriodo.filter(o => ["en_curso","inspeccion","ejecucion"].includes(o.estado));
  const eficiencia  = total > 0 ? Math.round((cerradas.length / total) * 100) : 0;
  const durProm     = cerradas.length > 0
    ? Math.round(cerradas.reduce((a, o) => a + (o.duracion_min || 0), 0) / cerradas.length)
    : 0;
  const totalExtra  = horasExtra.reduce((a, h) => a + (h.total_a_pagar || 0), 0);

  // ---- Listas para filtros ----
  const tecnicos    = [...new Set(ordenes.map(o => o.tecnico_nombre).filter(Boolean))].sort();
  const categorias  = [...new Set(ordenes.map(o => o.referencia_categoria).filter(Boolean))].sort();

  // ---- Agrupaciones para resumen ----
  const porTecnico = tecnicos.map(t => {
    const ords = ordenesPeriodo.filter(o => o.tecnico_nombre === t);
    const ok   = ords.filter(o => o.estado === "cerrada");
    const dur  = ok.length > 0
      ? Math.round(ok.reduce((a, o) => a + (o.duracion_min || 0), 0) / ok.length)
      : 0;
    return { tecnico: t, total: ords.length, completados: ok.length, eficiencia: ords.length > 0 ? Math.round(ok.length / ords.length * 100) : 0, dur_prom: dur };
  }).sort((a, b) => b.completados - a.completados);

  const porCategoria = categorias.map(c => {
    const ords = ordenesPeriodo.filter(o => o.referencia_categoria === c);
    return { categoria: c, total: ords.length, completados: ords.filter(o => o.estado === "cerrada").length };
  }).sort((a, b) => b.total - a.total);

  // ---- Descargar PDF de una orden ----
  const descargarPDF = async (ord) => {
    if (!canExport) {
      setToast({ msg: "No tienes permiso para descargar reportes", type: "error" });
      return;
    }
    setDescargando(ord.id);
    try {
      const res = await fetch(`${API_URL}/ordenes/${ord.id}/reporte-pdf`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Reporte-${ord.consecutivo}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setToast({ msg: `PDF ${ord.consecutivo} descargado`, type: "success" });
    } catch {
      setToast({ msg: "Error al generar PDF", type: "error" });
    } finally { setDescargando(null); }
  };

  // ---- Estilos reutilizables ----
  const tabStyle = (t) => ({
    padding: "8px 18px", borderRadius: 8, cursor: "pointer",
    fontSize: 12, fontWeight: 700,
    background: tab === t ? C.dark : C.bg,
    color: tab === t ? "#fff" : C.muted,
    border: `1px solid ${tab === t ? C.dark : C.border}`,
    transition: "all 0.15s"
  });

  const thS = {
    padding: "10px 12px", textAlign: "left", fontWeight: 700,
    fontSize: 10, color: C.muted, borderBottom: `2px solid ${C.border}`,
    whiteSpace: "nowrap", background: C.bg
  };

  const tdS = (i) => ({
    padding: "9px 12px",
    background: i % 2 === 0 ? "#fff" : C.bg + "80",
    borderBottom: `1px solid ${C.border}`,
    fontSize: 12
  });

  const COLORES_ESTADO = {
    cerrada: "#06D6A0", no_ejecutada: "#EF4444",
    pendiente: "#94A3B8", en_curso: "#00B4D8",
    inspeccion: "#F59E0B", ejecucion: "#8B5CF6"
  };

  return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <PageHeader title="Reportes y KPIs" subtitle="Analisis del periodo" onBack={onBack} />

      {/* ---- FILTROS ---- */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, marginBottom: 4 }}>DESDE</div>
            <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)}
              style={{ padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit" }} />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, marginBottom: 4 }}>HASTA</div>
            <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)}
              style={{ padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit" }} />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, marginBottom: 4 }}>TÉCNICO</div>
            <select value={filtroTecnico} onChange={e => setFiltroTecnico(e.target.value)}
              style={{ padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", minWidth: 140 }}>
              <option value="">Todos</option>
              {tecnicos.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, marginBottom: 4 }}>CATEGORÍA</div>
            <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}
              style={{ padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", minWidth: 130 }}>
              <option value="">Todas</option>
              {categorias.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, marginBottom: 4 }}>ESTADO</div>
            <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
              style={{ padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", minWidth: 130 }}>
              <option value="">Todos</option>
              <option value="cerrada">Completada</option>
              <option value="no_ejecutada">No Ejecutada</option>
              <option value="pendiente">Pendiente</option>
              <option value="en_curso">En Curso</option>
            </select>
          </div>
          <Btn onClick={cargar} disabled={loading} style={{ padding: "9px 20px" }}>
            {loading ? "Cargando..." : "Actualizar"}
          </Btn>
          <Btn variant="ghost" onClick={() => { setFiltroTecnico(""); setFiltroCategoria(""); setFiltroEstado(""); }}
            style={{ padding: "9px 14px" }}>
            Limpiar
          </Btn>
        </div>
      </Card>

      {/* ---- KPIs ---- */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <KPI label="SERVICIOS"      value={total}                color={C.accent} />
        <KPI label="COMPLETADOS"    value={cerradas.length}      color="#06D6A0" />
        <KPI label="NO EJECUTADOS"  value={noEjec.length}        color="#EF4444" />
        <KPI label="EN CURSO"       value={enCurso.length}       color="#F59E0B" />
        <KPI label="EFICIENCIA"     value={`${eficiencia}%`}     color="#8B5CF6" />
        <KPI label="TIEMPO PROM."   value={fmtDur(durProm)}      color="#00B4D8" />
      </div>

      {/* ---- TABS ---- */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          ["resumen",   "Resumen"],
          ["servicios", "Servicios"],
          ["tecnicos",  "Tecnicos"],
          ["horas",     "Horas Extra"],
          ["nomina",    "Gerencial Nomina"],
        ].map(([k, l]) => (
          <div key={k} onClick={() => setTab(k)} style={tabStyle(k)}>{l}</div>
        ))}
      </div>

      {/* ================================================================ */}
      {/* TAB: RESUMEN                                                      */}
      {/* ================================================================ */}
      {tab === "resumen" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>

          {/* Por estado */}
          <Card>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.muted, marginBottom: 14 }}>POR ESTADO</div>
            {[
              ["Completadas",    cerradas.length,    "#06D6A0"],
              ["En Curso",       enCurso.length,     "#F59E0B"],
              ["No Ejecutadas",  noEjec.length,      "#EF4444"],
              ["Pendientes",     ordenesPeriodo.filter(o => o.estado === "pendiente").length, "#94A3B8"],
            ].map(([lbl, val, col]) => (
              <div key={lbl} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: col }} />
                  <span style={{ fontSize: 13 }}>{lbl}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ height: 6, borderRadius: 3, background: col + "30", width: 80 }}>
                    <div style={{ height: 6, borderRadius: 3, background: col, width: `${total > 0 ? (val / total * 100) : 0}%`, transition: "width 0.4s" }} />
                  </div>
                  <span style={{ fontWeight: 800, color: col, fontSize: 16, minWidth: 28, textAlign: "right" }}>{val}</span>
                </div>
              </div>
            ))}
          </Card>

          {/* Por tipo de servicio */}
          <Card>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.muted, marginBottom: 14 }}>POR TIPO</div>
            {["montaje", "desmontaje", "ambos"].map(tipo => {
              const cnt = ordenesPeriodo.filter(o => o.tipo_servicio === tipo).length;
              const pct = total > 0 ? Math.round(cnt / total * 100) : 0;
              return (
                <div key={tipo} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ textTransform: "capitalize", fontWeight: 600 }}>{tipo}</span>
                    <span style={{ fontWeight: 700 }}>{cnt} <span style={{ color: C.muted, fontWeight: 400 }}>({pct}%)</span></span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: C.border }}>
                    <div style={{ height: 6, borderRadius: 3, width: `${pct}%`, background: C.accent, transition: "width 0.4s" }} />
                  </div>
                </div>
              );
            })}
          </Card>

          {/* Por categoria */}
          <Card>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.muted, marginBottom: 14 }}>POR CATEGORÍA</div>
            {porCategoria.slice(0, 6).map((c, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, textTransform: "capitalize" }}>{c.categoria}</span>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "#06D6A0", fontWeight: 600 }}>{c.completados} ok</span>
                  <span style={{ fontWeight: 800, color: C.accent }}>{c.total}</span>
                </div>
              </div>
            ))}
          </Card>

          {/* Acciones exportar */}
          {canExport && <Card>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.muted, marginBottom: 14 }}>EXPORTAR</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Btn variant="ghost" style={{ textAlign: "left", fontSize: 12 }}
                onClick={() => exportarCSV(ordenesPeriodo.map(o => ({
                  consecutivo: o.consecutivo, estado: o.estado,
                  tipo: o.tipo_servicio, cliente: o.cliente_nombre,
                  referencia: o.referencia_nombre, categoria: o.referencia_categoria || "",
                  tecnico: o.tecnico_nombre || "", duracion_min: o.duracion_min || 0,
                  fecha: (o.fecha_creacion || "").slice(0, 10)
                })), `servicios-${fechaInicio}-${fechaFin}`)}>
                Servicios del periodo (.csv)
              </Btn>
              <Btn variant="ghost" style={{ textAlign: "left", fontSize: 12 }}
                onClick={() => exportarCSV(
                  porTecnico.map(t => ({
                    tecnico: t.tecnico, total: t.total,
                    completados: t.completados, eficiencia_pct: t.eficiencia,
                    duracion_prom: fmtDur(t.dur_prom)
                  })), `tecnicos-${fechaInicio}-${fechaFin}`)}>
                Rendimiento tecnicos (.csv)
              </Btn>
              <Btn variant="ghost" style={{ textAlign: "left", fontSize: 12 }}
                onClick={() => exportarCSV(
                  horasExtra.map(h => ({
                    empleado: h.empleado, fecha: h.fecha,
                    horas_diurnas: h.horas_extra_diurnas,
                    horas_nocturnas: h.horas_extra_nocturnas,
                    total: h.total_a_pagar
                  })), `horas-extra-${fechaInicio}-${fechaFin}`)}>
                Horas extra (.csv)
              </Btn>
            </div>
          </Card>}
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB: SERVICIOS - tabla completa                                   */}
      {/* ================================================================ */}
      {tab === "servicios" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: C.muted }}>
              {ordenesPeriodo.length} orden(es) en el periodo
            </div>
            {canExport && <Btn variant="ghost" style={{ fontSize: 11 }}
              onClick={() => exportarCSV(ordenesPeriodo.map(o => ({
                consecutivo: o.consecutivo, estado: o.estado,
                tipo: o.tipo_servicio, cliente: o.cliente_nombre,
                direccion: o.cliente_direccion, referencia: o.referencia_nombre,
                categoria: o.referencia_categoria || "", tecnico: o.tecnico_nombre || "",
                duracion_min: o.duracion_min || 0,
                fecha_inicio: o.fecha_inicio ? o.fecha_inicio.slice(0, 10) : "",
                fecha_cierre: o.fecha_cierre ? o.fecha_cierre.slice(0, 10) : "",
                factura: o.num_factura || ""
              })), `servicios-${fechaInicio}-${fechaFin}`)}>
              Exportar CSV
            </Btn>}
          </div>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    {["OS","Estado","Tipo","Cliente","Referencia","Categoría","Técnico","Duración","Fecha",""].map(h => (
                      <th key={h} style={{ ...thS }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ordenesPeriodo.length === 0 && (
                    <tr>
                      <td colSpan={10} style={{ padding: 32, textAlign: "center", color: C.muted }}>
                        Sin ordenes en el periodo seleccionado
                      </td>
                    </tr>
                  )}
                  {ordenesPeriodo.map((o, i) => {
                    const col = COLORES_ESTADO[o.estado] || "#94A3B8";
                    return (
                      <tr key={i}>
                        <td style={{ ...tdS(i), fontWeight: 700 }}>{o.consecutivo}</td>
                        <td style={tdS(i)}>
                          <span style={{ padding: "2px 8px", borderRadius: 8, fontSize: 10, fontWeight: 700,
                            color: col, background: col + "18" }}>
                            {o.estado.replace("_", " ")}
                          </span>
                        </td>
                        <td style={{ ...tdS(i), textTransform: "capitalize" }}>{o.tipo_servicio}</td>
                        <td style={{ ...tdS(i), maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {o.cliente_nombre}
                        </td>
                        <td style={{ ...tdS(i), color: C.muted }}>{o.referencia_nombre}</td>
                        <td style={{ ...tdS(i), color: C.muted, textTransform: "capitalize" }}>
                          {o.referencia_categoria || "-"}
                        </td>
                        <td style={{ ...tdS(i), color: C.muted }}>{o.tecnico_nombre || "-"}</td>
                        <td style={{ ...tdS(i), fontWeight: 600, color: "#06D6A0", whiteSpace: "nowrap" }}>
                          {fmtDur(o.duracion_min)}
                        </td>
                        <td style={{ ...tdS(i), color: C.muted, whiteSpace: "nowrap" }}>
                          {fmtFecha(o.fecha_creacion)}
                        </td>
                        <td style={tdS(i)}>
                          {canExport && (o.estado === "cerrada" || o.estado === "no_ejecutada") && (
                            <Btn variant="ghost"
                              onClick={() => descargarPDF(o)}
                              disabled={descargando === o.id}
                              style={{ fontSize: 10, padding: "4px 10px", whiteSpace: "nowrap" }}>
                              {descargando === o.id ? "..." : "PDF"}
                            </Btn>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB: TECNICOS                                                     */}
      {/* ================================================================ */}
      {tab === "tecnicos" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: C.muted }}>{porTecnico.length} técnico(s)</div>
            {canExport && <Btn variant="ghost" style={{ fontSize: 11 }}
              onClick={() => exportarCSV(porTecnico.map(t => ({
                tecnico: t.tecnico, total: t.total, completados: t.completados,
                no_ejecutados: t.total - t.completados,
                eficiencia_pct: t.eficiencia, duracion_prom_min: t.dur_prom
              })), `tecnicos-${fechaInicio}-${fechaFin}`)}>
              Exportar CSV
            </Btn>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {porTecnico.length === 0 && (
              <Card>
                <div style={{ textAlign: "center", padding: 30, color: C.muted }}>
                  Sin datos de técnicos en el periodo
                </div>
              </Card>
            )}
            {porTecnico.map((t, i) => (
              <Card key={i}>
                <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  {/* Avatar */}
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.accent + "20",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 800, fontSize: 16, color: C.accent, flexShrink: 0 }}>
                    {t.tecnico.charAt(0).toUpperCase()}
                  </div>
                  {/* Nombre y barra */}
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{t.tecnico}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 6, borderRadius: 3, background: C.border }}>
                        <div style={{ height: 6, borderRadius: 3, width: `${t.eficiencia}%`,
                          background: t.eficiencia >= 80 ? "#06D6A0" : t.eficiencia >= 50 ? "#F59E0B" : "#EF4444",
                          transition: "width 0.5s" }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700,
                        color: t.eficiencia >= 80 ? "#06D6A0" : t.eficiencia >= 50 ? "#F59E0B" : "#EF4444" }}>
                        {t.eficiencia}%
                      </span>
                    </div>
                  </div>
                  {/* Stats */}
                  {[
                    ["TOTAL", t.total, C.accent],
                    ["COMPLETADOS", t.completados, "#06D6A0"],
                    ["NO EJEC.", t.total - t.completados, "#EF4444"],
                    ["T. PROM.", fmtDur(t.dur_prom), "#8B5CF6"],
                  ].map(([lbl, val, col]) => (
                    <div key={lbl} style={{ textAlign: "center", minWidth: 60 }}>
                      <div style={{ fontSize: 18, fontWeight: 900, color: col }}>{val}</div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: C.muted }}>{lbl}</div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB: HORAS EXTRA                                                  */}
      {/* ================================================================ */}
      {tab === "horas" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: C.muted }}>
              {horasExtra.length} registro(s) &nbsp;|&nbsp; Total: <strong>{fmt(horasExtra.reduce((a, h) => a + (h.total_a_pagar || 0), 0))}</strong>
            </div>
            {canExport && <Btn variant="ghost" style={{ fontSize: 11 }}
              onClick={() => exportarCSV(horasExtra.map(h => ({
                empleado: h.empleado, fecha: h.fecha,
                horas_diurnas: h.horas_extra_diurnas, horas_nocturnas: h.horas_extra_nocturnas,
                valor_diurno: h.valor_diurno, valor_nocturno: h.valor_nocturno,
                total: h.total_a_pagar
              })), `horas-extra-${fechaInicio}-${fechaFin}`)}>
              Exportar CSV
            </Btn>}
          </div>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            {horasExtra.length === 0 ? (
              <div style={{ textAlign: "center", padding: 30, color: C.muted }}>
                Sin horas extra en el periodo seleccionado
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>
                      {["Empleado","Fecha","H.Diurnas","H.Nocturnas","Valor Diurno","Valor Nocturno","Total"].map(h => (
                        <th key={h} style={thS}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {horasExtra.map((h, i) => (
                      <tr key={i}>
                        <td style={{ ...tdS(i), fontWeight: 600 }}>{h.empleado}</td>
                        <td style={{ ...tdS(i), color: C.muted }}>{h.fecha}</td>
                        <td style={tdS(i)}>{h.horas_extra_diurnas || 0}h</td>
                        <td style={tdS(i)}>{h.horas_extra_nocturnas || 0}h</td>
                        <td style={{ ...tdS(i), color: "#06D6A0", fontWeight: 600 }}>{fmt(h.valor_diurno)}</td>
                        <td style={{ ...tdS(i), color: "#8B5CF6", fontWeight: 600 }}>{fmt(h.valor_nocturno)}</td>
                        <td style={{ ...tdS(i), fontWeight: 800 }}>{fmt(h.total_a_pagar)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: `2px solid ${C.border}`, background: C.bg }}>
                      <td colSpan={4} style={{ padding: "10px 12px", fontWeight: 700 }}>TOTALES</td>
                      <td style={{ padding: "10px 12px", fontWeight: 800, color: "#06D6A0" }}>
                        {fmt(horasExtra.reduce((a, h) => a + (h.valor_diurno || 0), 0))}
                      </td>
                      <td style={{ padding: "10px 12px", fontWeight: 800, color: "#8B5CF6" }}>
                        {fmt(horasExtra.reduce((a, h) => a + (h.valor_nocturno || 0), 0))}
                      </td>
                      <td style={{ padding: "10px 12px", fontWeight: 900, fontSize: 13 }}>
                        {fmt(totalExtra)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === "nomina" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          <Card>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.muted, marginBottom: 14 }}>RESUMEN DIARIO / QUINCENAL</div>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12 }}>Total nomina</span>
                <strong>{fmt(nominaDashboard?.total_nomina || 0)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12 }}>% extras sobre salario base</span>
                <strong>{nominaDashboard?.porcentaje_extras_sobre_salario || 0}%</strong>
              </div>
            </div>
          </Card>

          <Card>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.muted, marginBottom: 14 }}>ANALISIS POR SEMANA</div>
            {(nominaDashboard?.analisis_semana || []).length === 0 ? (
              <div style={{ fontSize: 12, color: C.muted }}>Sin datos para el periodo.</div>
            ) : (
              (nominaDashboard?.analisis_semana || []).map((item) => (
                <div key={item.semana} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
                    <span>{item.semana}</span>
                    <strong>{fmtDur(item.minutos_extra)}</strong>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: C.border }}>
                    <div style={{ height: 6, borderRadius: 3, width: `${Math.min(100, (item.minutos_extra / 720) * 100)}%`, background: "#14B8A6" }} />
                  </div>
                </div>
              ))
            )}
          </Card>

          <Card>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.muted, marginBottom: 14 }}>DESGLOSE DE CONCEPTOS</div>
            {Object.entries(nominaDashboard?.desglose_conceptos || {}).map(([key, value]) => (
              <div key={key} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{key}</span>
                <span style={{ fontSize: 12 }}>{fmt(value)}</span>
              </div>
            ))}
          </Card>

          <Card>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.muted, marginBottom: 14 }}>ALERTAS</div>
            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#F59E0B", marginBottom: 6 }}>Mas de 12h extra</div>
                {(nominaDashboard?.alertas?.empleados_mas_12h_extra || []).slice(0, 4).map((item, index) => (
                  <div key={index} style={{ fontSize: 11, color: C.text, marginBottom: 4 }}>
                    {item.empleado} - {fmtDur(item.minutos_extra)}
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#EF4444", marginBottom: 6 }}>Jornadas inconsistentes</div>
                {(nominaDashboard?.alertas?.jornadas_inconsistentes || []).slice(0, 4).map((item, index) => (
                  <div key={index} style={{ fontSize: 11, color: C.text, marginBottom: 4 }}>
                    {item.empleado} - {item.fecha}
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#8B5CF6", marginBottom: 6 }}>Ausencias sin validar</div>
                {(nominaDashboard?.alertas?.ausencias_sin_validar || []).slice(0, 4).map((item, index) => (
                  <div key={index} style={{ fontSize: 11, color: C.text, marginBottom: 4 }}>
                    {item.empleado} - {item.fecha}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Reportes;
