import { useState, useEffect } from "react";
import { API_URL } from "./constants";

const useGPSTracking = (user, intervaloMin = 5) => {
  const [posicion, setPosicion] = useState(null);
  const [gpsError, setGpsError] = useState(null);
  const [gpsActivo, setGpsActivo] = useState(false);

  const enviarPing = (coords) => {
    if (!user) return;
    fetch(`${API_URL}/gps/ping`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: user.username || user.user,
        nombre: user.nombre || user.username,
        lat: coords.latitude,
        lng: coords.longitude,
        precision: coords.accuracy
      })
    }).catch(() => {});
  };

  useEffect(() => {
    if (!navigator.geolocation) { setGpsError("GPS no disponible"); return; }
    setGpsActivo(true);
    // Ping inmediato
    navigator.geolocation.getCurrentPosition(
      pos => { setPosicion(pos.coords); enviarPing(pos.coords); setGpsError(null); },
      err => { setGpsError("Permiso GPS denegado"); setGpsActivo(false); }
    );
    // Ping cada N minutos
    const iv = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        pos => { setPosicion(pos.coords); enviarPing(pos.coords); setGpsError(null); },
        () => {}
      );
    }, intervaloMin * 60 * 1000);
    return () => clearInterval(iv);
  }, [user?.username]);

  return { posicion, gpsError, gpsActivo };
};

export { useGPSTracking };
