# Aplicación de Índice Invertido

Este proyecto consiste en una aplicación web que permite la carga de archivos de texto plano y la creación de un índice invertido para facilitar la búsqueda eficiente de términos. La aplicación utiliza una base de datos MySQL para almacenar el índice invertido y permite consultas utilizando diferentes operadores lógicos.

## Características

 **Carga de Archivos**: Permite a los usuarios cargar múltiples archivos de texto plano desde un formulario.
- **Índice Invertido**: Genera automáticamente un índice invertido a partir de los documentos cargados, almacenando términos, frecuencias y posiciones.
- **Búsqueda Avanzada**: Soporta consultas con operadores lógicos (AND, OR, NOT) y patrones de expresión regular.
- **Resultados Relevantes**: Los resultados se ordenan por relevancia utilizando el algoritmo tf-idf y se presenta el valor de similitud Coseno.
- **Descarga de Archivos**: Proporciona enlaces a los archivos que contienen los términos buscados, junto con un fragmento del texto.

## Requisitos

- Windows x64
- XAMPP (o stack equivalente con Apache, MySQL y PHP)
- PHP 8.2 o superior
- Extensión PHP Parle

## Instalación

1. Instala XAMPP en tu sistema si aún no lo has hecho.

2. Clona este repositorio en el directorio `htdocs` de XAMPP.

3. Instala la extensión PHP Parle:
   - Localiza el archivo `php_parle.dll` en la carpeta `parle` de este proyecto.
   - Copia `php_parle.dll` al directorio `C:\xampp\php\ext`.
   - Abre el archivo `php.ini` (generalmente ubicado en `C:\xampp\php\php.ini`).
   - Agrega la siguiente línea para habilitar la extensión:
     ```
     extension=parle
     ```

4. Reinicia Apache en el panel de control de XAMPP para aplicar los cambios.

5. Importa la base de datos `inverted_index` (incluida en `db/inverted_index.sql` ) en el servidor MySQL.

6. Actualiza los detalles de conexión a la base de datos en el script PHP si es necesario.

## Uso

1. Inicia Apache y MySQL en el panel de control de XAMPP.

2. Navega a `http://localhost/ruta-del-proyecto` en tu navegador web.

3. Ingresa tu consulta de búsqueda en el campo de entrada. Aquí hay algunos ejemplos de consultas:

   - Búsqueda simple de palabras: `queso`
   - Coincidencia de patrones: `PATRON(hola)`
   - Operadores: OR, NOT, AND,

4. Presiona el botón "Buscar" para ejecutar la consulta.

5. Visualiza los resultados, la consulta SQL y la visualización AST debajo del formulario de búsqueda.

## Sintaxis del Lenguaje de Consulta

- `AND`: Operador lógico AND
- `OR`: Operador lógico OR
- `NOT`: Operador lógico NOT
- `PATRON(regex)`: Busca utilizando un patrón de expresión regular

## Solución de problemas

Si encuentras algún problema con la extensión Parle, asegúrate de que:

1. El archivo `php_parle.dll` esté correctamente ubicado en el directorio `ext`.
2. La línea `extension=parle` esté agregada en `php.ini` y no esté comentada.
3. Hayas reiniciado Apache después de hacer cambios en `php.ini`.

Para cualquier otro problema, por favor revisa los logs de error o contacta al mantenedor.

## Créditos

## Integrantes

| Nombre                        | <!-- -->                                                           |
| ----------------------------- | ------------------------------------------------------------------ |
| Fernando Joachín Prieto       | <img src="./Team/foto-joachin.jpg" width="120" height="150" style='object-cover>       |
| José Carlos Leo Fernández     | <img src="./Team/foto-leo.JPG" width="120" height="150">           |
| Elías Madera de Regil         | <img src="./Team/foto-elias.jpg" width="120" height="150">         |
| Vicente Nava Montoya          | <img src="./Team/foto-vicente.jpg" width="120" height="150">    |
| Fernando Villajuana Saavedra  | <img src="./Team/foto-villajuana.jpg" width="120" height="150">    |