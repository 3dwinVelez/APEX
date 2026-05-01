// frontend/src/context/DataContext.jsx
// Sistema de caché global para APEX SCJ

import { createContext, useContext, useState, useCallback } from "react";
import { API_URL } from "../shared/constants";

const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const [cache, setCache] = useState({
    personal: { data: null, timestamp: 0 },
    vehiculos: { data: null, timestamp: 0 },
    referencias: { data: null, timestamp: 0 },
    ordenes: { data: null, timestamp: 0 },
    stats: { data: null, timestamp: 0 },
  });

  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

  /**
   * Obtener datos con caché automático
   * @param {string} key - Clave del caché (personal, vehiculos, etc)
   * @param {string} endpoint - Endpoint de la API (/personal, /vehiculos, etc)
   * @returns {Promise<any>} Datos del endpoint
   */
  const getData = useCallback(async (key, endpoint) => {
    const now = Date.now();
    const cached = cache[key];

    // Si hay caché válido, retornar inmediatamente
    if (cached.data && (now - cached.timestamp) < CACHE_DURATION) {
      console.log(`✓ Caché HIT: ${key} (${Math.round((now - cached.timestamp) / 1000)}s)`);
      return cached.data;
    }

    // Si no hay caché válido, hacer fetch
    console.log(`↻ Caché MISS: ${key} - Cargando desde servidor...`);
    
    try {
      const response = await fetch(`${API_URL}${endpoint}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      // Guardar en caché
      setCache(prev => ({
        ...prev,
        [key]: { data, timestamp: now }
      }));

      console.log(`✓ ${key} cargado y cacheado`);
      return data;
      
    } catch (error) {
      console.error(`❌ Error cargando ${key}:`, error);
      
      // Si falla pero hay caché viejo, usarlo
      if (cached.data) {
        console.log(`⚠️ Usando caché antiguo de ${key}`);
        return cached.data;
      }
      
      // Si no hay nada, retornar array vacío
      return [];
    }
  }, [cache]);

  /**
   * Invalidar caché de una clave específica
   * Usar después de crear/actualizar/eliminar datos
   */
  const invalidateCache = useCallback((key) => {
    console.log(`✗ Invalidando caché: ${key}`);
    setCache(prev => ({
      ...prev,
      [key]: { data: null, timestamp: 0 }
    }));
  }, []);

  /**
   * Invalidar todo el caché
   * Usar en logout o refresh manual
   */
  const invalidateAll = useCallback(() => {
    console.log("✗ Invalidando TODO el caché");
    setCache({
      personal: { data: null, timestamp: 0 },
      vehiculos: { data: null, timestamp: 0 },
      referencias: { data: null, timestamp: 0 },
      ordenes: { data: null, timestamp: 0 },
      stats: { data: null, timestamp: 0 },
    });
  }, []);

  /**
   * Obtener estado del caché (para debugging)
   */
  const getCacheStatus = useCallback(() => {
    const now = Date.now();
    const status = {};
    
    Object.keys(cache).forEach(key => {
      const item = cache[key];
      status[key] = {
        cached: !!item.data,
        age: item.data ? Math.round((now - item.timestamp) / 1000) + 's' : 'N/A',
        valid: item.data && (now - item.timestamp) < CACHE_DURATION
      };
    });
    
    return status;
  }, [cache]);

  const value = {
    getData,
    invalidateCache,
    invalidateAll,
    getCacheStatus
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};

/**
 * Hook para usar el sistema de caché
 * 
 * Ejemplo de uso:
 * 
 * const { getData, invalidateCache } = useData();
 * 
 * // Cargar datos (usa caché automáticamente)
 * const personal = await getData("personal", "/personal");
 * 
 * // Después de guardar/editar:
 * invalidateCache("personal");
 */
export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error("useData debe usarse dentro de DataProvider");
  }
  return context;
};

export default DataContext;
