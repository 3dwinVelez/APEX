# Sistema de Agentes IA — APEX ERP

> Documento de referencia para el equipo de desarrollo.  
> Última actualización: Mayo 2026

---

## ¿Qué es esto?

Es un equipo de agentes de inteligencia artificial construido específicamente para el proyecto APEX. Su propósito es asistir al equipo de desarrollo en la implementación de cambios: analizando riesgos, generando especificaciones técnicas, validando código y documentando cada decisión.

Los agentes **no reemplazan al líder del equipo** — cada transición importante requiere aprobación humana. El sistema está diseñado para amplificar la capacidad del equipo, no para operar de forma autónoma.

---

## Archivos del sistema

Todos los archivos viven en `agents/` dentro del repositorio:

```
agents/
├── orchestrator.py        # Coordina el flujo completo
├── advisors.py            # Orientadores de impacto y alternativas
├── interpreter.py         # Convierte solicitudes en specs técnicas
├── validator.py           # Audita el código en 3 capas
├── architect.py           # Documenta cambios y actualiza la memoria
├── memory/
│   ├── ingest.py          # Ingesta documentos a ChromaDB
│   └── chroma_db/         # Base de datos vectorial (memoria del sistema)
```

Y la base de conocimiento en `apex-knowledge/`:

```
apex-knowledge/
├── 00-maestro/            # Documento maestro de APEX
├── 06-estado-actual/
│   └── registros/         # Historial de cambios documentados
```

---

## Función de cada agente

### Orquestador (`orchestrator.py`)
Coordina el flujo completo de principio a fin. Recibe la solicitud del líder, invoca a cada agente en el orden correcto y pausa para pedir aprobación humana en los puntos clave. Es el punto de entrada del sistema.

### Orientadores (`advisors.py`)
Contiene dos agentes que piensan antes de actuar:

- **Orientador de Impacto**: Analiza qué módulos, archivos y funcionalidades podrían verse afectados por el cambio solicitado. Identifica riesgos técnicos y de negocio.
- **Orientador de Alternativas**: Propone 2-3 formas distintas de implementar la solicitud, con sus ventajas y desventajas. Permite al líder elegir el enfoque más adecuado.

### Intérprete (`interpreter.py`)
Transforma una solicitud en lenguaje natural en una especificación técnica estructurada. Incluye: archivos a crear o modificar, convenciones a respetar, criterios de éxito y preguntas de aclaración si la solicitud es ambigua.

### Validador (`validator.py`)
Audita el código implementado en tres capas:

1. **Sintaxis**: Verifica que el código esté bien formado y siga las convenciones del proyecto.
2. **Integración**: Comprueba compatibilidad con los módulos existentes de APEX.
3. **Negocio**: Valida que se cumplan las reglas de negocio documentadas (soft delete, permisos, Tailwind, etc.).

Si detecta problemas, los describe con instrucciones específicas para corregirlos. Después de 3 intentos fallidos escala al líder.

### Arquitecto (`architect.py`)
Documenta cada cambio aprobado: qué se solicitó, qué decisión técnica se tomó, qué archivos se afectaron y qué deben saber los agentes en el futuro. Guarda el registro en `apex-knowledge/06-estado-actual/registros/` y actualiza la memoria vectorial (ChromaDB) para que el contexto persista entre sesiones.

---

## Reglas que los agentes conocen y respetan

Estas reglas están documentadas en `apex-knowledge/00-maestro/apex-documento-maestro.md` y los agentes las consultan en cada operación:

- **Nunca eliminar registros físicamente** — siempre soft delete
- **No modificar `permissions.js`** sin aprobación explícita del líder
- **No cambiar `DataContext.jsx`** sin evaluar impacto global
- **Solo Tailwind CSS** — sin estilos inline ni CSS custom
- **No hardcodear URLs ni credenciales**
- **Verificar `shared/ui.jsx`** antes de crear componentes nuevos
- **Formato ISO 8601** para todas las fechas

---

## Guía de uso

### Requisitos previos

1. Tener Python 3.11 instalado
2. Tener la variable de entorno `ANTHROPIC_API_KEY` configurada:
   ```cmd
   setx ANTHROPIC_API_KEY sk-ant-xxxxxxxx
   ```
   *(Reiniciar la terminal después de ejecutar este comando)*

### Activar el entorno

```cmd
cd C:\Users\pc\Documents\2026\APEX\agents
venv\Scripts\activate
```

Verás `(venv)` al inicio de la línea de comandos cuando esté activo.

### Ejecutar el sistema completo

```cmd
python orchestrator.py "descripción de lo que necesitas implementar"
```

**Ejemplo:**
```cmd
python orchestrator.py "Agregar filtro por rango de fechas al módulo de Reportes"
```

### Flujo que verás en pantalla

```
🔍 Orientadores analizando la solicitud...
   → Módulos afectados: Reportes, shared/hooks.jsx ...
   → Alternativas sugeridas: ...

¿Deseas continuar con esta solicitud? (s/n): s

📋 Intérprete generando spec técnica...
   → Archivos a modificar: ...
   → Convenciones: ...

¿Apruebas la spec técnica? (s/n): s

[Aquí pegas el código implementado]

✅ Validador auditando el código...
   → Capa 1 - Sintaxis: OK
   → Capa 2 - Integración: OK
   → Capa 3 - Negocio: OK

¿Apruebas el código para documentar? (s/n): s

📐 Arquitecto generando documentación...
   ✅ Registro guardado en apex-knowledge/06-estado-actual/registros/
   ✅ Memoria vectorial actualizada
```

### Ejecutar agentes individuales

Si solo necesitas un agente específico:

```cmd
# Solo el intérprete (generar spec técnica)
python interpreter.py

# Solo el validador (auditar código existente)
python validator.py

# Actualizar la memoria con nuevos documentos
python memory/ingest.py
```

### Actualizar la base de conocimiento

Cuando documentes nuevos módulos o reglas de negocio, agrégalos en `apex-knowledge/` y luego ejecuta:

```cmd
python memory/ingest.py
```

Esto indexa los nuevos documentos en ChromaDB para que todos los agentes tengan acceso al contexto actualizado.

---

## Pendientes de desarrollo

| Tarea | Estado | Descripción |
|-------|--------|-------------|
| Agente Coder real | ⏳ Pendiente | Actualmente el código se ingresa manualmente; el Coder llamará a la API de Claude para generarlo automáticamente |
| Validador por archivo | ⏳ Pendiente | El validador actual evalúa el conjunto completo; debe ajustarse para evaluar archivos individuales |
| Interfaz web | ⏳ Pendiente | Panel Next.js con WebSocket para visualizar el flujo en tiempo real |
| Base de conocimiento | ⏳ En progreso | Documentar módulos específicos en `03-modulos/` y `04-reglas/` |

---

## Costos estimados

El sistema usa la **API de Anthropic** para ejecutar los agentes. Con Claude Haiku (el modelo más económico):

- Costo aproximado por consulta completa: $0.001 — $0.003 USD
- Presupuesto sugerido para pruebas iniciales: $5 USD

La sesión de diseño y construcción del sistema se realizó en **Claude.ai Pro ($20/mes)**, sin consumir créditos de API.

---

## Contacto y contribución

Este sistema fue diseñado e implementado en Mayo 2026 como parte de la infraestructura de desarrollo de APEX. Para agregar nuevas reglas de negocio o expandir las capacidades de los agentes, actualizar el documento maestro en `apex-knowledge/00-maestro/` y ejecutar `memory/ingest.py`.
