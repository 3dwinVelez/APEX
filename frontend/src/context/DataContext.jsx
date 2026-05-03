import { createContext, useContext, useState, useCallback, useRef } from "react";
import { API_URL } from "../shared/constants";

const DataContext = createContext();

const CACHE_DURATION = 5 * 60 * 1000;

export const DataProvider = ({ children }) => {
  const cacheRef = useRef({
    personal:    { data: null, timestamp: 0 },
    vehiculos:   { data: null, timestamp: 0 },
    referencias: { data: null, timestamp: 0 },
    ordenes:     { data: null, timestamp: 0 },
    stats:       { data: null, timestamp: 0 },
  });

  const pendingRef = useRef({});
  const [, forceUpdate] = useState(0);

  const getData = useCallback(async (key, endpoint) => {
    const now = Date.now();
    const cached = cacheRef.current[key];

    if (cached?.data && (now - cached.timestamp) < CACHE_DURATION) {
      return cached.data;
    }

    // Deduplicar requests simultaneos al mismo endpoint
    if (pendingRef.current[key]) {
      return pendingRef.current[key];
    }

    const token = sessionStorage.getItem("apex_token") || "";
    const promise = fetch(`${API_URL}${endpoint}`, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        cacheRef.current[key] = { data, timestamp: Date.now() };
        delete pendingRef.current[key];
        return data;
      })
      .catch(error => {
        delete pendingRef.current[key];
        if (cacheRef.current[key]?.data) return cacheRef.current[key].data;
        return [];
      });

    pendingRef.current[key] = promise;
    return promise;
  }, []);

  const invalidateCache = useCallback((key) => {
    if (key) {
      cacheRef.current[key] = { data: null, timestamp: 0 };
    }
  }, []);

  const invalidateAll = useCallback(() => {
    Object.keys(cacheRef.current).forEach(key => {
      cacheRef.current[key] = { data: null, timestamp: 0 };
    });
    forceUpdate(n => n + 1);
  }, []);

  return (
    <DataContext.Provider value={{ getData, invalidateCache, invalidateAll }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData debe usarse dentro de DataProvider");
  return context;
};

export default DataContext;
