"""
APEX — Agentes de Orientación
Orientador de Impacto: analiza qué puede romperse antes de ejecutar.
Orientador de Alternativas: sugiere mejores formas de lograr lo solicitado.
Siempre reportan al humano ANTES de activar los agentes operativos.
"""

import os
import chromadb
from pathlib import Path
from anthropic import Anthropic

# ── Configuración ──────────────────────────────────────────────────────────────

CHROMA_DIR = Path(__file__).parent / "memory" / "chroma_db"
COLLECTION  = "apex_knowledge"
APEX_MODEL  = "claude-haiku-4-5-20251001"

# ── Clientes ───────────────────────────────────────────────────────────────────

anthropic  = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
chroma     = chromadb.PersistentClient(path=str(CHROMA_DIR))
collection = chroma.get_collection(COLLECTION)

# ── Memoria ────────────────────────────────────────────────────────────────────

def consultar_memoria(query: str, n_results: int = 4) -> str:
    results = collection.query(query_texts=[query], n_results=n_results)
    fragmentos = []
    for doc, meta in zip(results["documents"][0], results["metadatas"][0]):
        fragmentos.append(f"[{meta['tipo'].upper()}]\n{doc}")
    return "\n\n---\n\n".join(fragmentos)

# ══════════════════════════════════════════════════════════════════════════════
# ORIENTADOR DE IMPACTO
# ══════════════════════════════════════════════════════════════════════════════

SYSTEM_IMPACTO = """Eres el Agente Orientador de Impacto del equipo de desarrollo de APEX.

Tu trabajo es analizar una solicitud ANTES de ejecutarla e identificar qué puede verse afectado.

Analiza con base en el contexto de APEX:
- ¿Qué módulos existentes pueden verse afectados?
- ¿Qué archivos compartidos (hooks, context, permissions, ui) pueden verse impactados?
- ¿Hay dependencias entre módulos que puedan romperse?
- ¿El cambio afecta datos críticos (nómina, marcaciones)?
- ¿Cuál es el nivel de riesgo general?

FORMATO DE RESPUESTA OBLIGATORIO:

---
## REPORTE DE IMPACTO

**Solicitud analizada:** [solicitud resumida]
**Riesgo general:** 🟢 BAJO / 🟡 MEDIO / 🔴 ALTO
**¿Es bloqueante?:** SÍ / NO

### Módulos afectados
| Módulo | Nivel de impacto | Descripción |
|--------|-----------------|-------------|
| [módulo] | Alto/Medio/Bajo | [qué puede verse afectado] |

### Archivos en riesgo
- [archivo] — [razón del riesgo]

### Dependencias críticas identificadas
- [dependencia] — [por qué importa]

### Recomendación
[En 2-3 líneas, qué tener en cuenta antes de proceder]
---
"""

def analizar_impacto(solicitud: str) -> str:
    """Analiza el impacto de una solicitud antes de ejecutarla."""
    print("\n🔍 Orientador de Impacto — Analizando riesgos...")

    contexto = consultar_memoria(solicitud)

    mensaje = f"""SOLICITUD A ANALIZAR:
{solicitud}

CONTEXTO DE APEX:
{contexto}

Analiza el impacto potencial de esta solicitud."""

    response = anthropic.messages.create(
        model=APEX_MODEL,
        max_tokens=1000,
        system=SYSTEM_IMPACTO,
        messages=[{"role": "user", "content": mensaje}]
    )

    return response.content[0].text

# ══════════════════════════════════════════════════════════════════════════════
# ORIENTADOR DE ALTERNATIVAS
# ══════════════════════════════════════════════════════════════════════════════

SYSTEM_ALTERNATIVAS = """Eres el Agente Orientador de Alternativas del equipo de desarrollo de APEX.

Tu trabajo es evaluar si existe una mejor forma de lograr lo que el usuario solicita, considerando el contexto de APEX.

Considera:
- ¿Hay una forma más simple de lograr lo mismo?
- ¿Existe algo en APEX que ya resuelve parcialmente esto?
- ¿La solución propuesta genera deuda técnica innecesaria?
- ¿Hay un enfoque que minimice el impacto en módulos existentes?

FORMATO DE RESPUESTA OBLIGATORIO:

---
## REPORTE DE ALTERNATIVAS

**Solicitud evaluada:** [solicitud resumida]

### Opción A — [nombre descriptivo] ⭐ RECOMENDADA
- **Descripción:** [qué implica]
- **Ventajas:** [lista breve]
- **Desventajas:** [lista breve]
- **Complejidad:** Baja / Media / Alta
- **Impacto en módulos:** [qué toca]

### Opción B — [nombre descriptivo]
- **Descripción:** [qué implica]
- **Ventajas:** [lista breve]
- **Desventajas:** [lista breve]
- **Complejidad:** Baja / Media / Alta
- **Impacto en módulos:** [qué toca]

### Recomendación final
[Por qué recomiendas la Opción A en 2-3 líneas]
---

Si la solicitud original ya es la mejor opción, indícalo claramente con una sola opción.
"""

def analizar_alternativas(solicitud: str) -> str:
    """Sugiere alternativas para lograr lo solicitado."""
    print("\n💡 Orientador de Alternativas — Evaluando opciones...")

    contexto = consultar_memoria(solicitud)

    mensaje = f"""SOLICITUD A EVALUAR:
{solicitud}

CONTEXTO DE APEX:
{contexto}

Evalúa las alternativas disponibles para implementar esta solicitud."""

    response = anthropic.messages.create(
        model=APEX_MODEL,
        max_tokens=1000,
        system=SYSTEM_ALTERNATIVAS,
        messages=[{"role": "user", "content": mensaje}]
    )

    return response.content[0].text

# ══════════════════════════════════════════════════════════════════════════════
# FASE DE ORIENTACIÓN COMPLETA
# ══════════════════════════════════════════════════════════════════════════════

def orientar(solicitud: str) -> dict:
    """
    Ejecuta ambos orientadores y presenta el reporte consolidado al humano.
    Retorna dict con: impacto (str), alternativas (str), solicitud (str)
    """
    print("\n" + "=" * 60)
    print("APEX — Fase de Orientación")
    print("Analizando ANTES de ejecutar cualquier cambio...")
    print("=" * 60)

    reporte_impacto       = analizar_impacto(solicitud)
    reporte_alternativas  = analizar_alternativas(solicitud)

    print("\n" + "=" * 60)
    print("📊 REPORTE DE IMPACTO:")
    print("=" * 60)
    print(reporte_impacto)

    print("\n" + "=" * 60)
    print("🔀 REPORTE DE ALTERNATIVAS:")
    print("=" * 60)
    print(reporte_alternativas)

    print("\n" + "=" * 60)
    print("⏸  DECISIÓN REQUERIDA")
    print("=" * 60)
    print("Los orientadores han completado su análisis.")
    print("Opciones:")
    print("  [1] Continuar con la solicitud original")
    print("  [2] Continuar con la alternativa sugerida")
    print("  [3] Cancelar y replantear")

    return {
        "solicitud":    solicitud,
        "impacto":      reporte_impacto,
        "alternativas": reporte_alternativas
    }

# ── Main ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("APEX — Agentes de Orientación")
    print("=" * 60)
    print("\nEscribe tu solicitud:")

    solicitud = input("> ").strip()
    orientar(solicitud)
