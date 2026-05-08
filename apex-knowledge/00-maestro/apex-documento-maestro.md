---
tipo: maestro
version: 1.0
fecha: 2026-05
estado: activo
autor: creado con supervisión humana
---

# APEX — Documento Maestro

## ¿Qué es APEX?

APEX es un ERP SaaS en desarrollo activo orientado a gestionar los procesos operativos completos de una empresa. Centraliza módulos de RRHH, logística, contabilidad, ventas y configuración en una sola plataforma web multiempresa.

## ¿Qué NO es APEX?

- No es una app móvil nativa
- No es un sistema de contabilidad standalone
- No es un CRM independiente
- No reemplaza SAP ni sistemas ERP legacy — es una alternativa SaaS propia

## Estado actual del proyecto

- Fase de migración: el frontend está migrando de React (CRA) a Next.js + TypeScript
- El backend FastAPI está estable y continúa con la misma tecnología
- Los módulos actuales son MVP funcionales para una empresa piloto
- La base de código React existente es la referencia de comportamiento y lógica de negocio

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js + TypeScript + Tailwind CSS |
| Backend | FastAPI (Python) |
| Base de datos | PostgreSQL |
| Estado global | Context API (DataContext) |
| Autenticación | Por definir en migración |

## Módulos existentes (MVP actual)

Todos los módulos actuales viven en `/src/components/`:

| Módulo | Archivo | Dominio |
|--------|---------|---------|
| Dashboard | `Dashboard.jsx` | Vista principal / resumen |
| Personal | `Personal.jsx` | RRHH — gestión de empleados |
| Marcaciones | Sin archivo propio visible — lógica en componentes | RRHH — control de asistencia |
| Horarios | `Horarios.jsx` | RRHH — gestión de turnos |
| Nómina | `Nomina.jsx` + `ConfiguracionNomina.jsx` | RRHH — liquidación de salarios |
| Servicios | `Servicios.jsx` | Logística — gestión de servicios |
| Referencias | `Referencias.jsx` | Logística — referencias de operación |
| Vehículos | `Vehiculos.jsx` | Logística — flota vehicular |
| Mapa Operarios | `MapaOperarios.jsx` | Logística — ubicación en tiempo real |
| Reportes | `Reportes.jsx` | Reportería transversal |
| Roles | `Roles.jsx` | Configuración — roles de usuario |
| Firma Digital | `FirmaDigital.jsx` | Utilidad — firma electrónica |
| Captura Foto | `CapturaFoto.jsx` | Utilidad — captura de imágenes |

## Arquitectura del frontend actual (React)

```
src/
├── App.js                    ← Router principal
├── index.js                  ← Entry point
├── assets/                   ← Imágenes y logos
├── components/               ← Módulos de negocio (uno por archivo)
├── context/
│   └── DataContext.jsx        ← Estado global compartido
└── shared/
    ├── constants.js           ← Constantes globales
    ├── hooks.jsx              ← Hooks reutilizables
    ├── permissions.js         ← Lógica de permisos
    ├── Skeleton.jsx           ← Componente de carga
    └── ui.jsx                 ← Componentes UI base
```

## Arquitectura objetivo (Next.js + TypeScript)

La migración debe respetar la lógica de negocio existente y traducirla a:

```
/
├── app/                      ← App Router de Next.js
│   ├── (dashboard)/          ← Rutas protegidas
│   │   ├── personal/
│   │   ├── servicios/
│   │   ├── nomina/
│   │   └── ...
│   └── layout.tsx
├── components/               ← Componentes reutilizables
├── lib/                      ← Utilidades, helpers
├── context/                  ← Context providers
├── hooks/                    ← Custom hooks
├── types/                    ← Tipos TypeScript
└── public/                   ← Assets estáticos
```

## Shared — recursos transversales

| Archivo | Propósito |
|---------|-----------|
| `constants.js` | Valores fijos usados en todo el sistema (URLs, códigos, etc.) |
| `hooks.jsx` | Hooks personalizados reutilizables entre módulos |
| `permissions.js` | Definición y validación de permisos por rol |
| `Skeleton.jsx` | Estado de carga visual estándar |
| `ui.jsx` | Componentes base de interfaz reutilizables |

## Reglas de negocio — mejores prácticas aplicadas a APEX

### Integridad de datos
- Nunca eliminar registros físicamente — siempre usar soft delete (campo `activo`, `estado` o `deleted_at`)
- Toda transacción o cambio de estado debe quedar registrado con fecha, hora y usuario responsable
- Los datos de nómina y marcaciones son inmutables una vez cerrado el período

### Permisos y roles
- El módulo `permissions.js` es la fuente de verdad para control de acceso
- Ningún módulo debe implementar lógica de permisos propia — siempre usar el shared
- Los roles se gestionan desde el módulo `Roles.jsx`

### Consistencia de UI
- Usar siempre `Skeleton.jsx` para estados de carga
- Usar siempre los componentes de `ui.jsx` para elementos base (botones, inputs, modales)
- Tailwind CSS es el único sistema de estilos — no usar CSS inline ni módulos CSS propios

### API y backend
- Todas las llamadas al backend van a través de FastAPI
- Las URLs base están definidas en `constants.js` — nunca hardcodear endpoints
- El DataContext es el canal de comunicación de estado global — no duplicar estado local que ya existe ahí

### Migración React → Next.js
- Mantener la lógica de negocio intacta — solo cambiar la capa de presentación y routing
- Los hooks de `shared/hooks.jsx` deben ser compatibles con Next.js (sin `window` en SSR)
- Cada módulo migrado debe tener su propia carpeta en `/app/`

## Lo que un agente NUNCA debe hacer en APEX

1. Eliminar físicamente registros de la base de datos
2. Modificar `permissions.js` sin instrucción explícita y aprobación humana
3. Cambiar la estructura del `DataContext` sin evaluar impacto en todos los módulos
4. Crear estilos fuera de Tailwind CSS
5. Hardcodear URLs, credenciales o valores que deberían estar en `constants.js` o variables de entorno
6. Crear un componente nuevo sin verificar si ya existe uno en `shared/ui.jsx`
7. Modificar lógica de nómina o marcaciones sin validación explícita del líder
8. Romper compatibilidad con el backend FastAPI existente sin una spec técnica aprobada

## Personas involucradas

| Rol | Responsabilidad |
|-----|----------------|
| Líder del proyecto | Aprueba todos los cambios antes de aplicarlos. Punto de control humano en cada fase |
| Equipo de desarrollo | 1-2 personas adicionales colaborando en el proyecto |

## Empresa piloto actual

El MVP está funcionando para una empresa real. Cualquier cambio en módulos activos (Marcaciones, Servicios, Referencias, Roles) debe ser evaluado con mayor cuidado por el impacto en producción.

## Pendientes conocidos (fase actual)

- Migración de React CRA a Next.js + TypeScript (en curso)
- Estabilización del ecosistema tras la migración
- Módulos adicionales por desarrollar (definidos en fases futuras)
- Integración de autenticación en la nueva arquitectura Next.js

## Historial de decisiones

| Fecha | Decisión | Razón |
|-------|----------|-------|
| 2026-05 | Migrar frontend de React a Next.js + TypeScript | Mejor rendimiento, SSR, tipado estricto y alineación con el ecosistema moderno |
| 2026-05 | Mantener FastAPI como backend | Estable, funcional, compatible con PostgreSQL y el equipo lo domina |
| 2026-05 | Iniciar sistema de agentes de IA para APEX | Automatizar desarrollo con supervisión humana, preservar memoria institucional |
