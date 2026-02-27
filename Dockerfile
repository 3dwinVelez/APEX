# 1. Usamos una imagen de Python oficial y ligera
FROM python:3.11-slim

# 2. Instalamos dependencias del sistema necesarias para Flet y psycopg2
RUN apt-get update && apt-get install -y \
    libgtk-3-0 \
    libgstreamer1.0-0 \
    && rm -rf /var/lib/apt/lists/*

# 3. Establecemos el directorio de trabajo dentro del servidor
WORKDIR /app

# 4. Copiamos el archivo de requerimientos primero (para optimizar la carga)
COPY requirements.txt .

# 5. Instalamos las librerías de Python
RUN pip install --no-cache-dir -r requirements.txt

# 6. Copiamos todo el resto del código de tu proyecto a la carpeta /app
COPY . .

# 7. Exponemos el puerto 8080 (el estándar que usa Railway)
EXPOSE 8080

# 8. El comando para arrancar la app en modo WEB
# Asegúrate de que "main.py" sea el nombre exacto de tu archivo de arranque
CMD ["python", "main.py"]