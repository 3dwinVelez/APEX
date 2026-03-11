import { useState, useRef } from "react";
import { C } from "../shared/constants";
import { Btn, Card } from "../shared/ui";

const CapturaFoto = ({ 
  onFotoCapturada, 
  etiqueta = "Tomar Foto", 
  obligatoria = false,
  existente = null,
  maxSizeMB = 5,
  compress = true 
}) => {
  const [preview, setPreview] = useState(existente);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const comprimirImagen = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Redimensionar si es muy grande (max 1920px ancho)
          const maxWidth = 1920;
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          // Comprimir a 80% calidad JPEG
          const compressed = canvas.toDataURL('image/jpeg', 0.8);
          resolve(compressed);
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCapturing(true);
    setError(null);

    try {
      // Validar tipo
      if (!file.type.startsWith('image/')) {
        throw new Error('Solo se permiten imagenes');
      }

      // Validar tamaño
      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > maxSizeMB) {
        throw new Error(`Imagen muy pesada (${sizeMB.toFixed(1)}MB). Max: ${maxSizeMB}MB`);
      }

      // Comprimir si está habilitado
      let base64;
      if (compress) {
        base64 = await comprimirImagen(file);
      } else {
        const reader = new FileReader();
        base64 = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      setPreview(base64);
      
      // Enviar metadata adicional
      const metadata = {
        base64,
        timestamp: new Date().toISOString(),
        size: file.size,
        sizeCompressed: Math.round((base64.length * 3) / 4), // Aproximado
        type: file.type,
        name: file.name
      };

      if (onFotoCapturada) onFotoCapturada(metadata);

    } catch (err) {
      setError(err.message);
      setPreview(null);
    } finally {
      setCapturing(false);
    }
  };

  const eliminarFoto = () => {
    setPreview(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
    if (onFotoCapturada) onFotoCapturada(null);
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        gap: 6, 
        marginBottom: 8 
      }}>
        <label style={{ 
          fontSize: 12, 
          fontWeight: 700, 
          color: C.muted,
          textTransform: "uppercase"
        }}>
          {etiqueta}
        </label>
        {obligatoria && (
          <span style={{ 
            fontSize: 11, 
            color: "#EF4444", 
            fontWeight: 700 
          }}>
            *
          </span>
        )}
      </div>

      {!preview ? (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            id={`foto-input-${etiqueta.replace(/\s/g, '-')}`}
          />
          
          <label 
            htmlFor={`foto-input-${etiqueta.replace(/\s/g, '-')}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px 20px',
              border: `2px dashed ${obligatoria && !preview ? '#EF4444' : C.border}`,
              borderRadius: 12,
              background: C.bg,
              cursor: 'pointer',
              transition: 'all 0.2s',
              minHeight: 180
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = C.accent}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = obligatoria && !preview ? '#EF4444' : C.border}
          >
            {capturing ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
                <div style={{ fontSize: 13, color: C.muted }}>Procesando...</div>
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📷</div>
                <div style={{ 
                  fontSize: 14, 
                  fontWeight: 600, 
                  color: C.accent,
                  marginBottom: 4
                }}>
                  Tomar Foto
                </div>
                <div style={{ fontSize: 11, color: C.muted }}>
                  Toca para abrir camara
                </div>
              </div>
            )}
          </label>
        </div>
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ position: 'relative' }}>
            <img 
              src={preview} 
              alt="Preview" 
              style={{ 
                width: '100%', 
                display: 'block',
                borderRadius: '12px 12px 0 0'
              }} 
            />
            <div style={{
              position: 'absolute',
              top: 8,
              right: 8,
              background: 'rgba(0,0,0,0.7)',
              borderRadius: 8,
              padding: '4px 10px',
              fontSize: 11,
              color: '#fff',
              fontWeight: 600
            }}>
              ✓ Capturada
            </div>
          </div>
          
          <div style={{ 
            padding: 12, 
            display: 'flex', 
            gap: 8 
          }}>
            <label 
              htmlFor={`foto-input-${etiqueta.replace(/\s/g, '-')}`}
              style={{
                flex: 1,
                padding: '10px 16px',
                background: C.bg,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                color: C.muted,
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = C.accent;
                e.currentTarget.style.color = '#fff';
                e.currentTarget.style.borderColor = C.accent;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = C.bg;
                e.currentTarget.style.color = C.muted;
                e.currentTarget.style.borderColor = C.border;
              }}
            >
              🔄 Retomar
            </label>
            
            <button
              onClick={eliminarFoto}
              style={{
                padding: '10px 16px',
                background: '#FEE2E2',
                border: '1px solid #EF4444',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                color: '#EF4444',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#EF4444';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#FEE2E2';
                e.currentTarget.style.color = '#EF4444';
              }}
            >
              🗑️ Eliminar
            </button>
          </div>
        </Card>
      )}

      {error && (
        <div style={{
          marginTop: 8,
          padding: '8px 12px',
          background: '#FEE2E2',
          border: '1px solid #EF4444',
          borderRadius: 8,
          fontSize: 12,
          color: '#EF4444',
          fontWeight: 600
        }}>
          ⚠️ {error}
        </div>
      )}
    </div>
  );
};

export default CapturaFoto;
