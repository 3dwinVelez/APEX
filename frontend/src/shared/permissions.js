export const PERMISSION_CATALOG = [
  {
    key: "dashboard",
    label: "Dashboard",
    actions: ["access", "view"],
  },
  {
    key: "personal",
    label: "Personal",
    actions: ["access", "view", "create", "edit"],
  },
  {
    key: "roles",
    label: "Roles y Perfiles",
    actions: ["access", "view", "create", "edit"],
  },
  {
    key: "servicios",
    label: "Servicios",
    actions: ["access", "view", "create", "edit", "export"],
  },
  {
    key: "horarios",
    label: "Horarios",
    actions: ["access", "view", "create", "edit", "approve"],
  },
  {
    key: "vehiculos",
    label: "Vehiculos",
    actions: ["access", "view", "create", "edit"],
  },
  {
    key: "referencias",
    label: "Referencias",
    actions: ["access", "view", "create", "edit"],
  },
  {
    key: "reportes",
    label: "Reportes",
    actions: ["access", "view", "export"],
  },
  {
    key: "configuracion",
    label: "Configuracion",
    actions: ["access", "view", "create", "edit"],
  },
  {
    key: "nomina",
    label: "Nomina",
    actions: ["access", "view", "create", "edit", "export"],
  },
];

export const ACTION_LABELS = {
  access: "Entrar al modulo",
  view: "Ver informacion",
  create: "Crear registros",
  edit: "Editar registros",
  export: "Descargar / exportar",
  approve: "Aprobar / cerrar",
};

export function emptyPermissions() {
  const result = {};
  PERMISSION_CATALOG.forEach((moduleItem) => {
    result[moduleItem.key] = {};
    moduleItem.actions.forEach((action) => {
      result[moduleItem.key][action] = false;
    });
  });
  return result;
}

export function fullPermissions() {
  const result = emptyPermissions();
  Object.keys(result).forEach((moduleKey) => {
    Object.keys(result[moduleKey]).forEach((action) => {
      result[moduleKey][action] = true;
    });
  });
  return result;
}

export function normalizePermissions(raw) {
  const base = emptyPermissions();
  if (!raw || typeof raw !== "object") return base;

  Object.keys(base).forEach((moduleKey) => {
    const moduleValue = raw[moduleKey];
    if (!moduleValue || typeof moduleValue !== "object") return;
    Object.keys(base[moduleKey]).forEach((action) => {
      base[moduleKey][action] = Boolean(moduleValue[action]);
    });
  });

  return base;
}

export function can(user, moduleKey, action = "access") {
  if (!user) return false;
  const perms = normalizePermissions(user.permissions);
  return Boolean(perms?.[moduleKey]?.[action]);
}

export function firstAllowedPage(user) {
  const preferred = ["dashboard", "servicios", "horarios", "vehiculos", "personal", "referencias", "configuracion", "nomina", "reportes", "roles"];
  return preferred.find((page) => can(user, page, "access")) || "dashboard";
}
