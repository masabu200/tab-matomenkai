# Ficha de Chrome Web Store (Español)

## Nombre (máx. 45 caracteres)
Tab Matomen Kai – Espacios de pestañas

## Resumen (máx. 132 caracteres)
Crea un «espacio» por proyecto y cambia de conjunto de pestañas en una ventana. Guardar, restaurar, acciones en bloque, deshacer.

## Descripción detallada
Tab Matomen Kai guarda tus pestañas como «espacios», uno por proyecto o tarea, y te permite cambiar todo el conjunto de pestañas dentro de la misma ventana de Chrome.

■ Qué puedes hacer
- Espacios: guarda un conjunto de pestañas por proyecto y cambia con un clic. Opcionalmente, guarda automáticamente las pestañas actuales al cambiar.
- Categorías: organiza los espacios en una jerarquía. Arrastra para moverlos y distínguelos por color e icono.
- Grupos de pestañas: los grupos de pestañas de Chrome se guardan y se restauran tal cual.
- Acciones en bloque: selecciona pestañas para abrirlas, moverlas, agruparlas, archivarlas o eliminarlas. Selecciona todo y rangos con Mayús.
- Deshacer: revierte una eliminación o un archivado justo después de hacerlo (Ctrl/⌘+Z).
- Copiar listas de URL: en Markdown, título + URL o solo URL, directamente al portapapeles.
- Guardar con clic derecho: guarda la página o el enlace bajo el cursor en cualquier espacio desde el menú contextual.
- Teclado: Ctrl/⌘+S guardar, Ctrl/⌘+K buscar espacios, / filtrar pestañas.
- Copia de seguridad: exportación/importación en JSON, copias automáticas programadas y copia manual en Google Drive.
- 10 idiomas: inglés, japonés, chino simplificado, chino tradicional, coreano, español, portugués (Brasil), alemán, francés e italiano. Cámbialo en Ajustes.

■ Tus datos
Todo se almacena en el almacenamiento local de tu navegador. La copia en Google Drive solo se escribe en tu propio Drive cuando pulsas «Conectar» y «Copia de seguridad ahora». Nada de lo que navegas se envía a ningún sitio.

■ Edición Pro
La mayoría de las funciones son gratuitas. La edición Pro (compra única, 300 ¥) añade la copia de seguridad automática en Google Drive. Se compra en Ajustes → Pro; no hay cargos recurrentes. Para comprobar la compra, solo se envía a nuestro servidor un ID de compra aleatorio creado para tu instalación (sin nombre, correo ni datos de navegación). El pago lo gestiona Stripe, con Link como vendedor.

## Justificación de permisos (para el panel de desarrollador)
- tabs / tabGroups: leer las pestañas y los grupos de pestañas abiertos para guardarlos y restaurarlos como espacios.
- storage / unlimitedStorage: conservar los espacios y los ajustes en local.
- alarms: copias de seguridad automáticas programadas.
- downloads: escribir las copias de seguridad en JSON en la carpeta Descargas.
- contextMenus: el menú contextual «Guardar en Tab Matomen Kai».
- identity: autorizar el guardado de copias de seguridad en Google Drive (solo el ámbito drive.file).
- Permiso de host googleapis.com: subir archivos a la API de Google Drive. 127.0.0.1: comunicarse con el servidor opcional de integración de IA local en el propio PC del usuario.
- Script de contenido (todos los sitios): solo escucha el botón del ratón configurado para volver al panel. No lee el contenido de la página.
