import { C } from "../shared/constants";
import { Card, Btn, KPI, PageHeader } from "../shared/ui";
import { useData } from "../context/DataContext";

const Reportes = ({ onBack }) => (
  <div>
    <PageHeader title="Reportes y KPIs" subtitle="Analisis del periodo" onBack={onBack} />
    <div style={{ display: "flex", gap: 14, marginBottom: 28, flexWrap: "wrap" }}>
      <KPI label="SERVICIOS MES"    value="84"  icon="Servicios" color={C.accent} />
      <KPI label="HORAS TRABAJADAS" value="312" icon="Horarios" color="#8B5CF6" />
      <KPI label="NOVEDADES MES"    value="7"   icon="!" color={C.danger} />
      <KPI label="EFICIENCIA"       value="94%" icon="G" color={C.success} />
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
      {[
        { titulo: "Reporte de Servicios",   color: "#00B4D8" },
        { titulo: "Control de Asistencia",  color: "#8B5CF6" },
        { titulo: "Novedades del Mes",       color: "#EF4444" },
        { titulo: "Rendimiento Tecnicos",    color: "#06D6A0" },
      ].map((r, i) => (
        <Card key={i}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, marginBottom: 14,
            background: r.color + "18", border: "1px solid " + r.color + "30",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <div style={{ width: 16, height: 16, borderRadius: "50%", background: r.color }} />
          </div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{r.titulo}</div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>PDF  Excel</div>
          <Btn variant="ghost" style={{ fontSize: 11 }}>GENERAR</Btn>
        </Card>
      ))}
    </div>
  </div>
);

// ============================================================
// APP PRINCIPAL - PUNTO DE ENTRADA
// ============================================================

export default Reportes;
