import { useRef, useState, useEffect } from "react";
import { C } from "../shared/constants";
import { Btn } from "../shared/ui";
import { useData } from "../context/DataContext";


const FirmaDigital = ({ onFirmaCapturada, existente = null }) => {
  const canvasRef = useRef(null);
  const [dibujando, setDibujando] = useState(false);
  const [firma, setFirma] = useState(existente);
  const [hayTrazo, setHayTrazo] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Configurar canvas responsive
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;  // Retina display
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    // Estilo del trazo
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Si hay firma existente, cargarla
    if (existente) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        setHayTrazo(true);
      };
      img.src = existente;
    }
  }, [existente]);

  const iniciarDibujo = (e) => {
    setDibujando(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const dibujar = (e) => {
    if (!dibujando) return;
    e.preventDefault();
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
    setHayTrazo(true);
  };

  const terminarDibujo = () => {
    setDibujando(false);
  };

  const limpiar = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    ctx.clearRect(0, 0, rect.width, rect.height);
    setFirma(null);
    setHayTrazo(false);
    if (onFirmaCapturada) onFirmaCapturada(null);
  };

  const guardar = () => {
    if (!hayTrazo) return;
    
    const canvas = canvasRef.current;
    const firmaBase64 = canvas.toDataURL('image/png');
    
    const metadata = {
      base64: firmaBase64,
      timestamp: new Date().toISOString(),
      size: Math.round((firmaBase64.length * 3) / 4)
    };
    
    setFirma(firmaBase64);
    if (onFirmaCapturada) onFirmaCapturada(metadata);
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "space-between",
        marginBottom: 8 
      }}>
        <label style={{ 
          fontSize: 12, 
          fontWeight: 700, 
          color: C.muted,
          textTransform: "uppercase"
        }}>
          Firma del Cliente
          <span style={{ fontSize: 11, color: "#EF4444", fontWeight: 700, marginLeft: 6 }}>*</span>
        </label>
        
        {hayTrazo && (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={limpiar}
              style={{
                padding: "4px 12px",
                background: "#FEE2E2",
                border: "1px solid #EF4444",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                color: "#EF4444",
                cursor: "pointer"
              }}
            >
              🗑️ Limpiar
            </button>
            
            {!firma && (
              <button
                onClick={guardar}
                style={{
                  padding: "4px 12px",
                  background: "#06D6A0",
                  border: "1px solid #06D6A0",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#fff",
                  cursor: "pointer"
                }}
              >
                ✓ Confirmar
              </button>
            )}
          </div>
        )}
      </div>

      <div style={{
        border: `2px ${firma ? 'solid' : 'dashed'} ${firma ? '#06D6A0' : C.border}`,
        borderRadius: 12,
        background: firma ? '#06D6A008' : C.bg,
        padding: 8,
        position: 'relative'
      }}>
        <canvas
          ref={canvasRef}
          onMouseDown={iniciarDibujo}
          onMouseMove={dibujar}
          onMouseUp={terminarDibujo}
          onMouseLeave={terminarDibujo}
          onTouchStart={iniciarDibujo}
          onTouchMove={dibujar}
          onTouchEnd={terminarDibujo}
          style={{
            width: '100%',
            height: 180,
            cursor: 'crosshair',
            touchAction: 'none',
            background: '#fff',
            borderRadius: 8
          }}
        />
        
        {!hayTrazo && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            textAlign: 'center',
            color: C.muted,
            fontSize: 13
          }}>
            <div style={{ fontSize: 32, marginBottom: 4 }}>✍️</div>
            <div>Firma aqui con tu dedo o mouse</div>
          </div>
        )}

        {firma && (
          <div style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: 'rgba(6, 214, 160, 0.9)',
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: 11,
            color: '#fff',
            fontWeight: 600
          }}>
            ✓ Firmado
          </div>
        )}
      </div>

      {!hayTrazo && (
        <div style={{
          marginTop: 8,
          padding: '8px 12px',
          background: '#FEF3C7',
          border: '1px solid #F59E0B',
          borderRadius: 8,
          fontSize: 11,
          color: '#92400E',
          fontWeight: 600
        }}>
          💡 Firma requerida para cerrar el servicio
        </div>
      )}
    </div>
  );
};

export default FirmaDigital;
