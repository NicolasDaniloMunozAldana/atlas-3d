# Atlas 3D de Arquitectura de Software — versión sin framework

Electiva III · PWA (UPTC). Visor de **8 patrones de arquitectura de software en 3D** (arquitectura en capas, MVC, árbol binario, cliente-servidor, cliente-caché-servidor, microservicios, publicador-suscriptor y repositorio), dibujados con Three.js a partir de **datos** (sin archivos .glb), con realidad aumentada opcional.

Es la misma aplicación en tres versiones (sin framework, React y Angular): el motor es el mismo; cambia solo la pantalla. Esta es la versión **sin framework** (Vite + TypeScript).

- Versión React: https://github.com/NicolasDaniloMunozAldana/atlas-3d-react
- Versión Angular: https://github.com/NicolasDaniloMunozAldana/atlas-3d-angular

## Qué hace
- Visor 3D: arrastra para girar, toca una pieza para leer qué hace y su ficha ampliada.
- Sensores de orientación y cámara como fondo (opcionales, con plan B).
- **Realidad aumentada (WebXR)**: retícula con hit-test, el modelo se apoya en una superficie, ancla, y se mueve / gira / escala con los dedos; ◀ ▶ recorren las piezas. Plan B si no hay hit-test o anclas.
- Progreso en IndexedDB (visto, favoritos) y **notas de estudio cifradas** (PBKDF2 + AES-GCM).
- PWA: instalable (botón «Instalar», guía para iOS), Service Worker propio con Workbox (`src/sw.ts`), sin conexión, fichas descargables con Background Sync, avisos locales, banda de «sin conexión».
- Lighthouse: Three.js en su propio paquete, dibujo bajo demanda, espacio reservado (CLS ≈ 0).

## Cómo probarlo
```
npm install
npm run build
npm run preview      # http://localhost:4173
```
La AR necesita un teléfono Android con ARCore y Chrome sobre HTTPS (GitHub Pages) o, en el escritorio, la extensión *Immersive Web Emulator*. No funciona en iPhone (Safari no ofrece WebXR immersive-ar); allí queda el visor 3D.

## Lista de verificación (13 puntos)
```
cd pruebas && npm install playwright && npx playwright install chromium
ATLASDIR=.. node checklist-atlas.js        # tras `npm run build`
```

## Publicación
Cada `push` a `main` publica en GitHub Pages con `.github/workflows/pages.yml`.
