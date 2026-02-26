# test_logo.py
from PIL import Image
import os

ruta = os.path.join(os.path.dirname(__file__), "..", "assets", "logo_scj.png")
ruta_abs = os.path.abspath(ruta)

print(f"Ruta: {ruta_abs}")
print(f"Existe: {os.path.exists(ruta_abs)}")

if os.path.exists(ruta_abs):
    try:
        img = Image.open(ruta_abs)
        print(f"Formato: {img.format}")
        print(f"Tamaño: {img.size}")
        print("✅ Imagen válida")
    except Exception as e:
        print(f"❌ Imagen corrupta: {e}")