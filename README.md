
# Proyecto de Búsqueda y Recuperación Web

Este proyecto consiste en una aplicación de búsqueda y recuperación de información utilizando Solr y una interfaz frontend desarrollada con React y Vite.

## Configuración de Solr

- Se usó **Solr 9.7.0-slim** en **Windows 11**.
- El core de Solr se debe llamar **'briw'**.
- Debes colocar `schema.xml` y `solrconfig.xml` en la carpeta `conf` del core.

## Backend

El backend está desarrollado con Node.js y Express. Proporciona endpoints para realizar búsquedas, sugerencias, y para subir y procesar archivos PDF.

### Instalación

1. Navega al directorio `backend`:
    ```sh
    cd backend
    ```

2. Instala las dependencias:
    ```sh
    npm install
    ```

3. Inicia el servidor:
    ```sh
    npm start
    ```

### Endpoints

- `/api/search`: Realiza una búsqueda en Solr.
- `/api/suggest`: Obtiene sugerencias de búsqueda.
- `/api/crawl`: Realiza el crawling de un sitio web.
- `/api/upload/pdf`: Sube y procesa un archivo PDF.

## Frontend

El frontend está desarrollado con React y Vite. Proporciona una interfaz de usuario para realizar búsquedas y ver los resultados.

### Instalación

1. Navega al directorio `frontend`:
    ```sh
    cd frontend
    ```

2. Instala las dependencias:
    ```sh
    npm install
    ```

3. Inicia la aplicación:
    ```sh
    npm run dev
    ```

### Estructura del Proyecto

- `src/components`: Componentes reutilizables de la interfaz de usuario.
- `src/hooks`: Hooks personalizados.
- `src/pages`: Páginas de la aplicación.
- `src/styles`: Archivos de estilos.

## Docker

El proyecto incluye archivos Docker para facilitar la configuración y despliegue.

### Backend

El archivo `backend/Dockerfile` define la configuración para el backend.

### Frontend

El archivo `frontend/Dockerfile` define la configuración para el frontend.

### Docker Compose

El archivo `docker-compose.yml` permite levantar tanto el backend como el frontend con un solo comando:
```sh
docker-compose up