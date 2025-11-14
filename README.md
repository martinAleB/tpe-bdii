# TPO - Base de Datos II

El presente trabajo consiste en una plataforma de backoffice desarrollada en Node.js, Express, MongoDB y Redis para gestionar la operatoria de una aseguradora y responder consultas analíticas para la materia Base de Datos II del ITBA. El sistema expone trece consultas/servicios principales, alineados con la consigna del trabajo práctico:

- <b>Query 1 - Clientes activos con pólizas vigentes</b>: `GET /api/clientes/active` devuelve a los clientes con estado activo y al menos una póliza en curso.
- <b>Query 2 - Siniestros abiertos con tipo, monto y cliente</b>: `GET /api/siniestros/open` lista siniestros abiertos junto con tipo, monto estimado y datos del cliente afectado.
- <b>Query 3 - Vehículos asegurados con su cliente y póliza</b>: `GET /api/vehiculos/insured` cruza vehículos marcados como asegurados con su titular y la póliza de auto correspondiente.
- <b>Query 4 - Clientes sin pólizas activas</b>: `GET /api/clientes/no-active-policies` identifica clientes que no poseen pólizas activas o vigentes.
- <b>Query 5 - Agentes activos con cantidad de pólizas asignadas</b>: `GET /api/agentes/active` muestra agentes habilitados y la cantidad de pólizas que administran.
- <b>Query 6 - Pólizas vencidas con el nombre del cliente</b>: `GET /api/polizas/expired` devuelve pólizas vencidas, fecha de fin y cliente asociado.
- <b>Query 7 - Top 10 clientes por cobertura total</b>: `GET /api/clientes/top-cobertura` calcula el ranking por cobertura acumulada aprovechando caché en Redis.
- <b>Query 8 - Siniestros “Accidente” del último año</b>: `GET /api/siniestros/accidents-last-year` filtra los accidentes ocurridos en los últimos 12 meses.
- <b>Query 9 - Pólizas activas ordenadas por fecha de inicio</b>: `GET /api/polizas/active-by-date` consume la vista materializada `vw_polizas_activas_por_fecha`.
- <b>Query 10 - Pólizas suspendidas con el estado del cliente</b>: `GET /api/polizas/suspended-with-client-info` agrega los datos de actividad del cliente responsable.
- <b>Query 11 - Clientes con más de un vehículo asegurado</b>: `GET /api/clientes/multiple-vehicles` analiza la relación cliente/vehículos para encontrar duplicados.
- <b>Query 12 - Agentes y cantidad de siniestros asociados</b>: `GET /api/agentes/with-sinisters-count` une pólizas y siniestros para contar incidentes por agente.
- <b>Query 13 - ABM de clientes</b>: `POST /api/clientes`, `PUT /api/clientes/:id` y `DELETE /api/clientes/:id` permiten alta, modificación y baja lógica con validaciones.
- <b>Query 14 - Alta de nuevos siniestros</b>: `POST /api/siniestros` registra un incidente validando póliza activa/vigente y datos obligatorios.
- <b>Query 15 - Emisión de nuevas pólizas (validando cliente y agente)</b>: `POST /api/polizas` crea pólizas verificando que el cliente y el agente estén activos, además de chequear fechas y montos.

<details>
  <summary>Contenidos</summary>
  <ol>
    <li><a href="#instalación">Instalación</a></li>
    <li><a href="#instrucciones">Instrucciones</a></li>
    <li><a href="#manual-de-usuario">Manual de Usuario</a></li>
    <li><a href="#integrantes">Integrantes</a></li>
  </ol>
</details>

## Instalación:

Clonar el repositorio:

- HTTPS:
  ```sh
    git clone https://github.com/martinAleB/tpe-bdii.git
  ```
- SSH:
  ```sh
    git clone git@github.com:martinAleB/tpe-bdii.git
  ```

Preparar el entorno dentro de `server/` (en caso de no ejecutarlo en un Codespace):

1. Instalar dependencias:
   ```sh
     cd tpe-bdii/server
     npm install
   ```
2. Crear un archivo `.env` con las conexiones necesarias (valores por defecto sugeridos):
   ```sh
     MONGO_URL=mongodb://localhost:27017/aseguradora
     REDIS_URL=redis://localhost:6379
     PORT=3000
   ```
3. Levantar servicios de apoyo (pueden ser contenedores locales):
   ```sh
     docker run -d --name tpe-mongo -p 27017:27017 mongo:7
     docker run -d --name tpe-redis -p 6379:6379 redis:7
   ```

  <p align="right">(<a href="#tpo---base-de-datos-ii">Volver</a>)</p>

## Instrucciones:

Una vez configurado el entorno, se debe incializar el Codespace (local o desde GitHub).
- Al primer arranque se ejecuta automáticamente `seedDatabase`, que importa los CSV ubicados en `data/csv/` y crea la vista `vw_polizas_activas_por_fecha`. Si las colecciones ya tienen datos, la rutina no los sobrescribe.
- El servidor escucha en `http://localhost:${PORT}` (3000 por defecto) y expone los routers de agentes, clientes, siniestros, vehículos y pólizas bajo `/api`.
- Redis se utiliza para cachear las consultas de agentes activos y el ranking de coberturas, por lo que debe estar accesible cuando se levanta la API.

  <p align="right">(<a href="#tpo---base-de-datos-ii">Volver</a>)</p>

## Manual de Usuario:

Una vez que el backend está corriendo, existen dos formas equivalentes de ejecutar las consultas y servicios.

### Opción 1: Documentación interactiva (Swagger)

1. Abrir `http://localhost:3000/swagger` en el navegador (o la URL reemplazando host/puerto si se corre en Codespaces).
2. Navegar las secciones “Clientes”, “Pólizas”, “Agentes”, “Siniestros” y “Vehículos”. Cada entrada corresponde a una de las trece queries listadas al inicio.
3. Para ejecutar una consulta, expandir el endpoint deseado (por ejemplo `GET /api/clientes/active` para la Query 1), presionar **Try it out** y, si corresponde, completar los parámetros.
4. Hacer clic en **Execute**. Swagger mostrará la URL completa, el código de estado y el JSON devuelto por MongoDB, lo que resulta útil para revisar rápidamente cada escenario pedido por la consigna.

### Opción 2: GUI de backoffice

1. Abrir `http://localhost:3000/` para cargar el panel visual incluido en `server/index.html`.
2. Utilizar el menú lateral para elegir la consulta o acción. Las opciones de sólo lectura (queries 1-12) muestran los resultados en tarjetas legibles, mientras que las operaciones de ABM y carga de siniestros/pólizas habilitan formularios validados.
3. Presionar el botón **Consultar** o **Enviar** según corresponda. La respuesta aparece en la sección “Respuesta”, con la posibilidad de alternar entre una vista amigable y el JSON crudo.
4. Esta GUI es ideal para la demostración frente a los docentes porque evita herramientas externas: basta con elegir “Vehículos asegurados”, “Top Cobertura”, etc., y el sistema dispara la misma request que expone la API pública.

Ambas opciones comparten el mismo backend, de modo que cualquier filtro aplicado en Swagger se ver reflejado de inmediato en la GUI y viceversa.

  <p align="right">(<a href="#tpo---base-de-datos-ii">Volver</a>)</p>

## Integrantes:

Martín Alejandro Barnatán (64463) - mbarnatan@itba.edu.ar

Celestino Garrós (64375) - cgarros@itba.edu.ar

Ignacio Pedemonte Berthoud (64908) - ipedemonteberthoud@itba.edu.ar

Leo Weitz (64365) - lweitz@itba.edu.ar

  <p align="right">(<a href="#tpo---base-de-datos-ii">Volver</a>)</p>
