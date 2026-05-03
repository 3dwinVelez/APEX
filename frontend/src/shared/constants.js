export const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

export const C = {
  dark:      "#111111",
  accent:    "#2563EB",
  success:   "#06D6A0",
  warning:   "#F59E0B",
  danger:    "#EF4444",
  bg:        "#F3F4F6",
  card:      "#FFFFFF",
  border:    "#E5E7EB",
  text:      "#111111",
  muted:     "#6B7280",
  brand:     "#2563EB",
  brandDark: "#1D4ED8",
};

export const getAuthHeaders = () => ({
  "Content-Type": "application/json",
  "Authorization": "Bearer " + (sessionStorage.getItem("apex_token") || "")
});
