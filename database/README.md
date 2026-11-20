# Base de datos local

El backend usa MySQL. `schema.local.sql` crea la base `sistema_usuarios` y las
tablas compatibles con Railway:

- `personal_militar`, incluido el correo usado por recuperación de contraseña
  el rol de acceso (`usuario` o `admin`) y la foto de perfil.
- `accesos`, con las columnas de la tabla existente y las columnas adicionales
  que requieren las rutas actuales de acceso.
- `saffe_codigos_recuperacion`, para los códigos temporales.

## Crear la base

1. Para desarrollo local, instala e inicia MySQL Server.
2. Ejecuta `schema.local.sql` en MySQL Workbench para crear la base local.
3. Opcionalmente, ejecuta `seed.local.sql` en Workbench para cargar los
   registros de prueba visibles en las capturas. Este archivo está excluido de
   Git. Las contraseñas originales no se copian: cada usuario recibe un hash
   aleatorio y tendrá que usar recuperación de contraseña para establecer una.
4. El backend ejecuta migraciones idempotentes al arrancar, creando las tablas
   faltantes y agregando las columnas de acceso que necesiten las consultas.
5. En desarrollo local, crea `backend/.env` a partir de `.env.example` y
   completa `DB_PASSWORD` con la contraseña real de MySQL. Para recuperación
   configura `SMTP_USER=saffe4808@gmail.com` y `SMTP_APP_PASSWORD` con una
   contraseña de aplicación de Google. De forma predeterminada se usa
   `smtp.gmail.com:465` con TLS implícito; si usas otro servidor, configura
   también `SMTP_HOST`, `SMTP_PORT` y `SMTP_SECURE` según los datos de tu
   proveedor. No compartas ni subas `.env` a Git.
   La recuperación busca `personal_militar.correo` por documento en cada
   solicitud; no hay un destinatario fijo ni caché de correos. Al cambiar esa
   columna, el siguiente código se envía al nuevo correo. Local y Railway usan
   bases de datos distintas, así que un cambio en una no modifica la otra.
   También se puede actualizar el correo mediante `PUT /api/usuarios/:documento`
   con una cuenta `admin` y solo el campo `correo`; la ruta valida y guarda el
   valor sin sobrescribir los demás datos del usuario.
6. En `frontend/.env`, configura `BACKEND_URL=http://localhost:3000` para que
   las páginas llamen al backend local.
7. Desde `backend`, ejecuta `npm run dev`; desde `frontend`, ejecuta
   `npm run dev`.
8. Para desplegar en Render, crea los servicios backend y frontend desde sus
   repositorios; ambos incluyen un `Dockerfile`. En el backend configura en
   Render `DATABASE_URL` con la URL MySQL de TiDB, por ejemplo
   `mysql://usuario:contraseña@host.tidbcloud.com:4000/sistema_usuarios`.
   Codifica los caracteres especiales del usuario o contraseña como URL. La
   conexión detecta el host de TiDB y habilita SSL; también puedes establecer
   `DB_SSL=true`. La base de datos indicada debe existir en TiDB antes del
   primer arranque; el backend crea y migra las tablas.
9. En Render configura `JWT_SECRET` con un valor aleatorio y, si usas la
   recuperación de contraseña, `SMTP_USER` y `SMTP_APP_PASSWORD` (más
   `SMTP_HOST`, `SMTP_PORT` y `SMTP_SECURE` si tu proveedor lo requiere).
   Configura `FRONTEND_ORIGIN` con el origen exacto del frontend. En el servicio
   frontend configura `BACKEND_URL` con la URL pública del backend, por ejemplo
   `https://backend-saffe.onrender.com` o la URL que Render asigne. Render
   proporciona `PORT` automáticamente. Guarda todas las credenciales en las
   variables de entorno de Render; nunca subas `.env` a Git.
10. Para habilitar la administración, primero registra e identifica la cuenta
    de una persona de confianza y luego, desde MySQL Workbench conectado a la
    base de datos que usa el backend, ejecuta:

    ```sql
    UPDATE personal_militar
    SET rol = 'admin'
    WHERE documento = 'DOCUMENTO_DE_CONFIANZA';
    ```

    Los usuarios existentes y los registros públicos reciben `usuario` por
    defecto. El rol no se puede asignar desde el formulario ni modificando el
    `rango`; solo una cuenta `admin` puede consultar la gestión, registrar
    usuarios desde el perfil, actualizarlos o eliminarlos. La sesión vuelve a
    comprobar el rol contra la base de datos en cada solicitud. Conserva al
    menos una cuenta administradora; la API impide eliminar la última. Al
    iniciar sesión, los administradores llegan al perfil y pueden filtrar el
    historial global por documento, nombre o rango. Los usuarios normales
    llegan a la pantalla de acceso autorizado y la API solo les entrega su
    historial personal. Desde la gestión del personal, un administrador también
    puede actualizar la foto de un usuario; las imágenes se reducen y almacenan
    como JPEG en la base de datos.

No copies filas de usuarios reales de Railway a este entorno de prueba.
