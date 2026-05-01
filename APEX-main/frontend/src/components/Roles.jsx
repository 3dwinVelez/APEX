import { useEffect, useMemo, useState } from "react";
import { API_URL, C } from "../shared/constants";
import { Card, Btn, Input, PageHeader, Toast } from "../shared/ui";
import {
  ACTION_LABELS,
  PERMISSION_CATALOG,
  can,
  emptyPermissions,
  normalizePermissions,
} from "../shared/permissions";

const tabStyle = (active) => ({
  padding: "8px 16px",
  borderRadius: 10,
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 700,
  background: active ? C.dark : C.bg,
  color: active ? "#fff" : C.muted,
  border: `1px solid ${active ? C.dark : C.border}`,
});

const RoleMatrix = ({ permissions, onToggle, disabled }) => (
  <div style={{ display: "grid", gap: 12 }}>
    {PERMISSION_CATALOG.map((moduleItem) => (
      <Card key={moduleItem.key} style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12, alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>{moduleItem.label}</div>
            <div style={{ fontSize: 11, color: C.muted }}>{moduleItem.key}</div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          {moduleItem.actions.map((action) => {
            const checked = Boolean(permissions?.[moduleItem.key]?.[action]);
            return (
              <label
                key={action}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: checked ? `${C.accent}12` : C.bg,
                  border: `1px solid ${checked ? `${C.accent}40` : C.border}`,
                  opacity: disabled ? 0.7 : 1,
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => onToggle(moduleItem.key, action)}
                />
                <span style={{ fontSize: 12, fontWeight: 700 }}>{ACTION_LABELS[action] || action}</span>
              </label>
            );
          })}
        </div>
      </Card>
    ))}
  </div>
);

const Roles = ({ onBack, user }) => {
  const [tab, setTab] = useState("perfiles");
  const [roles, setRoles] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [editingRole, setEditingRole] = useState(null);
  const [saving, setSaving] = useState(false);
  const [roleForm, setRoleForm] = useState({
    nombre: "",
    descripcion: "",
    activo: true,
    permissions: emptyPermissions(),
  });

  const canCreateRoles = can(user, "roles", "create");
  const canEditRoles = can(user, "roles", "edit");
  const canViewRoles = can(user, "roles", "view");

  const cargar = async () => {
    setLoading(true);
    try {
      const [rolesResp, usersResp] = await Promise.all([
        fetch(`${API_URL}/roles`).then((r) => r.json()),
        fetch(`${API_URL}/personal`).then((r) => r.json()),
      ]);
      setRoles(Array.isArray(rolesResp) ? rolesResp : []);
      setUsuarios(Array.isArray(usersResp) ? usersResp : []);
    } catch {
      setRoles([]);
      setUsuarios([]);
      setToast({ msg: "No se pudieron cargar roles o usuarios", type: "error" });
    }
    setLoading(false);
  };

  useEffect(() => {
    if (canViewRoles) cargar();
  }, [canViewRoles]);

  const roleOptions = useMemo(
    () => roles.filter((role) => role.activo).map((role) => ({ value: String(role.id), label: role.nombre })),
    [roles]
  );

  const resetForm = () => {
    setEditingRole(null);
    setRoleForm({
      nombre: "",
      descripcion: "",
      activo: true,
      permissions: emptyPermissions(),
    });
  };

  const startCreate = (baseRole) => {
    if (!canCreateRoles) return;
    if (baseRole) {
      setEditingRole(null);
      setRoleForm({
        nombre: `${baseRole.nombre} copia`,
        descripcion: baseRole.descripcion || "",
        activo: true,
        permissions: normalizePermissions(baseRole.permissions),
      });
      return;
    }
    resetForm();
  };

  const startEdit = (role) => {
    if (!canEditRoles) return;
    setEditingRole(role);
    setRoleForm({
      nombre: role.nombre || "",
      descripcion: role.descripcion || "",
      activo: role.activo !== false,
      permissions: normalizePermissions(role.permissions),
    });
  };

  const togglePermission = (moduleKey, action) => {
    setRoleForm((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [moduleKey]: {
          ...prev.permissions[moduleKey],
          [action]: !prev.permissions[moduleKey][action],
        },
      },
    }));
  };

  const guardarRol = async () => {
    if (!roleForm.nombre.trim()) {
      setToast({ msg: "El nombre del rol es obligatorio", type: "error" });
      return;
    }

    setSaving(true);
    try {
      const url = editingRole ? `${API_URL}/roles/${editingRole.id}` : `${API_URL}/roles`;
      const method = editingRole ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: roleForm.nombre.trim(),
          descripcion: roleForm.descripcion.trim(),
          activo: roleForm.activo,
          permissions: roleForm.permissions,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || "No se pudo guardar el rol");
      }
      setToast({ msg: editingRole ? "Rol actualizado" : "Rol creado", type: "success" });
      resetForm();
      cargar();
    } catch (error) {
      setToast({ msg: error.message || "Error guardando rol", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const toggleEstadoRol = async (role) => {
    if (!canEditRoles) return;
    try {
      const res = await fetch(`${API_URL}/roles/${role.id}/estado?activo=${!role.activo}`, { method: "PATCH" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "No se pudo cambiar el estado");
      setToast({ msg: `${role.nombre} ${role.activo ? "desactivado" : "activado"}`, type: "success" });
      cargar();
    } catch (error) {
      setToast({ msg: error.message || "Error actualizando estado", type: "error" });
    }
  };

  const asignarRol = async (userId, roleId) => {
    try {
      const res = await fetch(`${API_URL}/personal/${userId}/rol?role_id=${roleId}`, { method: "PATCH" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "No se pudo asignar el rol");
      setToast({ msg: "Rol asignado correctamente", type: "success" });
      cargar();
    } catch (error) {
      setToast({ msg: error.message || "Error asignando rol", type: "error" });
    }
  };

  if (!canViewRoles) {
    return (
      <div>
        <PageHeader title="Roles y Perfiles" onBack={onBack} />
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>No tienes acceso a este modulo</div>
          <div style={{ color: C.muted, fontSize: 13 }}>
            Pide a un administrador que te otorgue permisos de acceso o gestion de roles.
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <PageHeader
        title="Roles y Perfiles"
        subtitle="Controla acceso por modulo y por accion"
        onBack={onBack}
        action={
          <Btn onClick={cargar} variant="ghost" disabled={loading}>
            {loading ? "CARGANDO..." : "RECARGAR"}
          </Btn>
        }
      />

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <div style={tabStyle(tab === "perfiles")} onClick={() => setTab("perfiles")}>Perfiles</div>
        <div style={tabStyle(tab === "asignaciones")} onClick={() => setTab("asignaciones")}>Asignaciones</div>
      </div>

      {tab === "perfiles" && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 420px) minmax(380px, 1fr)", gap: 18, alignItems: "start" }}>
          <div style={{ display: "grid", gap: 14 }}>
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>Perfiles disponibles</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{roles.length} perfiles registrados</div>
                </div>
                {canCreateRoles && (
                  <Btn onClick={() => startCreate()} variant="ghost">NUEVO PERFIL</Btn>
                )}
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {roles.map((role) => (
                  <div
                    key={role.id}
                    style={{
                      padding: 14,
                      borderRadius: 12,
                      background: editingRole?.id === role.id ? `${C.accent}10` : C.bg,
                      border: `1px solid ${editingRole?.id === role.id ? `${C.accent}35` : C.border}`,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontWeight: 800 }}>{role.nombre}</div>
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{role.descripcion || "Sin descripcion"}</div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                          <span style={{
                            padding: "3px 8px",
                            borderRadius: 20,
                            fontSize: 10,
                            fontWeight: 700,
                            background: role.activo ? "#06D6A015" : "#EF444415",
                            color: role.activo ? "#06D6A0" : "#EF4444",
                          }}>
                            {role.activo ? "ACTIVO" : "INACTIVO"}
                          </span>
                          {role.es_sistema && (
                            <span style={{
                              padding: "3px 8px",
                              borderRadius: 20,
                              fontSize: 10,
                              fontWeight: 700,
                              background: "#0D1B2A12",
                              color: C.dark,
                            }}>
                              SISTEMA
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                      {canCreateRoles && <Btn variant="ghost" onClick={() => startCreate(role)}>CLONAR</Btn>}
                      {canEditRoles && <Btn onClick={() => startEdit(role)}>EDITAR</Btn>}
                      {canEditRoles && (
                        <Btn variant="ghost" onClick={() => toggleEstadoRol(role)}>
                          {role.activo ? "DESACTIVAR" : "ACTIVAR"}
                        </Btn>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            <Card>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>
                {editingRole ? `Editar perfil: ${editingRole.nombre}` : "Nuevo perfil"}
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 18 }}>
                Configura exactamente lo que ese perfil puede ver, editar, crear o exportar.
              </div>

              <Input
                label="NOMBRE DEL PERFIL"
                value={roleForm.nombre}
                onChange={(value) => setRoleForm((prev) => ({ ...prev, nombre: value }))}
                placeholder="Ej: Coordinador de reportes"
              />

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1, marginBottom: 6 }}>
                  DESCRIPCION
                </div>
                <textarea
                  value={roleForm.descripcion}
                  onChange={(event) => setRoleForm((prev) => ({ ...prev, descripcion: event.target.value }))}
                  placeholder="Explica para que sirve este perfil"
                  style={{
                    width: "100%",
                    minHeight: 78,
                    padding: "11px 14px",
                    borderRadius: 10,
                    fontSize: 14,
                    border: `1px solid ${C.border}`,
                    background: "#FAFBFD",
                    outline: "none",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                    color: C.text,
                    resize: "vertical",
                  }}
                />
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, fontSize: 13, fontWeight: 700 }}>
                <input
                  type="checkbox"
                  checked={roleForm.activo}
                  onChange={(event) => setRoleForm((prev) => ({ ...prev, activo: event.target.checked }))}
                />
                Perfil activo
              </label>

              <RoleMatrix
                permissions={roleForm.permissions}
                onToggle={togglePermission}
                disabled={!(canCreateRoles || canEditRoles)}
              />

              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <Btn onClick={guardarRol} disabled={saving || !(canCreateRoles || canEditRoles)}>
                  {saving ? "GUARDANDO..." : editingRole ? "GUARDAR CAMBIOS" : "CREAR PERFIL"}
                </Btn>
                <Btn variant="ghost" onClick={resetForm}>LIMPIAR</Btn>
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === "asignaciones" && (
        <Card>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>Asignar perfiles a usuarios</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 18 }}>
            Crea el usuario desde Personal y luego asígnale aquí el perfil exacto que quieras probar.
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {usuarios.map((usuario) => (
              <div
                key={usuario.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(180px, 1.4fr) minmax(160px, 1fr) minmax(220px, 1.4fr) auto",
                  gap: 12,
                  alignItems: "center",
                  padding: 14,
                  borderRadius: 12,
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                }}
              >
                <div>
                  <div style={{ fontWeight: 800 }}>{usuario.nombre}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{usuario.username} • {usuario.id_interno}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: C.muted, fontWeight: 700 }}>PERFIL ACTUAL</div>
                  <div style={{ fontWeight: 700 }}>{usuario.role_nombre || usuario.rol || "Sin perfil"}</div>
                </div>
                <select
                  defaultValue={usuario.role_id ? String(usuario.role_id) : ""}
                  onChange={(event) => {
                    if (event.target.value) {
                      asignarRol(usuario.id, event.target.value);
                    }
                  }}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: `1px solid ${C.border}`,
                    background: "#fff",
                    fontFamily: "inherit",
                    fontSize: 13,
                  }}
                >
                  <option value="">Selecciona un perfil</option>
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <div style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: usuario.activo === false ? "#EF4444" : "#06D6A0",
                }}>
                  {usuario.activo === false ? "INACTIVO" : "ACTIVO"}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default Roles;
