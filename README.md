# Orca Dev Status

Extensión para GNOME Shell 45–50 que muestra en la barra superior el estado de
los agentes administrados por Orca.

## Indicador

La barra muestra `🐋 <agentes activos> <estado>` con esta prioridad:

- `❓`: algún agente espera una respuesta.
- `🔔`: algún agente requiere atención.
- Punto naranja: hay agentes trabajando.
- Punto verde: todos finalizaron o no existen agentes activos.
- Punto gris: Orca no está disponible.

El menú incluye un resumen global, los agentes agrupados por workspace y la
acción **Configuración**. Al mantener el puntero sobre una sesión muestra su
prompt, actividad reciente y consumo de CPU/memoria obtenido bajo demanda. Las
filas permiten abrir o cerrar sesiones, con confirmación cuando requieren
atención.

## Requisitos

- GNOME Shell 45 o posterior.
- Mutter Development Kit en GNOME 49 o posterior (`mutter-devkit` en
  Arch/Fedora, `mutter-dev-bin` en Ubuntu).
- Orca abierto y el comando público `orca-ide` instalado.
- Node.js para lint y pruebas.

La extensión consulta cada cinco segundos:

```bash
orca-ide worktree ps --json
```

En Linux no usa el comando `orca`, porque puede corresponder al lector de
pantalla de GNOME.

## Desarrollo

```bash
npm install
npm test
npm run test:integration
npm run lint
npm run build
```

La prueba de integración requiere que Orca esté abierto y ejecuta el CLI real.

Para probar cambios sin cerrar la sesión de Wayland, abre una instancia anidada
de GNOME Shell:

```bash
npm run dev
```

El comando compila e instala la extensión, abre GNOME Shell en una ventana y la
activa dentro de esa instancia. Como GNOME mantiene los módulos JavaScript en
caché, después de editar el código cierra la ventana de prueba con `Ctrl+C` y
vuelve a ejecutar el comando; la sesión principal permanece abierta.

## Instalación local

```bash
make install
make activate
```

También puede compilarse el ZIP sin instalarlo:

```bash
make bundle
```

La acción **Configuración** permite cambiar la zona y el índice del indicador
en la barra. El UUID de la extensión es
`orca-dev-status@navarrortiz.github.io`.

El repositorio incluye únicamente el XML fuente del schema. El archivo
`schemas/gschemas.compiled` se genera durante el build y no se versiona.

## Estructura

```text
├── extension.js
├── prefs.js
├── schemas/
├── src/
│   ├── extension/    # lifecycle y polling
│   ├── orca/         # cliente del CLI y modelo puro
│   ├── prefs/        # preferencias de posición
│   ├── shared/       # constantes
│   └── ui/           # indicador y menú
└── tests/            # pruebas unitarias e integración real
```
