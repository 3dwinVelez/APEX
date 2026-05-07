import { useState, useEffect, useCallback } from "react";
import { C, API_URL, getAuthHeaders } from "../shared/constants";
import { Card, Btn, PageHeader, Toast } from "../shared/ui";
import { can } from "../shared/permissions";

// ============================================================
// UTILIDADES
// ============================================================
const fmt = v => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(v || 0));
const fmtDur = m => { const h = Math.floor(m / 60); const min = m % 60; return h > 0 ? `${h}h ${min}m` : `${min}m`; };
const fmtPct = v => `${Math.round(v || 0)}%`;

const exportarCSV = (rows, nombre) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(","), ...rows.map(r => headers.map(k => `"${String(r[k] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${nombre}.csv`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
};

// ============================================================
// COMPONENTES DE GRAFICOS SVG DINAMICOS
// ============================================================

// Grafico de dona (donut)
const DonutChart = ({ data, size = 160, strokeWidth = 22 }) => {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const total = data.reduce((a, d) => a + d.value, 0);
  let offset = 0;
  const center = size / 2;

  if (total === 0) return (
    <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={size} height={size}>
        <circle cx={center} cy={center} r={r} fill="none" stroke="#E5E7EB" strokeWidth={strokeWidth} />
      </svg>
    </div>
  );

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      {data.map((d, i) => {
        const pct = d.value / total;
        const dash = pct * circ;
        const gap = circ - dash;
        const seg = (
          <circle key={i} cx={center} cy={center} r={r}
            fill="none" stroke={d.color} strokeWidth={strokeWidth}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
        );
        offset += dash;
        return seg;
      })}
    </svg>
  );
};

// Grafico de barras verticales
const BarChartV = ({ data, height = 140, color = "#2563EB", showValues = true }) => {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height, paddingTop: 20, position: "relative" }}>
      {data.map((d, i) => {
        const pct = (d.value / max) * 100;
        const barH = Math.max((pct / 100) * (height - 28), 2);
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            {showValues && d.value > 0 && (
              <div style={{ fontSize: 10, fontWeight: 700, color: d.color || color }}>{d.value}</div>
            )}
            <div style={{ width: "100%", borderRadius: "4px 4px 0 0",
              height: barH, background: d.color || color,
              opacity: i === data.length - 1 ? 1 : 0.65,
              transition: "height 0.6s ease",
              position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 100%)" }} />
            </div>
            <div style={{ fontSize: 9, color: "#6B7280", fontWeight: 500, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", maxWidth: "100%" }}>{d.label}</div>
          </div>
        );
      })}
    </div>
  );
};

// Grafico de linea SVG
const LineChart = ({ data, height = 100, color = "#2563EB", fill = true }) => {
  if (!data.length) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  const w = 100; const h = height;
  const pts = data.map((d, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h - ((d.value / max) * (h - 10)) - 5
  }));
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const fillPath = `${path} L ${pts[pts.length - 1].x} ${h} L 0 ${h} Z`;

  return (
    <svg width="100%" height={height} viewBox={`0 0 100 ${h}`} preserveAspectRatio="none">
      {fill && <path d={fillPath} fill={color} opacity="0.1" />}
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="1.5" fill={color} />
      ))}
    </svg>
  );
};

// Barra de progreso horizontal con label
const ProgressBar = ({ label, value, max, color, sub }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#111111" }}>{label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {sub && <span style={{ fontSize: 10, color: "#6B7280" }}>{sub}</span>}
          <span style={{ fontSize: 12, fontWeight: 700, color }}>{value}</span>
        </div>
      </div>
      <div style={{ height: 8, background: "#F3F4F6", borderRadius: 8, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 8, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
};

// Tarjeta KPI profesional
const KPITile = ({ label, value, sub, color, icon, trend }) => (
  <div style={{
    background: "#fff", borderRadius: 16, padding: "20px 22px",
    border: "1px solid #E5E7EB", position: "relative", overflow: "hidden",
  }}>
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: color }} />
    <div style={{ position: "absolute", bottom: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: color, opacity: 0.06 }} />
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: color + "18",
        display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={icon} />
        </svg>
      </div>
      {trend !== undefined && (
        <span style={{ fontSize: 11, fontWeight: 700, color: trend >= 0 ? "#06D6A0" : "#EF4444",
          background: (trend >= 0 ? "#06D6A0" : "#EF4444") + "15",
          padding: "2px 8px", borderRadius: 20 }}>
          {trend >= 0 ? "+" : ""}{trend}%
        </span>
      )}
    </div>
    <div style={{ fontSize: 32, fontWeight: 900, color: "#111111", lineHeight: 1, marginBottom: 4 }}>{value}</div>
    <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
    {sub && <div style={{ fontSize: 10, color, fontWeight: 600, marginTop: 3 }}>{sub}</div>}
  </div>
);

// Panel de seccion con header
const Section = ({ title, sub, action, children }) => (
  <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #E5E7EB", overflow: "hidden", marginBottom: 16 }}>
    <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#111111" }}>{title}</div>
        {sub && <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>{sub}</div>}
      </div>
      {action}
    </div>
    <div style={{ padding: "16px 20px" }}>{children}</div>
  </div>
);

// Badge de estado
const StateBadge = ({ estado }) => {
  const map = {
    cerrada:      { label: "Completada",   color: "#06D6A0" },
    no_ejecutada: { label: "No ejecutada", color: "#EF4444" },
    pendiente:    { label: "Pendiente",    color: "#94A3B8" },
    en_curso:     { label: "En curso",     color: "#F59E0B" },
    inspeccion:   { label: "Inspeccion",   color: "#F59E0B" },
    ejecucion:    { label: "Ejecucion",    color: "#8B5CF6" },
  };
  const s = map[estado] || { label: estado, color: "#6B7280" };
  return (
    <span style={{ padding: "3px 9px", borderRadius: 20, fontSize: 10, fontWeight: 700,
      background: s.color + "18", color: s.color, whiteSpace: "nowrap" }}>{s.label}</span>
  );
};

// ============================================================
// GENERADOR PDF CLIENTE (sin backend)
// ============================================================
const generarPDFReporte = async (tipo, datos, periodo, logo) => {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) throw new Error("jsPDF no esta cargado");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const W = 210; const H = 297;
  const azul = [37, 99, 235];
  const negro = [17, 17, 17];
  const gris = [107, 114, 128];
  const grisClaro = [243, 244, 246];

  // Header corporativo
  doc.setFillColor(...azul);
  doc.rect(0, 0, W, 40, "F");
  doc.setFillColor(0, 0, 0);
  doc.rect(0, 38, W, 2, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("APEX ERP", 15, 18);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Administracion Precisa de Equipos y Expediciones", 15, 26);
  doc.text("SCJ Soluciones Logisticas", 15, 32);

  doc.setFontSize(9);
  doc.text(`Periodo: ${periodo}`, W - 15, 18, { align: "right" });
  doc.text(`Generado: ${new Date().toLocaleDateString("es-CO")}`, W - 15, 25, { align: "right" });

  // Titulo del reporte
  doc.setFillColor(...grisClaro);
  doc.rect(0, 42, W, 16, "F");
  doc.setTextColor(...negro);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(tipo, 15, 53);

  let y = 68;

  // Contenido segun tipo
  if (tipo === "Reporte de Servicios") {
    // KPIs row
    const kpis = [
      { label: "Total ordenes", value: datos.total },
      { label: "Completadas", value: datos.cerradas },
      { label: "Eficiencia", value: `${datos.eficiencia}%` },
      { label: "Duracion promedio", value: fmtDur(datos.durProm) },
    ];
    const colW = (W - 30) / 4;
    kpis.forEach((k, i) => {
      const x = 15 + i * colW;
      doc.setFillColor(37, 99, 235);
      doc.rect(x, y, colW - 4, 1, "F");
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...azul);
      doc.text(String(k.value), x, y + 12);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...gris);
      doc.text(k.label.toUpperCase(), x, y + 18);
    });
    y += 30;

    // Tabla ordenes
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...negro);
    doc.text("Detalle de ordenes", 15, y);
    y += 6;

    // Header tabla
    doc.setFillColor(...negro);
    doc.rect(15, y, W - 30, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    const cols = ["OS", "Estado", "Cliente", "Tecnico", "Referencia", "Duracion", "Fecha"];
    const colsW = [18, 25, 40, 35, 35, 18, 22];
    let cx = 16;
    cols.forEach((c, i) => { doc.text(c, cx, y + 5); cx += colsW[i]; });
    y += 8;

    doc.setTextColor(...negro);
    datos.ordenes.slice(0, 30).forEach((o, idx) => {
      if (y > H - 30) { doc.addPage(); y = 20; }
      if (idx % 2 === 0) { doc.setFillColor(...grisClaro); doc.rect(15, y, W - 30, 7, "F"); }
      doc.setFontSize(7.5);
      cx = 16;
      const row = [
        (o.consecutivo || "").slice(0, 8),
        o.estado === "cerrada" ? "Completada" : o.estado === "no_ejecutada" ? "No ejec." : o.estado,
        (o.cliente_nombre || "").slice(0, 20),
        (o.tecnico_nombre || "Sin asignar").slice(0, 18),
        (o.referencia_nombre || "").slice(0, 18),
        fmtDur(o.duracion_min || 0),
        (o.fecha_creacion || "").slice(0, 10),
      ];
      row.forEach((v, i) => { doc.text(String(v), cx, y + 5); cx += colsW[i]; });
      y += 7;
    });
  }

  if (tipo === "Reporte de Tecnicos") {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...negro);
    doc.text("Rendimiento por tecnico", 15, y);
    y += 8;

    datos.porTecnico.forEach((t, idx) => {
      if (y > H - 50) { doc.addPage(); y = 20; }
      // Card tecnico
      doc.setFillColor(...grisClaro);
      doc.roundedRect(15, y, W - 30, 36, 3, 3, "F");
      doc.setFillColor(...azul);
      doc.rect(15, y, 4, 36, "F");

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...negro);
      doc.text(t.tecnico, 25, y + 10);

      // Stats
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...gris);
      const stats = [
        `Total: ${t.total}`, `Completados: ${t.completados}`,
        `No ejec.: ${t.total - t.completados}`, `T.Prom: ${fmtDur(t.dur_prom)}`
      ];
      stats.forEach((s, i) => doc.text(s, 25 + i * 45, y + 20));

      // Barra eficiencia
      const barW = W - 60;
      doc.setFillColor(229, 231, 235);
      doc.roundedRect(25, y + 26, barW, 5, 2, 2, "F");
      const pct = t.eficiencia / 100;
      const col = t.eficiencia >= 80 ? [6, 214, 160] : t.eficiencia >= 50 ? [245, 158, 11] : [239, 68, 68];
      doc.setFillColor(...col);
      doc.roundedRect(25, y + 26, barW * pct, 5, 2, 2, "F");
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...col);
      doc.text(`${t.eficiencia}%`, 25 + barW + 3, y + 30);

      y += 42;
    });
  }

  if (tipo === "Reporte de Asistencia") {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...negro);
    doc.text("Control de asistencia", 15, y);
    y += 6;

    // Header
    doc.setFillColor(...negro);
    doc.rect(15, y, W - 30, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    const hds = ["Empleado", "Fecha", "Ingreso", "Almuerzo", "Retorno", "Cierre", "H.Extra"];
    const hdsW = [35, 22, 18, 20, 18, 18, 18];
    let hx = 16;
    hds.forEach((h, i) => { doc.text(h, hx, y + 5); hx += hdsW[i]; });
    y += 8;

    doc.setTextColor(...negro);
    (datos.asistencia || []).slice(0, 35).forEach((a, idx) => {
      if (y > H - 25) { doc.addPage(); y = 20; }
      if (idx % 2 === 0) { doc.setFillColor(...grisClaro); doc.rect(15, y, W - 30, 7, "F"); }
      doc.setFontSize(7.5);
      hx = 16;
      const row = [
        (a.nombre || a.usuario || "").slice(0, 18),
        a.fecha || "", a.ingreso || "-", a.almuerzo || "-",
        a.retorno || "-", a.cierre || "-",
        a.horas_extra ? `${a.horas_extra}h` : "-"
      ];
      row.forEach((v, i) => { doc.text(String(v), hx, y + 5); hx += hdsW[i]; });
      y += 7;
    });
  }

  if (tipo === "Reporte de Flota") {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...negro);
    doc.text("Estado de la flota vehicular", 15, y);
    y += 8;

    (datos.vehiculos || []).forEach((v, idx) => {
      if (y > H - 35) { doc.addPage(); y = 20; }
      const col = v.estado === "activo" ? [6, 214, 160] : v.estado === "mantenimiento" ? [245, 158, 11] : [239, 68, 68];
      doc.setFillColor(...grisClaro);
      doc.roundedRect(15, y, W - 30, 28, 3, 3, "F");
      doc.setFillColor(...col);
      doc.rect(15, y, 4, 28, "F");
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...negro);
      doc.text(v.placa || "", 25, y + 9);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...gris);
      doc.text(`Modelo: ${v.modelo || "-"}  |  Tipo: ${v.tipo || "-"}  |  Estado: ${v.estado || "-"}`, 25, y + 17);
      doc.text(`Conductor actual: ${v.conductor || "Sin asignar"}`, 25, y + 23);
      y += 33;
    });
  }

  // Footer en cada pagina
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(...grisClaro);
    doc.rect(0, H - 12, W, 12, "F");
    doc.setFontSize(7);
    doc.setTextColor(...gris);
    doc.text("APEX ERP - Confidencial - SCJ Soluciones Logisticas", 15, H - 5);
    doc.text(`Pagina ${i} de ${totalPages}`, W - 15, H - 5, { align: "right" });
  }

  doc.save(`APEX-${tipo.replace(/ /g, "-")}-${periodo}.pdf`);
};

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
const Reportes = ({ onBack, user }) => {
  const [ordenes, setOrdenes]       = useState([]);
  const [asistencia, setAsistencia] = useState([]);
  const [vehiculos, setVehiculos]   = useState([]);
  const [horasExtra, setHorasExtra] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [toast, setToast]           = useState(null);
  const [tab, setTab]               = useState("resumen");
  const [generandoPDF, setGenerandoPDF] = useState(null);

  const hoy = new Date().toISOString().split("T")[0];
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
  const [fechaInicio, setFechaInicio] = useState(inicioMes);
  const [fechaFin, setFechaFin]       = useState(hoy);
  const [filtroTecnico, setFiltroTecnico] = useState("");
  const [filtroEstado, setFiltroEstado]   = useState("");

  const canExport = can(user, "reportes", "export") || can(user, "servicios", "export");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const h = getAuthHeaders();
      const [ords, extra, asis, vehs] = await Promise.all([
        fetch(`${API_URL}/ordenes?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`, { headers: h }).then(x => x.json()).catch(() => []),
        fetch(`${API_URL}/reportes/horas-extra?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`, { headers: h }).then(x => x.json()).catch(() => []),
        fetch(`${API_URL}/asistencia?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`, { headers: h }).then(x => x.json()).catch(() => []),
        fetch(`${API_URL}/vehiculos`, { headers: h }).then(x => x.json()).catch(() => []),
      ]);
      setOrdenes(Array.isArray(ords) ? ords : []);
      setHorasExtra(Array.isArray(extra) ? extra : []);
      setAsistencia(Array.isArray(asis) ? asis : []);
      setVehiculos(Array.isArray(vehs) ? vehs : []);
    } catch (e) {
      setToast({ msg: "Error cargando datos", type: "error" });
    }
    setLoading(false);
  }, [fechaInicio, fechaFin]);

  useEffect(() => { cargar(); }, []);

  // ---- Calculos ----
  const ordPeriodo = ordenes.filter(o => {
    const f = (o.fecha_creacion || o.fecha_inicio || "").replace("T", " ").split(" ")[0];
    const okF = !f || (f >= fechaInicio && f <= fechaFin);
    const okT = !filtroTecnico || (o.tecnico_nombre || "") === filtroTecnico;
    const okE = !filtroEstado || o.estado === filtroEstado;
    return okF && okT && okE;
  });

  const total      = ordPeriodo.length;
  const cerradas   = ordPeriodo.filter(o => o.estado === "cerrada");
  const noEjec     = ordPeriodo.filter(o => o.estado === "no_ejecutada");
  const enCurso    = ordPeriodo.filter(o => ["en_curso", "inspeccion", "ejecucion"].includes(o.estado));
  const pendientes = ordPeriodo.filter(o => o.estado === "pendiente");
  const eficiencia = total > 0 ? Math.round((cerradas.length / total) * 100) : 0;
  const durProm    = cerradas.length > 0 ? Math.round(cerradas.reduce((a, o) => a + (o.duracion_min || 0), 0) / cerradas.length) : 0;
  const totalExtra = horasExtra.reduce((a, h) => a + (h.total_a_pagar || 0), 0);

  const tecnicos   = [...new Set(ordenes.map(o => o.tecnico_nombre).filter(Boolean))].sort();
  const categorias = [...new Set(ordenes.map(o => o.referencia_categoria).filter(Boolean))].sort();

  const porTecnico = tecnicos.map(t => {
    const ords = ordPeriodo.filter(o => o.tecnico_nombre === t);
    const ok   = ords.filter(o => o.estado === "cerrada");
    const dur  = ok.length > 0 ? Math.round(ok.reduce((a, o) => a + (o.duracion_min || 0), 0) / ok.length) : 0;
    return { tecnico: t, total: ords.length, completados: ok.length, eficiencia: ords.length > 0 ? Math.round(ok.length / ords.length * 100) : 0, dur_prom: dur };
  }).sort((a, b) => b.completados - a.completados);

  const porCategoria = categorias.map(c => {
    const ords = ordPeriodo.filter(o => o.referencia_categoria === c);
    return { categoria: c, total: ords.length, completados: ords.filter(o => o.estado === "cerrada").length };
  }).sort((a, b) => b.total - a.total);

  // Datos para graficos de tendencia (ultimos 7 dias)
  const ultimos7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const ds = d.toISOString().split("T")[0];
    const label = d.toLocaleDateString("es-CO", { weekday: "short" });
    const count = ordenes.filter(o => (o.fecha_creacion || "").startsWith(ds)).length;
    return { label, value: count, date: ds };
  });

  const periodo = `${fechaInicio} al ${fechaFin}`;

  const handlePDF = async (tipo, datos) => {
    if (!canExport) { setToast({ msg: "Sin permiso para exportar", type: "error" }); return; }
    setGenerandoPDF(tipo);
    try {
      await generarPDFReporte(tipo, datos, periodo, null);
      setToast({ msg: `PDF generado: ${tipo}`, type: "success" });
    } catch (e) {
      setToast({ msg: "Error generando PDF. Verifica conexion.", type: "error" });
    }
    setGenerandoPDF(null);
  };

  // ---- Estilos ----
  const tabStyle = (t) => ({
    padding: "9px 18px", borderRadius: 10, cursor: "pointer",
    fontSize: 12, fontWeight: 700, transition: "all 0.15s",
    background: tab === t ? "#111111" : "#fff",
    color: tab === t ? "#fff" : "#6B7280",
    border: `1px solid ${tab === t ? "#111111" : "#E5E7EB"}`,
  });

  const thS = {
    padding: "11px 14px", textAlign: "left", fontWeight: 700, fontSize: 10,
    color: "#6B7280", borderBottom: "2px solid #F3F4F6",
    background: "#F9FAFB", whiteSpace: "nowrap",
  };

  const tdS = (i) => ({
    padding: "10px 14px", fontSize: 12,
    background: i % 2 === 0 ? "#fff" : "#FAFAFA",
    borderBottom: "1px solid #F3F4F6",
  });

  return (
    <div style={{ fontFamily: "'Poppins', sans-serif", maxWidth: 1200 }}>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "#6B7280", fontSize: 13, fontFamily: "inherit", padding: 0 }}>
              ← Volver
            </button>
          </div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#111111" }}>Reportes y Analisis</h2>
          <p style={{ margin: 0, fontSize: 12, color: "#6B7280" }}>Inteligencia operativa de SCJ Soluciones Logisticas</p>
        </div>
        {canExport && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => handlePDF("Reporte de Servicios", { total, cerradas: cerradas.length, eficiencia, durProm, ordenes: ordPeriodo })}
              disabled={generandoPDF === "Reporte de Servicios"}
              style={{ padding: "9px 16px", borderRadius: 10, background: "#2563EB", color: "#fff", border: "none",
                fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
              {generandoPDF === "Reporte de Servicios" ? "Generando..." : "PDF Servicios"}
            </button>
            <button onClick={() => handlePDF("Reporte de Tecnicos", { porTecnico })}
              disabled={generandoPDF === "Reporte de Tecnicos"}
              style={{ padding: "9px 16px", borderRadius: 10, background: "#111111", color: "#fff", border: "none",
                fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              {generandoPDF === "Reporte de Tecnicos" ? "Generando..." : "PDF Tecnicos"}
            </button>
            <button onClick={() => handlePDF("Reporte de Asistencia", { asistencia })}
              disabled={generandoPDF === "Reporte de Asistencia"}
              style={{ padding: "9px 16px", borderRadius: 10, background: "#8B5CF6", color: "#fff", border: "none",
                fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              {generandoPDF === "Reporte de Asistencia" ? "Generando..." : "PDF Asistencia"}
            </button>
            <button onClick={() => handlePDF("Reporte de Flota", { vehiculos })}
              disabled={generandoPDF === "Reporte de Flota"}
              style={{ padding: "9px 16px", borderRadius: 10, background: "#F59E0B", color: "#fff", border: "none",
                fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              {generandoPDF === "Reporte de Flota" ? "Generando..." : "PDF Flota"}
            </button>
          </div>
        )}
      </div>

      {/* FILTROS */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E5E7EB", padding: "16px 20px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
          {[
            { label: "DESDE", val: fechaInicio, set: setFechaInicio },
            { label: "HASTA", val: fechaFin, set: setFechaFin },
          ].map(f => (
            <div key={f.label}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#6B7280", marginBottom: 4 }}>{f.label}</div>
              <input type="date" value={f.val} onChange={e => f.set(e.target.value)}
                style={{ padding: "9px 12px", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
            </div>
          ))}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#6B7280", marginBottom: 4 }}>TECNICO</div>
            <select value={filtroTecnico} onChange={e => setFiltroTecnico(e.target.value)}
              style={{ padding: "9px 12px", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, fontFamily: "inherit", minWidth: 140, outline: "none" }}>
              <option value="">Todos</option>
              {tecnicos.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#6B7280", marginBottom: 4 }}>ESTADO</div>
            <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
              style={{ padding: "9px 12px", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, fontFamily: "inherit", minWidth: 130, outline: "none" }}>
              <option value="">Todos</option>
              <option value="cerrada">Completadas</option>
              <option value="pendiente">Pendientes</option>
              <option value="no_ejecutada">No ejecutadas</option>
              <option value="en_curso">En curso</option>
            </select>
          </div>
          <button onClick={cargar} disabled={loading}
            style={{ padding: "9px 20px", borderRadius: 10, background: "#2563EB", color: "#fff", border: "none",
              fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", height: 40 }}>
            {loading ? "Cargando..." : "Aplicar"}
          </button>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          ["resumen", "Resumen general"],
          ["servicios", "Servicios"],
          ["tecnicos", "Tecnicos"],
          ["asistencia", "Asistencia"],
          ["flota", "Flota"],
          ["horas", "Horas extra"],
        ].map(([k, l]) => (
          <div key={k} onClick={() => setTab(k)} style={tabStyle(k)}>{l}</div>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: 48, color: "#6B7280" }}>
          <div style={{ fontSize: 13 }}>Cargando datos...</div>
        </div>
      )}

      {/* ===== TAB: RESUMEN ===== */}
      {!loading && tab === "resumen" && (
        <div>
          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14, marginBottom: 20 }}>
            <KPITile label="Total ordenes" value={total} color="#2563EB"
              sub={`Periodo seleccionado`}
              icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            <KPITile label="Completadas" value={cerradas.length} color="#06D6A0"
              sub={fmtPct(eficiencia) + " de eficiencia"}
              icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            <KPITile label="No ejecutadas" value={noEjec.length} color="#EF4444"
              sub="Requieren atencion"
              icon="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            <KPITile label="En curso" value={enCurso.length} color="#F59E0B"
              sub="Activas ahora"
              icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            <KPITile label="Tiempo promedio" value={fmtDur(durProm)} color="#8B5CF6"
              sub="Por orden cerrada"
              icon="M13 10V3L4 14h7v7l9-11h-7z" />
            <KPITile label="Horas extra $" value={fmt(totalExtra)} color="#14B8A6"
              sub="Total a pagar"
              icon="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </div>

          {/* Graficos fila 1 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14, marginBottom: 14 }}>

            {/* Dona estados */}
            <Section title="Distribucion por estado" sub="Ordenes del periodo">
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <DonutChart data={[
                    { value: cerradas.length, color: "#06D6A0" },
                    { value: enCurso.length, color: "#F59E0B" },
                    { value: noEjec.length, color: "#EF4444" },
                    { value: pendientes.length, color: "#E5E7EB" },
                  ]} />
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#111111" }}>{eficiencia}%</div>
                    <div style={{ fontSize: 9, color: "#6B7280", fontWeight: 600 }}>EFICIENCIA</div>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  {[
                    { label: "Completadas", value: cerradas.length, color: "#06D6A0" },
                    { label: "En curso", value: enCurso.length, color: "#F59E0B" },
                    { label: "No ejecutadas", value: noEjec.length, color: "#EF4444" },
                    { label: "Pendientes", value: pendientes.length, color: "#94A3B8" },
                  ].map(item => (
                    <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: "#6B7280" }}>{item.label}</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: item.color }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Section>

            {/* Tendencia 7 dias */}
            <Section title="Tendencia ultimos 7 dias" sub="Ordenes por dia">
              <BarChartV data={ultimos7.map(d => ({ ...d, color: "#2563EB" }))} color="#2563EB" />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <span style={{ fontSize: 10, color: "#6B7280" }}>Promedio: {total > 0 ? Math.round(total / 7) : 0} ord/dia</span>
                <span style={{ fontSize: 10, color: "#2563EB", fontWeight: 700 }}>Hoy: {ultimos7[6]?.value || 0}</span>
              </div>
            </Section>

            {/* Por tipo */}
            <Section title="Por tipo de servicio" sub="Distribucion de trabajos">
              {["montaje", "desmontaje", "ambos"].map(tipo => {
                const cnt = ordPeriodo.filter(o => o.tipo_servicio === tipo).length;
                const colors = { montaje: "#2563EB", desmontaje: "#8B5CF6", ambos: "#06D6A0" };
                return (
                  <ProgressBar key={tipo} label={tipo.charAt(0).toUpperCase() + tipo.slice(1)}
                    value={cnt} max={total} color={colors[tipo]}
                    sub={total > 0 ? fmtPct(cnt / total * 100) : "0%"} />
                );
              })}
            </Section>

            {/* Top categorias */}
            <Section title="Top categorias" sub="Por volumen de ordenes">
              {porCategoria.slice(0, 5).map((c, i) => (
                <ProgressBar key={c.categoria} label={c.categoria}
                  value={c.total} max={Math.max(...porCategoria.map(x => x.total), 1)}
                  color={["#2563EB", "#8B5CF6", "#06D6A0", "#F59E0B", "#EF4444"][i % 5]}
                  sub={`${c.completados} completadas`} />
              ))}
              {porCategoria.length === 0 && <div style={{ fontSize: 12, color: "#6B7280", textAlign: "center", padding: 16 }}>Sin datos</div>}
            </Section>
          </div>

          {/* Top tecnicos rapido */}
          <Section title="Ranking de tecnicos" sub="Por eficiencia en el periodo"
            action={canExport && <button onClick={() => exportarCSV(porTecnico.map(t => ({ tecnico: t.tecnico, total: t.total, completados: t.completados, eficiencia: t.eficiencia + "%", tiempo_prom: fmtDur(t.dur_prom) })), `tecnicos-${fechaInicio}-${fechaFin}`)}
              style={{ padding: "6px 14px", borderRadius: 8, background: "#F3F4F6", border: "none", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>CSV</button>}>
            {porTecnico.slice(0, 5).map((t, i) => (
              <div key={t.tecnico} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: ["#2563EB", "#8B5CF6", "#06D6A0", "#F59E0B", "#EF4444"][i] + "20",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, color: ["#2563EB", "#8B5CF6", "#06D6A0", "#F59E0B", "#EF4444"][i], flexShrink: 0 }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#111111" }}>{t.tecnico}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: t.eficiencia >= 80 ? "#06D6A0" : t.eficiencia >= 50 ? "#F59E0B" : "#EF4444" }}>{t.eficiencia}%</span>
                  </div>
                  <div style={{ height: 6, background: "#F3F4F6", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${t.eficiencia}%`, borderRadius: 4, transition: "width 0.6s",
                      background: t.eficiencia >= 80 ? "#06D6A0" : t.eficiencia >= 50 ? "#F59E0B" : "#EF4444" }} />
                  </div>
                  <div style={{ display: "flex", gap: 12, marginTop: 3 }}>
                    <span style={{ fontSize: 9, color: "#6B7280" }}>{t.total} ordenes · {t.completados} completadas · {fmtDur(t.dur_prom)} prom.</span>
                  </div>
                </div>
              </div>
            ))}
            {porTecnico.length === 0 && <div style={{ fontSize: 12, color: "#6B7280", textAlign: "center", padding: 20 }}>Sin datos de tecnicos</div>}
          </Section>
        </div>
      )}

      {/* ===== TAB: SERVICIOS ===== */}
      {!loading && tab === "servicios" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: "#6B7280" }}>{ordPeriodo.length} orden(es) en el periodo</div>
            <div style={{ display: "flex", gap: 8 }}>
              {canExport && <>
                <button onClick={() => exportarCSV(ordPeriodo.map(o => ({
                  consecutivo: o.consecutivo, estado: o.estado, tipo: o.tipo_servicio,
                  cliente: o.cliente_nombre, direccion: o.cliente_direccion,
                  referencia: o.referencia_nombre, categoria: o.referencia_categoria || "",
                  tecnico: o.tecnico_nombre || "", duracion_min: o.duracion_min || 0,
                  fecha: (o.fecha_creacion || "").slice(0, 10), factura: o.num_factura || ""
                })), `servicios-${fechaInicio}-${fechaFin}`)}
                  style={{ padding: "8px 14px", borderRadius: 8, background: "#F3F4F6", border: "none", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  CSV
                </button>
                <button onClick={() => handlePDF("Reporte de Servicios", { total, cerradas: cerradas.length, eficiencia, durProm, ordenes: ordPeriodo })}
                  disabled={generandoPDF !== null}
                  style={{ padding: "8px 14px", borderRadius: 8, background: "#2563EB", color: "#fff", border: "none", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  {generandoPDF === "Reporte de Servicios" ? "Generando..." : "PDF"}
                </button>
              </>}
            </div>
          </div>
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E5E7EB", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    {["Consecutivo", "Estado", "Tipo", "Cliente", "Referencia", "Tecnico", "Duracion", "Fecha"].map(h => (
                      <th key={h} style={thS}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ordPeriodo.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#6B7280" }}>Sin ordenes en el periodo</td></tr>
                  )}
                  {ordPeriodo.map((o, i) => (
                    <tr key={o.id}>
                      <td style={tdS(i)}><span style={{ fontWeight: 700, color: "#2563EB" }}>{o.consecutivo}</span></td>
                      <td style={tdS(i)}><StateBadge estado={o.estado} /></td>
                      <td style={tdS(i)}>{o.tipo_servicio}</td>
                      <td style={tdS(i)}>{o.cliente_nombre}</td>
                      <td style={tdS(i)}>{o.referencia_nombre}</td>
                      <td style={tdS(i)}>{o.tecnico_nombre || <span style={{ color: "#94A3B8" }}>Sin asignar</span>}</td>
                      <td style={tdS(i)}>{o.duracion_min ? fmtDur(o.duracion_min) : "-"}</td>
                      <td style={tdS(i)}>{(o.fecha_creacion || "").slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===== TAB: TECNICOS ===== */}
      {!loading && tab === "tecnicos" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: "#6B7280" }}>{porTecnico.length} tecnico(s) con actividad</div>
            <div style={{ display: "flex", gap: 8 }}>
              {canExport && <>
                <button onClick={() => exportarCSV(porTecnico.map(t => ({ tecnico: t.tecnico, total: t.total, completados: t.completados, eficiencia: t.eficiencia + "%", tiempo_prom: fmtDur(t.dur_prom) })), `tecnicos-${fechaInicio}-${fechaFin}`)}
                  style={{ padding: "8px 14px", borderRadius: 8, background: "#F3F4F6", border: "none", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  CSV
                </button>
                <button onClick={() => handlePDF("Reporte de Tecnicos", { porTecnico })}
                  disabled={generandoPDF !== null}
                  style={{ padding: "8px 14px", borderRadius: 8, background: "#111111", color: "#fff", border: "none", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  {generandoPDF === "Reporte de Tecnicos" ? "Generando..." : "PDF"}
                </button>
              </>}
            </div>
          </div>

          {/* Grafico de barras comparativo */}
          <Section title="Comparativa de rendimiento" sub="Ordenes completadas vs total por tecnico">
            <BarChartV
              data={porTecnico.slice(0, 8).map(t => ({ label: t.tecnico.split(" ")[0], value: t.completados, color: t.eficiencia >= 80 ? "#06D6A0" : t.eficiencia >= 50 ? "#F59E0B" : "#EF4444" }))}
              height={120}
            />
          </Section>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {porTecnico.map((t, i) => (
              <div key={t.tecnico} style={{ background: "#fff", borderRadius: 14, border: "1px solid #E5E7EB", padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                  <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#2563EB18",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 900, fontSize: 18, color: "#2563EB", flexShrink: 0 }}>
                    {t.tecnico.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#111111" }}>{t.tecnico}</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: t.eficiencia >= 80 ? "#06D6A0" : t.eficiencia >= 50 ? "#F59E0B" : "#EF4444" }}>
                        {t.eficiencia}%
                      </div>
                    </div>
                    <div style={{ height: 8, background: "#F3F4F6", borderRadius: 8, overflow: "hidden", marginBottom: 10 }}>
                      <div style={{ height: "100%", width: `${t.eficiencia}%`, borderRadius: 8, transition: "width 0.6s",
                        background: t.eficiencia >= 80 ? "#06D6A0" : t.eficiencia >= 50 ? "#F59E0B" : "#EF4444" }} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                      {[
                        { label: "TOTAL", value: t.total, color: "#2563EB" },
                        { label: "COMPLETADOS", value: t.completados, color: "#06D6A0" },
                        { label: "NO EJEC.", value: t.total - t.completados, color: "#EF4444" },
                        { label: "T.PROM", value: fmtDur(t.dur_prom), color: "#8B5CF6" },
                      ].map(s => (
                        <div key={s.label} style={{ textAlign: "center", padding: "8px", background: s.color + "08", borderRadius: 8 }}>
                          <div style={{ fontSize: 16, fontWeight: 900, color: s.color }}>{s.value}</div>
                          <div style={{ fontSize: 8, fontWeight: 700, color: "#6B7280", letterSpacing: 0.5 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {porTecnico.length === 0 && (
              <div style={{ textAlign: "center", padding: 40, color: "#6B7280", background: "#fff", borderRadius: 14, border: "1px solid #E5E7EB" }}>
                Sin datos de tecnicos en el periodo
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== TAB: ASISTENCIA ===== */}
      {!loading && tab === "asistencia" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: "#6B7280" }}>{asistencia.length} registros del periodo</div>
            <div style={{ display: "flex", gap: 8 }}>
              {canExport && <>
                <button onClick={() => exportarCSV(asistencia.map(a => ({ usuario: a.usuario || a.nombre, tipo: a.tipo_marca, hora: a.hora, fecha: a.fecha, vehiculo: a.vehiculo_placa || "" })), `asistencia-${fechaInicio}-${fechaFin}`)}
                  style={{ padding: "8px 14px", borderRadius: 8, background: "#F3F4F6", border: "none", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  CSV
                </button>
                <button onClick={() => handlePDF("Reporte de Asistencia", { asistencia })}
                  disabled={generandoPDF !== null}
                  style={{ padding: "8px 14px", borderRadius: 8, background: "#8B5CF6", color: "#fff", border: "none", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  {generandoPDF === "Reporte de Asistencia" ? "Generando..." : "PDF"}
                </button>
              </>}
            </div>
          </div>

          {/* KPIs asistencia */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12, marginBottom: 16 }}>
            {[
              { label: "Ingresaron", value: asistencia.filter(a => a.tipo_marca === "INGRESO").length, color: "#2563EB" },
              { label: "En almuerzo", value: asistencia.filter(a => a.tipo_marca === "ALMUERZO").length, color: "#F59E0B" },
              { label: "Retornaron", value: asistencia.filter(a => a.tipo_marca === "RETORNO").length, color: "#06D6A0" },
              { label: "Cerraron", value: asistencia.filter(a => a.tipo_marca === "CIERRE").length, color: "#8B5CF6" },
            ].map(k => (
              <div key={k.label} style={{ background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB",
                padding: "14px 16px", borderTop: `3px solid ${k.color}` }}>
                <div style={{ fontSize: 26, fontWeight: 900, color: k.color }}>{k.value}</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#6B7280", textTransform: "uppercase" }}>{k.label}</div>
              </div>
            ))}
          </div>

          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E5E7EB", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    {["Operario", "Tipo marcacion", "Hora", "Fecha", "Vehiculo"].map(h => (
                      <th key={h} style={thS}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {asistencia.length === 0 && (
                    <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#6B7280" }}>Sin registros de asistencia</td></tr>
                  )}
                  {asistencia.map((a, i) => {
                    const marcaColors = { INGRESO: "#2563EB", ALMUERZO: "#F59E0B", RETORNO: "#06D6A0", CIERRE: "#8B5CF6" };
                    const col = marcaColors[a.tipo_marca] || "#6B7280";
                    return (
                      <tr key={i}>
                        <td style={tdS(i)}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#2563EB18",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 11, fontWeight: 700, color: "#2563EB" }}>
                              {(a.usuario || a.nombre || "?").charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 600 }}>{a.usuario || a.nombre}</span>
                          </div>
                        </td>
                        <td style={tdS(i)}>
                          <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700,
                            background: col + "18", color: col }}>{a.tipo_marca}</span>
                        </td>
                        <td style={tdS(i)}><span style={{ fontWeight: 600, color: "#111111" }}>{a.hora}</span></td>
                        <td style={tdS(i)}>{a.fecha}</td>
                        <td style={tdS(i)}>{a.vehiculo_placa || <span style={{ color: "#94A3B8" }}>-</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===== TAB: FLOTA ===== */}
      {!loading && tab === "flota" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: "#6B7280" }}>{vehiculos.length} vehiculo(s) registrados</div>
            <div style={{ display: "flex", gap: 8 }}>
              {canExport && <>
                <button onClick={() => exportarCSV(vehiculos.map(v => ({ placa: v.placa, modelo: v.modelo || "", tipo: v.tipo || "", estado: v.estado || "" })), `flota-${hoy}`)}
                  style={{ padding: "8px 14px", borderRadius: 8, background: "#F3F4F6", border: "none", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  CSV
                </button>
                <button onClick={() => handlePDF("Reporte de Flota", { vehiculos })}
                  disabled={generandoPDF !== null}
                  style={{ padding: "8px 14px", borderRadius: 8, background: "#F59E0B", color: "#fff", border: "none", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  {generandoPDF === "Reporte de Flota" ? "Generando..." : "PDF"}
                </button>
              </>}
            </div>
          </div>

          {/* KPIs flota */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12, marginBottom: 16 }}>
            {[
              { label: "Total", value: vehiculos.length, color: "#2563EB" },
              { label: "Activos", value: vehiculos.filter(v => v.estado === "activo").length, color: "#06D6A0" },
              { label: "Mantenimiento", value: vehiculos.filter(v => v.estado === "mantenimiento").length, color: "#F59E0B" },
              { label: "Inactivos", value: vehiculos.filter(v => v.estado === "inactivo").length, color: "#EF4444" },
            ].map(k => (
              <div key={k.label} style={{ background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB",
                padding: "14px 16px", borderTop: `3px solid ${k.color}` }}>
                <div style={{ fontSize: 26, fontWeight: 900, color: k.color }}>{k.value}</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#6B7280", textTransform: "uppercase" }}>{k.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {vehiculos.map((v, i) => {
              const stCol = v.estado === "activo" ? "#06D6A0" : v.estado === "mantenimiento" ? "#F59E0B" : "#EF4444";
              return (
                <div key={i} style={{ background: "#fff", borderRadius: 14, border: "1px solid #E5E7EB",
                  padding: "16px 18px", borderLeft: `4px solid ${stCol}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: "#111111", letterSpacing: 1 }}>{v.placa}</div>
                      <div style={{ fontSize: 12, color: "#6B7280" }}>{v.modelo || "Sin modelo"}</div>
                    </div>
                    <span style={{ padding: "4px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700,
                      background: stCol + "18", color: stCol, textTransform: "uppercase" }}>
                      {v.estado || "activo"}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {v.tipo && <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 10, background: "#F3F4F6", color: "#6B7280" }}>{v.tipo}</span>}
                    {v.combustible && <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 10, background: "#F3F4F6", color: "#6B7280" }}>{v.combustible}</span>}
                  </div>
                </div>
              );
            })}
            {vehiculos.length === 0 && (
              <div style={{ textAlign: "center", padding: 40, color: "#6B7280", background: "#fff", borderRadius: 14, border: "1px solid #E5E7EB", gridColumn: "1/-1" }}>
                Sin vehiculos registrados
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== TAB: HORAS EXTRA ===== */}
      {!loading && tab === "horas" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: "#6B7280" }}>
              {horasExtra.length} registro(s) · Total: <strong style={{ color: "#14B8A6" }}>{fmt(totalExtra)}</strong>
            </div>
            {canExport && (
              <button onClick={() => exportarCSV(horasExtra.map(h => ({
                empleado: h.empleado, fecha: h.fecha,
                horas_diurnas: h.horas_extra_diurnas, horas_nocturnas: h.horas_extra_nocturnas,
                valor_diurno: h.valor_diurno, valor_nocturno: h.valor_nocturno, total: h.total_a_pagar
              })), `horas-extra-${fechaInicio}-${fechaFin}`)}
                style={{ padding: "8px 14px", borderRadius: 8, background: "#F3F4F6", border: "none", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                CSV
              </button>
            )}
          </div>

          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E5E7EB", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    {["Empleado", "Fecha", "H.Diurnas", "H.Nocturnas", "Valor Diurno", "Valor Nocturno", "Total"].map(h => (
                      <th key={h} style={thS}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {horasExtra.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#6B7280" }}>Sin horas extra en el periodo</td></tr>
                  )}
                  {horasExtra.map((h, i) => (
                    <tr key={i}>
                      <td style={tdS(i)}><span style={{ fontWeight: 600 }}>{h.empleado}</span></td>
                      <td style={tdS(i)}>{h.fecha}</td>
                      <td style={tdS(i)}><span style={{ color: "#F59E0B", fontWeight: 600 }}>{h.horas_extra_diurnas || 0}h</span></td>
                      <td style={tdS(i)}><span style={{ color: "#8B5CF6", fontWeight: 600 }}>{h.horas_extra_nocturnas || 0}h</span></td>
                      <td style={tdS(i)}>{fmt(h.valor_diurno || 0)}</td>
                      <td style={tdS(i)}>{fmt(h.valor_nocturno || 0)}</td>
                      <td style={tdS(i)}><span style={{ fontWeight: 700, color: "#14B8A6" }}>{fmt(h.total_a_pagar || 0)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reportes;
