// frontend/src/shared/Skeleton.jsx
// Componentes de loading mejorados para APEX SCJ

import { C } from "./constants";

// ============================================================
// SKELETON CARD - Para listas genéricas
// ============================================================

export const SkeletonCard = ({ style = {} }) => (
  <div style={{
    padding: 16,
    borderRadius: 14,
    background: C.card,
    border: `1px solid ${C.border}`,
    marginBottom: 14,
    ...style
  }}>
    <div style={{
      height: 18,
      background: C.bg,
      borderRadius: 6,
      marginBottom: 10,
      width: "60%",
      animation: "pulse 1.5s ease-in-out infinite"
    }} />
    <div style={{
      height: 14,
      background: C.bg,
      borderRadius: 4,
      marginBottom: 8,
      width: "40%",
      animation: "pulse 1.5s ease-in-out infinite",
      animationDelay: "0.2s"
    }} />
    <div style={{
      height: 12,
      background: C.bg,
      borderRadius: 4,
      width: "80%",
      animation: "pulse 1.5s ease-in-out infinite",
      animationDelay: "0.4s"
    }} />
  </div>
);

// ============================================================
// SKELETON LIST - Múltiples cards
// ============================================================

export const SkeletonList = ({ count = 3 }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </>
);

// ============================================================
// SKELETON TABLE ROW - Para tablas
// ============================================================

export const SkeletonTableRow = () => (
  <div style={{
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr 100px",
    gap: 12,
    padding: "12px 16px",
    borderBottom: `1px solid ${C.border}`,
    alignItems: "center"
  }}>
    {[60, 40, 50, 30].map((width, i) => (
      <div key={i} style={{
        height: 14,
        background: C.bg,
        borderRadius: 4,
        width: `${width}%`,
        animation: "pulse 1.5s ease-in-out infinite",
        animationDelay: `${i * 0.1}s`
      }} />
    ))}
  </div>
);

export const SkeletonTable = ({ rows = 5 }) => (
  <div style={{
    background: C.card,
    borderRadius: 14,
    border: `1px solid ${C.border}`,
    overflow: "hidden"
  }}>
    {Array.from({ length: rows }).map((_, i) => (
      <SkeletonTableRow key={i} />
    ))}
  </div>
);

// ============================================================
// SKELETON KPI - Para dashboard
// ============================================================

export const SkeletonKPI = () => (
  <div style={{
    padding: 18,
    borderRadius: 14,
    background: C.card,
    border: `1px solid ${C.border}`,
    flex: 1,
    minWidth: 140
  }}>
    <div style={{
      height: 12,
      background: C.bg,
      borderRadius: 4,
      marginBottom: 12,
      width: "50%",
      animation: "pulse 1.5s ease-in-out infinite"
    }} />
    <div style={{
      height: 32,
      background: C.bg,
      borderRadius: 6,
      width: "40%",
      animation: "pulse 1.5s ease-in-out infinite",
      animationDelay: "0.2s"
    }} />
  </div>
);

// ============================================================
// SKELETON DASHBOARD - Grid de KPIs
// ============================================================

export const SkeletonDashboard = () => (
  <div>
    <div style={{
      height: 24,
      background: C.bg,
      borderRadius: 6,
      marginBottom: 20,
      width: "30%",
      animation: "pulse 1.5s ease-in-out infinite"
    }} />
    <div style={{
      display: "flex",
      gap: 14,
      marginBottom: 28,
      flexWrap: "wrap"
    }}>
      {[1, 2, 3, 4].map(i => <SkeletonKPI key={i} />)}
    </div>
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
      gap: 14
    }}>
      {[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} />)}
    </div>
  </div>
);

// ============================================================
// SKELETON FORM - Para formularios
// ============================================================

export const SkeletonForm = () => (
  <div style={{
    padding: 20,
    background: C.card,
    borderRadius: 14,
    border: `1px solid ${C.border}`
  }}>
    {[1, 2, 3].map(i => (
      <div key={i} style={{ marginBottom: 16 }}>
        <div style={{
          height: 12,
          background: C.bg,
          borderRadius: 4,
          marginBottom: 8,
          width: "30%",
          animation: "pulse 1.5s ease-in-out infinite",
          animationDelay: `${i * 0.1}s`
        }} />
        <div style={{
          height: 40,
          background: C.bg,
          borderRadius: 8,
          animation: "pulse 1.5s ease-in-out infinite",
          animationDelay: `${i * 0.1 + 0.1}s`
        }} />
      </div>
    ))}
    <div style={{
      height: 44,
      background: C.bg,
      borderRadius: 10,
      marginTop: 20,
      animation: "pulse 1.5s ease-in-out infinite",
      animationDelay: "0.4s"
    }} />
  </div>
);

// ============================================================
// SKELETON ORDEN - Para detalle de orden
// ============================================================

export const SkeletonOrden = () => (
  <div>
    <div style={{
      padding: 16,
      background: C.card,
      borderRadius: 14,
      border: `1px solid ${C.border}`,
      marginBottom: 14
    }}>
      <div style={{
        height: 20,
        background: C.bg,
        borderRadius: 6,
        marginBottom: 12,
        width: "40%",
        animation: "pulse 1.5s ease-in-out infinite"
      }} />
      <div style={{
        height: 14,
        background: C.bg,
        borderRadius: 4,
        marginBottom: 8,
        width: "60%",
        animation: "pulse 1.5s ease-in-out infinite",
        animationDelay: "0.1s"
      }} />
      <div style={{
        height: 14,
        background: C.bg,
        borderRadius: 4,
        width: "50%",
        animation: "pulse 1.5s ease-in-out infinite",
        animationDelay: "0.2s"
      }} />
    </div>
    <SkeletonList count={3} />
  </div>
);

// ============================================================
// CSS ANIMATION (agregar a index.css)
// ============================================================

/*
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
*/

// ============================================================
// EJEMPLO DE USO
// ============================================================

/*
import { SkeletonList, SkeletonDashboard } from "../shared/Skeleton";

const Personal = () => {
  const [loading, setLoading] = useState(true);
  const [lista, setLista] = useState([]);

  useEffect(() => {
    cargarDatos().then(data => {
      setLista(data);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      {loading ? (
        <SkeletonList count={5} />
      ) : (
        lista.map(item => <Card>{item.nombre}</Card>)
      )}
    </div>
  );
};
*/

export default {
  SkeletonCard,
  SkeletonList,
  SkeletonTableRow,
  SkeletonTable,
  SkeletonKPI,
  SkeletonDashboard,
  SkeletonForm,
  SkeletonOrden
};
