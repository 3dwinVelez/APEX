"""
APEX — Agente Intérprete
Traduce solicitudes humanas en specs técnicas usando el contexto de la base de conocimiento.
"""

import os
import chromadb
from pathlib import Path
from anthropic import Anthropic

# ── Configuración ──────────────────────────────────────────────────────────────

CHROMA_DIR  = Path(__file__).parent / "memory" / "chroma_db"
COLLECTION  = "apex_knowledge"
APEX_MODEL  = "claude-haiku-4-5-20251001"

# ── Clientes ───────────────────────────────────────────────────────────────────

anthropic  = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
chroma     = chromadb.PersistentClient(path=str(CHROMA_DIR))
collection = chroma.get_collection(COLLECTION)

# ── Funciones de memoria ───────────────────────────────────────────────────────

def consultar_memoria(query: str, n_results: int = 4) -> str:
    """Recupera fragmentos relevantes de la base de conocimiento de APEX."""
    results = collection.query(
        query_texts=[query],
        n_results=n_results
    )
    
    fragmentos = []
    for doc, meta in zip(results["documents"][0], results["metadatas"][0]):
        fragmentos.append(f"[{meta['tipo'].upper()} — {meta['archivo']}]\n{doc}")
    
    return "\n\n---\n\n".join(fragmentos)

# ── Prompt del Intérprete ──────────────────────────────────────────────────────

SYSTEM_PROMPT = """Eres el Agente Intérprete del equipo de desarrollo de APEX.

Tu única responsabilidad es traducir solicitudes humanas en especificaciones técnicas precisas y ejecutables para el Agente Coder.

APEX es un ERP SaaS con:
- Frontend: Next.js + TypeScript + Tailwind CSS (migrando desde React)
- Backend: FastAPI (Python)
- Base de datos: PostgreSQL

Recibirás:
1. La solicitud del usuario en lenguaje natural
2. Contexto relevante de la base de conocimiento de APEX

Debes producir una spec técnica con esta estructura exacta:

---
## SPEC TÉCNICA

**Objetivo:** [qué debe lograrse en una oración]

**Módulo afectado:** [nombre del módulo]

**Archivos a crear:**
- ruta/archivo.tsx — descripción breve

**Archivos a modificar:**
- ruta/archivo.tsx — qué cambio específico

**Archivos intocables:**
- [archivos que NO deben tocarse y por qué]

**Convenciones a aplicar:**
- [lista de convenciones de APEX relevantes]

**Criterios de éxito:**
1. [criterio verificable]
2. [criterio verificable]

**Riesgos identificados:**
- [posibles conflictos o dependencias]

**Preguntas sin respuesta:**
- [si falta información para proceder, listarla aquí]
---

Si la solicitud es ambigua o falta información crítica, indica claramente qué necesitas antes de generar la spec.
No generes código. Solo la spec técnica.
"""

# ── Agente Intérprete ──────────────────────────────────────────────────────────

def interpretar(solicitud: str) -> str:
    """
    Recibe una solicitud en lenguaje natural y devuelve una spec técnica.
    """
    print(f"\n🧠 Intérprete procesando: '{solicitud}'")
    print("🔍 Consultando base de conocimiento...")
    
    contexto = consultar_memoria(solicitud)
    
    print("⚙️  Generando spec técnica...\n")
    
    mensaje_usuario = f"""SOLICITUD DEL USUARIO:
{solicitud}

CONTEXTO DE APEX (base de conocimiento):
{contexto}

Genera la spec técnica para esta solicitud."""

    response = anthropic.messages.create(
        model=APEX_MODEL,
        max_tokens=1500,
        system=SYSTEM_PROMPT,
        messages=[
            {"role": "user", "content": mensaje_usuario}
        ]
    )
    
    return response.content[0].text

# ── Main ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    
    print("=" * 60)
    print("APEX — Agente Intérprete")
    print("=" * 60)
    
    if len(sys.argv) > 1:
        solicitud = " ".join(sys.argv[1:])
    else:
        print("\nEscribe tu solicitud (o 'salir' para terminar):")
        solicitud = input("> ").strip()
    
    while solicitud.lower() != "salir":
        spec = interpretar(solicitud)
        
        print("\n" + "=" * 60)
        print("SPEC TÉCNICA GENERADA:")
        print("=" * 60)
        print(spec)
        print("=" * 60)
        
        if len(sys.argv) > 1:
            break
            
        print("\nOtra solicitud (o 'salir'):")
        solicitud = input("> ").strip()
