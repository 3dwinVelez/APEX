"""
APEX — Script de ingesta de documentos a ChromaDB
Convierte los archivos .md de /apex-knowledge en vectores consultables por los agentes.
"""

import os
import chromadb
from pathlib import Path
from anthropic import Anthropic

# ── Configuración ──────────────────────────────────────────────────────────────

KNOWLEDGE_DIR = Path(__file__).parent.parent.parent / "apex-knowledge"
CHROMA_DIR    = Path(__file__).parent / "chroma_db"
COLLECTION    = "apex_knowledge"
CHUNK_SIZE    = 800   # caracteres por fragmento
CHUNK_OVERLAP = 100   # solapamiento entre fragmentos

# ── Cliente Anthropic para embeddings ─────────────────────────────────────────

anthropic = Anthropic()

def get_embedding(text: str) -> list[float]:
    """Genera embedding usando el modelo de Anthropic."""
    response = anthropic.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1,
        messages=[{"role": "user", "content": text}],
        system="Responde solo con: ok"
    )
    # ChromaDB puede usar su propio embedding por defecto
    # Usamos el embedding por defecto de ChromaDB (sentence-transformers)
    return None

def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Divide el texto en fragmentos con solapamiento."""
    chunks = []
    start  = 0
    while start < len(text):
        end = start + size
        chunks.append(text[start:end])
        start = end - overlap
    return chunks

def extract_metadata(filepath: Path, content: str) -> dict:
    """Extrae metadatos del archivo y su contenido."""
    parts = filepath.parts
    
    # Identifica el tipo de documento por carpeta
    folder_map = {
        "00-maestro":    "maestro",
        "01-historia":   "historia",
        "02-arquitectura": "arquitectura",
        "03-modulos":    "modulo",
        "04-reglas":     "regla",
        "05-procesos":   "proceso",
        "06-estado-actual": "estado",
    }
    
    folder = next((p for p in parts if p in folder_map), "general")
    tipo   = folder_map.get(folder, "general")
    
    return {
        "archivo":  filepath.name,
        "carpeta":  folder,
        "tipo":     tipo,
        "ruta":     str(filepath),
    }

def ingest():
    """Proceso principal de ingesta."""
    
    # Verificar que existe la carpeta de conocimiento
    if not KNOWLEDGE_DIR.exists():
        print(f"❌ No se encontró la carpeta: {KNOWLEDGE_DIR}")
        print("   Asegúrate de ejecutar este script desde /agents/memory/")
        return

    # Inicializar ChromaDB
    print(f"📦 Iniciando ChromaDB en: {CHROMA_DIR}")
    client     = chromadb.PersistentClient(path=str(CHROMA_DIR))
    collection = client.get_or_create_collection(
        name=COLLECTION,
        metadata={"hnsw:space": "cosine"}
    )

    # Buscar todos los archivos .md
    md_files = list(KNOWLEDGE_DIR.rglob("*.md"))
    
    if not md_files:
        print("⚠️  No se encontraron archivos .md en /apex-knowledge")
        return

    print(f"📄 Archivos encontrados: {len(md_files)}")
    
    total_chunks = 0

    for filepath in md_files:
        print(f"\n🔄 Procesando: {filepath.name}")
        
        content  = filepath.read_text(encoding="utf-8")
        chunks   = chunk_text(content)
        metadata = extract_metadata(filepath, content)
        
        for i, chunk in enumerate(chunks):
            if not chunk.strip():
                continue
            
            doc_id = f"{filepath.stem}__chunk_{i}"
            
            collection.upsert(
                ids=[doc_id],
                documents=[chunk],
                metadatas=[{**metadata, "chunk_index": i}]
            )
            total_chunks += 1
        
        print(f"   ✅ {len(chunks)} fragmentos indexados")

    print(f"\n🎉 Ingesta completa: {total_chunks} fragmentos en ChromaDB")
    print(f"   Colección: '{COLLECTION}'")
    print(f"   Ubicación: {CHROMA_DIR}")

def test_query(query: str = "¿Qué es APEX?"):
    """Prueba una consulta contra la base de conocimiento."""
    print(f"\n🔍 Probando consulta: '{query}'")
    
    client     = chromadb.PersistentClient(path=str(CHROMA_DIR))
    collection = client.get_collection(COLLECTION)
    
    results = collection.query(
        query_texts=[query],
        n_results=3
    )
    
    print("\n📋 Resultados:")
    for i, (doc, meta) in enumerate(zip(
        results["documents"][0],
        results["metadatas"][0]
    )):
        print(f"\n[{i+1}] Archivo: {meta['archivo']} | Tipo: {meta['tipo']}")
        print(f"    {doc[:200]}...")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "test":
        query = sys.argv[2] if len(sys.argv) > 2 else "¿Qué es APEX?"
        test_query(query)
    else:
        ingest()
