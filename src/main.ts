// Mulish servida desde node_modules (no desde Google Fonts): así también carga sin conexión.
import "@fontsource/mulish/400.css";
import "@fontsource/mulish/500.css";
import "@fontsource/mulish/600.css";
import "@fontsource/mulish/700.css";
import "@fontsource/mulish/800.css";
import "./style.css";
import { registerSW } from "virtual:pwa-register";
import { PATRONES } from "./catalogo";
import { iniciarProgreso } from "./progreso-ui";
import { abrirBaseDeDatos, encolarDescargas, obtenerDescargas } from "./db";
import { crearVisor, type EstadoAR } from "./visor";
import { pedirPermisoOrientacion, hayOrientacionReal, iniciarControlOrientacion } from "./sensores";
import type { ControlOrientacion } from "./sensores";
import { iniciarCamaraDeFondo, detenerCamaraDeFondo, describirErrorCamara } from "./camara";
import { estadoAvisos, pedirPermisoAvisos, mostrarAviso } from "./avisos";
import { ETIQUETA_SYNC, FICHAS_DESCARGABLES, descargarPendientes, leerFicha } from "./descargas";
import { CATALOGO, modeloPorId } from "./modelos";
import { ROLES, type Ficha } from "./modelos/tipos";
import { describirRastro, leerRastro, PASO_FINAL } from "./rastro";
import { estadoInstalacion, iniciarInstalacion, instalacionRechazada, pedirInstalacion } from "./instalar";
import { iniciarConexion } from "./conexion";
import { diagnosticarAR, mensajeSoporteAR, pedirSesionAR, describirErrorAR } from "./xr";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <p id="estado-conexion" class="estado-conexion" role="status" hidden></p>
  <header class="nav-bar">
    <div class="nav-brand">
      <span class="nav-dot" aria-hidden="true"></span>
      <span>Atlas 3D</span>
    </div>
    <span id="estado-sw" class="sw-badge">Service Worker: comprobando…</span>
  </header>

  <main class="contenido">
  <section class="hero">
    <p class="hero-eyebrow">Módulo AR · Versión final</p>
    <h1>Atlas 3D de Arquitectura de Software</h1>
    <p>Ocho patrones de arquitectura de software dibujados en 3D con Three.js: míralos, toca una pieza para leer qué hace y apóyalos sobre tu mesa con realidad aumentada. Se instala y funciona sin conexión.</p>
  </section>

  <section class="visor-zona" aria-label="Visor 3D">
    <div class="visor-barra">
      <button type="button" id="btn-orientacion" class="btn-visor">📱 Rotar con el teléfono</button>
      <button type="button" id="btn-calibrar" class="btn-visor" disabled>Calibrar</button>
      <button type="button" id="btn-camara" class="btn-visor">📷 Cámara de fondo</button>
      <button type="button" id="btn-ar" class="btn-visor destacado" disabled>🥽 Ver en AR</button>
    </div>
    <p id="aviso-visor" class="aviso-visor" role="status" hidden></p>
    <div id="visor" class="escena-contenedor">
      <video id="fondo-camara" class="fondo-camara" playsinline muted hidden></video>
    </div>
    <span id="lectura-visor" class="lectura-visor"></span>
    <section class="modelo-panel" aria-label="Modelo de arquitectura">
      <div class="modelo-tabs" id="tabs-modelo" role="group" aria-label="Elegir modelo"></div>
      <p id="modelo-resumen" class="modelo-resumen"></p>
      <div id="leyenda" class="leyenda" aria-label="Leyenda de colores"></div>
      <div id="chips-piezas" class="chips-piezas" role="group" aria-label="Piezas del modelo"></div>
      <div id="pieza-detalle" class="pieza-detalle" aria-live="polite"></div>
    </section>
    <p id="estado-ar" class="estado-ar" role="status">Comprobando realidad aumentada…</p>
    <details class="diag-ar">
      <summary>Diagnóstico de realidad aumentada</summary>
      <pre id="diag-ar" class="diag-ar-texto"></pre>
      <button type="button" id="btn-recomprobar" class="btn-nota secundario">Comprobar de nuevo</button>
    </details>
    <p class="aviso-demo">Toca una pieza para ver qué hace; arrastra para girar la vista. Con la cámara de fondo NO es realidad aumentada: el modelo solo se dibuja encima del video. «Ver en AR» abre una sesión WebXR real: el anillo verde busca una superficie, tocas para apoyar el modelo, y lo mueves, giras y escalas con los dedos; con ◀ ▶ recorres sus piezas. Los modelos son esquemas didácticos, no réplicas realistas.</p>
  </section>

  <section class="catalogo">
    <h2>Los 8 patrones del catálogo</h2>
    <div class="catalogo-grid">
      ${PATRONES.map((patron, i) => {
        const m = modeloPorId(patron.id);
        return `
        <article class="patron-card" data-id="${patron.id}">
          <div class="patron-top">
            <span class="numero">0${i + 1}</span>
            <button type="button" class="btn-fav" aria-pressed="false" aria-label="Marcar ${patron.nombre} como favorito">☆</button>
          </div>
          <button type="button" class="patron-abrir">${patron.nombre}</button>
          <span class="resumen-card">${m?.resumen ?? ""}</span>
          <span class="estado">Modelo 3D disponible</span>
          <span class="visita">Sin visitar</span>
          <button type="button" class="btn-ver3d" data-id="${patron.id}">🧊 Ver en 3D</button>
        </article>`;
      }).join("")}
    </div>
  </section>

  <section class="progreso" id="progreso">
    <h2>Tu progreso</h2>
    <div class="progreso-fila">
      <h3>Continuar viendo</h3>
      <div id="recientes" class="chips"></div>
    </div>
    <div class="progreso-fila">
      <h3>Tus favoritos</h3>
      <div id="favoritos" class="chips"></div>
    </div>

    <div id="nota-estudio" class="nota-estudio" hidden>
      <div class="nota-cabecera">
        <h3 id="nota-titulo">Nota de estudio</h3>
        <span id="nota-estado" class="pill">Notas bloqueadas</span>
      </div>
      <form id="form-clave-atlas" class="form-clave-atlas">
        <input id="input-clave-atlas" type="password" placeholder="Contraseña de tus notas" autocomplete="off" />
        <button type="submit" class="btn-nota">Desbloquear</button>
      </form>
      <textarea id="nota-texto" rows="3" placeholder="Escribe tu nota de estudio — se guarda cifrada" disabled></textarea>
      <div class="nota-acciones">
        <button id="btn-guardar-nota" type="button" class="btn-nota" disabled>Guardar nota cifrada</button>
        <button id="btn-bloquear-atlas" type="button" class="btn-nota secundario" hidden>Bloquear</button>
      </div>
      <p id="nota-mensaje" class="nota-mensaje" role="status"></p>
    </div>
  </section>

  <section class="instalar-zona descargas-zona" aria-labelledby="titulo-instalar">
    <h2 id="titulo-instalar">Instalar la app</h2>
    <div class="descargas-barra">
      <button type="button" id="btn-instalar" class="btn-nota" hidden>⬇ Instalar Atlas 3D</button>
      <span id="estado-instalacion" class="estado-linea" role="status"></span>
    </div>
  </section>

  <section class="descargas-zona" aria-labelledby="titulo-descargas">
    <h2 id="titulo-descargas">Uso sin conexión</h2>
    <div class="descargas-barra">
      <button type="button" id="btn-avisos" class="btn-nota secundario">🔔 Activar avisos</button>
      <button type="button" id="btn-descargar" class="btn-nota">⬇ Descargar fichas para usar sin conexión</button>
    </div>
    <p id="estado-avisos" class="estado-linea"></p>
    <progress id="progreso-descarga" max="${FICHAS_DESCARGABLES.length}" value="0" hidden></progress>
    <p id="estado-descarga" class="estado-linea" role="status"></p>
  </section>
  </main>

  <div id="xr-overlay" class="xr-overlay">
    <p id="xr-estado">Sesión de realidad aumentada activa</p>
    <p id="xr-datos" class="xr-datos"></p>
    <div class="xr-piezas">
      <button type="button" id="btn-pieza-ant" aria-label="Pieza anterior">◀</button>
      <p id="xr-pieza" class="xr-pieza"></p>
      <button type="button" id="btn-pieza-sig" aria-label="Pieza siguiente">▶</button>
    </div>
    <button type="button" id="btn-salir-ar">Salir de AR</button>
  </div>

  <footer class="pie">
    <p>Vite + TypeScript + Three.js + Workbox + WebXR · Instalable · Funciona sin conexión</p>
  </footer>
`;

// --- Sesión 33: progreso del usuario (visto / favorito / nota cifrada) en IndexedDB ---
iniciarProgreso().catch((error) => console.error("Error al abrir IndexedDB:", error));

function porId<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

// --- Sesión 35: visor 3D controlado por sensores de orientación ---
const visor = crearVisor(porId("visor"));

// --- Sesión 40: panel del modelo y de la pieza elegida ---
const tabsModelo = porId("tabs-modelo");
const resumenModelo = porId("modelo-resumen");
const leyendaEl = porId("leyenda");
const chipsPiezas = porId("chips-piezas");
const detallePieza = porId("pieza-detalle");
let modeloActualId: string | null = null;
let piezaActual: string | null = null;
let fichaActual: Ficha | null = null;

function elegirModelo(id: string): void {
  const def = modeloPorId(id);
  if (!def) return;
  modeloActualId = id;
  piezaActual = null;
  fichaActual = null;
  visor.mostrarModelo(def);
  tabsModelo.innerHTML = CATALOGO.map((m) => `<button type="button" class="tab" data-id="${m.id}" aria-pressed="${m.id === id}">${m.nombre}</button>`).join("");
  tabsModelo.querySelectorAll<HTMLButtonElement>(".tab").forEach((b) => b.addEventListener("click", () => elegirModelo(b.dataset.id!)));
  resumenModelo.textContent = def.resumen;
  const roles = [...new Set(def.piezas.map((p) => p.rol))];
  leyendaEl.innerHTML = roles.map((r) => `<span class="leyenda-item"><i style="background:${ROLES[r].css}"></i>${ROLES[r].nombre}</span>`).join("");
  chipsPiezas.innerHTML = def.piezas.map((p) => `<button type="button" class="chip-pieza" data-id="${p.id}" aria-pressed="false"><i style="background:${ROLES[p.rol].css}"></i>${p.nombre}</button>`).join("");
  chipsPiezas.querySelectorAll<HTMLButtonElement>(".chip-pieza").forEach((b) =>
    b.addEventListener("click", () => {
      const nueva = piezaActual === b.dataset.id ? null : b.dataset.id!;
      visor.seleccionar(nueva);
      sincronizarPieza(nueva);
    }),
  );
  pintarDetalle();
  pintarPiezaAR();
  // La ficha ampliada llega de la caché (sin conexión) o de la red; si no hay ninguna, se usa solo el código.
  void leerFicha(id).then((f) => {
    if (modeloActualId !== id) return;
    fichaActual = f;
    pintarDetalle();
    pintarPiezaAR();
  });
}

/** Refleja en la interfaz la pieza que ya resaltó el visor. */
function sincronizarPieza(id: string | null): void {
  piezaActual = id;
  chipsPiezas.querySelectorAll<HTMLButtonElement>(".chip-pieza").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === id)));
  pintarDetalle();
  pintarPiezaAR();
}

function nombresDe(def: NonNullable<ReturnType<typeof modeloPorId>>, ids: string[]): string {
  return ids.map((x) => def.piezas.find((p) => p.id === x)?.nombre ?? x).join(", ");
}

function pintarDetalle(): void {
  const def = modeloPorId(modeloActualId ?? "");
  if (!def) return;
  const pieza = def.piezas.find((p) => p.id === piezaActual);
  const extra = pieza ? fichaActual?.piezas[pieza.id] : null;
  const sinFicha = fichaActual ? "" : '<p class="nota-ficha">Detalle ampliado no disponible: descarga las fichas (abajo) para leerlo sin conexión.</p>';
  if (pieza) {
    detallePieza.innerHTML =
      `<h3><i style="background:${ROLES[pieza.rol].css}"></i>${pieza.nombre} <small>${ROLES[pieza.rol].nombre}</small></h3>` +
      `<p>${pieza.resumen}</p>` +
      (extra ? `<p><b>Responsabilidad.</b> ${extra.responsabilidad}</p><p><b>Habla con:</b> ${nombresDe(def, extra.habla_con)}.</p>` : sinFicha);
  } else {
    detallePieza.innerHTML =
      "<p>Toca una pieza del modelo, o elígela en la lista, para ver qué hace. Toca la misma pieza otra vez para soltarla.</p>" +
      (fichaActual ? `<p><b>Cuándo usarlo.</b> ${fichaActual.cuando_usarlo}</p><p><b>Riesgo.</b> ${fichaActual.riesgo}</p>` : sinFicha);
  }
}

visor.alTocarPieza((id) => sincronizarPieza(id));

// Las tarjetas del catálogo: «Ver en 3D» lleva al visor; abrir una tarjeta también muestra su modelo.
document.querySelectorAll<HTMLButtonElement>(".btn-ver3d").forEach((b) =>
  b.addEventListener("click", () => {
    elegirModelo(b.dataset.id!);
    porId("visor").scrollIntoView({ block: "center", behavior: "smooth" });
  }),
);
document.querySelectorAll<HTMLElement>(".patron-card").forEach((t) =>
  t.querySelector(".patron-abrir")!.addEventListener("click", () => elegirModelo(t.dataset.id!)),
);
const btnOrientacion = porId<HTMLButtonElement>("btn-orientacion");
const btnCalibrar = porId<HTMLButtonElement>("btn-calibrar");
const lecturaVisor = porId("lectura-visor");
const avisoVisor = porId("aviso-visor");
let control: ControlOrientacion | null = null;
let timerLectura = 0;

function avisarVisor(texto: string) {
  avisoVisor.textContent = texto;
  avisoVisor.hidden = !texto;
}

function apagarSensores() {
  control?.detener();
  control = null;
  window.clearInterval(timerLectura);
  visor.controlPorSensores(false);
  lecturaVisor.textContent = "";
  btnCalibrar.disabled = true;
  btnOrientacion.textContent = "📱 Rotar con el teléfono";
  btnOrientacion.classList.remove("activo");
}

btnOrientacion.addEventListener("click", async () => {
  if (control) {
    apagarSensores(); // segundo clic: volver al control manual
    return;
  }
  const permiso = await pedirPermisoOrientacion(); // en iOS, dentro del clic
  // Dos mensajes distintos: «denegaste» (el usuario eligió no) y «no hay sensores» (el dispositivo no puede).
  if (permiso === "denied") {
    // Ojo: Chromium reciente también responde «denied» cuando es el navegador quien bloquea los sensores
    // (Brave lo hace por defecto), no solo cuando el usuario dice que no.
    avisarVisor("El acceso a los sensores fue denegado (por ti o por la configuración del navegador). Sigue disponible el control con ratón o dedo.");
    return;
  }
  if (permiso === "no-soportado" || !(await hayOrientacionReal())) {
    avisarVisor("Este dispositivo no tiene sensores de orientación. Usa el ratón o el dedo para girar el visor.");
    return;
  }
  avisarVisor("");
  visor.controlPorSensores(true);
  control = iniciarControlOrientacion((x, y) => visor.rotarHacia(x, y));
  btnCalibrar.disabled = false;
  btnOrientacion.textContent = "📱 Sensores: ACTIVOS (toca para apagar)";
  btnOrientacion.classList.add("activo");
  timerLectura = window.setInterval(() => {
    const { x, y } = visor.rotacionActualGrados();
    lecturaVisor.textContent = `rotación X ${x}° · Y ${y}°`;
  }, 150);
});
btnCalibrar.addEventListener("click", () => control?.calibrar());

// --- Sesión 36: cámara como fondo del visor ---
const videoFondo = porId<HTMLVideoElement>("fondo-camara");
const btnCamara = porId<HTMLButtonElement>("btn-camara");
let streamFondo: MediaStream | null = null;

function apagarCamara() {
  detenerCamaraDeFondo(videoFondo, streamFondo);
  streamFondo = null;
  videoFondo.hidden = true;
  visor.fondoTransparente(false);
  btnCamara.textContent = "📷 Cámara de fondo";
  btnCamara.classList.remove("activo");
}

btnCamara.addEventListener("click", async () => {
  if (streamFondo) {
    apagarCamara();
    return;
  }
  avisarVisor("");
  try {
    // El permiso se pide AQUÍ, dentro del clic — no al cargar la página.
    streamFondo = await iniciarCamaraDeFondo(videoFondo);
  } catch (err) {
    avisarVisor(describirErrorCamara(err));
    return;
  }
  videoFondo.hidden = false;
  visor.fondoTransparente(true);
  btnCamara.textContent = "📷 Cámara: ACTIVA (toca para apagar)";
  btnCamara.classList.add("activo");
});

// Una cámara abierta en segundo plano gasta batería y deja el LED encendido: se apaga al salir de la
// página, y NO se reactiva sola al volver (abrirla sin un clic es justo lo que la Sesión 24 enseñó a evitar).
document.addEventListener("visibilitychange", () => {
  if (document.hidden && streamFondo) {
    apagarCamara();
    avisarVisor("La cámara se apagó al salir de la página. Vuelve a activarla cuando quieras.");
  }
});

// --- Sesión 37: avisos y descarga de fichas para uso sin conexión ---
const btnAvisos = porId<HTMLButtonElement>("btn-avisos");
const btnDescargar = porId<HTMLButtonElement>("btn-descargar");
const estadoAvisosEl = porId("estado-avisos");
const estadoDescargaEl = porId("estado-descarga");
const progresoEl = porId<HTMLProgressElement>("progreso-descarga");
const dbLista = abrirBaseDeDatos();

function pintarEstadoAvisos() {
  const permiso = estadoAvisos();
  btnAvisos.disabled = permiso !== "default";
  estadoAvisosEl.textContent =
    permiso === "granted" ? "Avisos activos."
    : permiso === "denied" ? "Avisos bloqueados (cámbialo en la configuración del sitio)."
    : permiso === "no-soportado" ? "Este navegador no soporta notificaciones."
    : "Avisos sin activar.";
}
pintarEstadoAvisos();

btnAvisos.addEventListener("click", async () => {
  const permiso = await pedirPermisoAvisos(); // dentro del clic
  if (permiso === "granted") await mostrarAviso("Avisos activados", "Te avisaremos cuando las fichas estén listas.");
  pintarEstadoAvisos();
});

function pintarProgreso(hechos: number, total: number) {
  progresoEl.hidden = false;
  progresoEl.max = total;
  progresoEl.value = hechos;
  estadoDescargaEl.textContent =
    hechos >= total
      ? `✓ ${hechos} de ${total} fichas guardadas: ya puedes consultarlas sin conexión.`
      : `Descargando… ${hechos} de ${total} fichas.`;
}

// Marca en el catálogo las tarjetas cuya ficha ya está guardada en el dispositivo.
async function refrescarDescargados() {
  const db = await dbLista;
  const listas = new Set((await obtenerDescargas(db)).filter((d) => d.estado === "listo").map((d) => d.modeloId));
  document.querySelectorAll<HTMLElement>(".patron-card").forEach((tarjeta) => {
    const id = tarjeta.dataset.id!;
    const disponible = listas.has(id);
    tarjeta.classList.toggle("sin-conexion", disponible);
    tarjeta.querySelector(".estado")!.textContent = disponible
      ? "✓ Ficha disponible sin conexión"
      : "Modelo 3D disponible · ficha descargable";
  });
}
void refrescarDescargados();

// El SW informa el avance (y el final) a todas las ventanas abiertas.
navigator.serviceWorker?.addEventListener("message", (e) => {
  if (e.data?.tipo === "progreso") pintarProgreso(e.data.hechos, e.data.total);
  if (e.data?.tipo === "descarga-completa") void refrescarDescargados();
});

btnDescargar.addEventListener("click", async () => {
  const db = await dbLista;
  await encolarDescargas(db, FICHAS_DESCARGABLES);
  pintarProgreso(0, FICHAS_DESCARGABLES.length);
  btnDescargar.disabled = true;
  try {
    let enSegundoPlano = false;
    if ("serviceWorker" in navigator && "SyncManager" in window) {
      try {
        const reg = await navigator.serviceWorker.ready;
        await (reg as ServiceWorkerRegistration & { sync: { register(tag: string): Promise<void> } }).sync.register(ETIQUETA_SYNC);
        enSegundoPlano = true;
        estadoDescargaEl.textContent = "Descarga solicitada: el navegador la completará en cuanto haya conexión.";
      } catch {
        // Tener SyncManager no basta: register() falla (NotAllowedError) si el usuario bloqueó la
        // sincronización en segundo plano para este sitio.
        enSegundoPlano = false;
      }
    }
    if (!enSegundoPlano) {
      // Plan B (Safari, Firefox, o permiso denegado): se descarga desde la página, con la pestaña abierta.
      await descargarPendientes(db, pintarProgreso);
      await refrescarDescargados();
    }
  } catch (err) {
    estadoDescargaEl.textContent = "No se pudo completar la descarga: " + (err instanceof Error ? err.message : String(err));
  } finally {
    btnDescargar.disabled = false;
  }
});

// Una notificación puede abrir la app con ?modelo=ID para destacar esa tarjeta del catálogo.
const destacado = new URLSearchParams(location.search).get("modelo");
if (destacado) {
  const tarjeta = document.querySelector<HTMLElement>(`.patron-card[data-id="${CSS.escape(destacado)}"]`);
  tarjeta?.classList.add("destacada");
  tarjeta?.scrollIntoView({ block: "center" });
}

// Instalación: appinstalled se dispara cuando el usuario instala la PWA (acaba de cambiar de ventana).
window.addEventListener("appinstalled", () => {
  void mostrarAviso("Atlas 3D instalado", "Ya puedes abrirlo desde tu pantalla de inicio.", import.meta.env.BASE_URL, "atlas-instalado");
});

// --- Sesiones 38-40: realidad aumentada con WebXR (hit-test, anclas, gestos, piezas) ---
const btnAR = porId<HTMLButtonElement>("btn-ar");
const estadoAR = porId("estado-ar");
const overlayAR = porId("xr-overlay");
const btnSalirAR = porId<HTMLButtonElement>("btn-salir-ar");
const xrEstado = porId("xr-estado");
const xrDatos = porId("xr-datos");
const xrPieza = porId("xr-pieza");
const btnPiezaAnt = porId<HTMLButtonElement>("btn-pieza-ant");
const btnPiezaSig = porId<HTMLButtonElement>("btn-pieza-sig");
const diagAR = porId("diag-ar");
const detallesAR = document.querySelector<HTMLDetailsElement>(".diag-ar")!;
const btnRecomprobar = porId<HTMLButtonElement>("btn-recomprobar");
let sesionAR: XRSession | null = null;

// En AR un toque sobre el modelo coloca o recoloca: no puede elegir piezas. Se eligen con ◀ ▶
// (botones del overlay), que recorren las piezas una por una: ninguna → 1.ª → 2.ª … → ninguna.
function recorrerPiezas(paso: number): void {
  const def = modeloPorId(modeloActualId ?? "");
  if (!def) return;
  const ids: (string | null)[] = [null, ...def.piezas.map((p) => p.id)];
  const i = ids.indexOf(piezaActual);
  const siguiente = ids[(i + paso + ids.length) % ids.length];
  visor.seleccionar(siguiente);
  sincronizarPieza(siguiente);
}
btnPiezaAnt.addEventListener("click", () => recorrerPiezas(-1));
btnPiezaSig.addEventListener("click", () => recorrerPiezas(1));

function pintarPiezaAR(): void {
  const def = modeloPorId(modeloActualId ?? "");
  const pieza = def?.piezas.find((p) => p.id === piezaActual);
  const extra = pieza ? fichaActual?.piezas[pieza.id] : null;
  const texto = pieza ? `${pieza.nombre}: ${extra ? extra.responsabilidad : pieza.resumen}` : `${def?.nombre ?? "Modelo"}. Usa ◀ ▶ para recorrer sus piezas.`;
  if (xrPieza.textContent !== texto) xrPieza.textContent = texto;
}

// ¿Se puede? El botón solo se habilita si la respuesta es «disponible». Se pregunta al cargar, al pulsar
// «Comprobar de nuevo» y cuando el navegador avisa que cambió el dispositivo XR (p. ej. al activar el emulador).
async function comprobarAR(): Promise<void> {
  const { estado, lineas } = await diagnosticarAR();
  estadoAR.textContent = mensajeSoporteAR(estado);
  diagAR.textContent = [...lineas, sesionAR ? "Sesión de AR en curso." : describirRastro()].join("\n");
  if (!sesionAR) btnAR.disabled = estado !== "disponible";
  // Si no se puede (o la última sesión se interrumpió), el diagnóstico se muestra abierto.
  const rastro = leerRastro();
  detallesAR.open = estado !== "disponible" || (!sesionAR && rastro !== null && rastro.paso !== PASO_FINAL);
}
void comprobarAR();
btnRecomprobar.addEventListener("click", () => void comprobarAR());
navigator.xr?.addEventListener("devicechange", () => void comprobarAR());

// Texto de ayuda sobre la cámara según en qué punto va la colocación.
function ayudaAR(e: EstadoAR): string {
  if (!e.hitTest) return "Este dispositivo no ofrece hit-test: el modelo está a 1,5 m delante. Toca para traerlo delante de ti.";
  switch (e.fase) {
    case "buscando":
      return e.sinSuperficie
        ? "No encuentro superficies. Prueba con una zona con textura y buena luz, o toca la pantalla para colocar el modelo delante de ti."
        : "Mueve el teléfono despacio hasta ver el anillo verde sobre una superficie.";
    case "listo":
      return "Toca la pantalla para colocar el modelo.";
    case "colocado":
      return e.overlay
        ? "Arrastra para moverlo, gira con dos dedos, pellizca para el tamaño. Toca otro punto para recolocarlo."
        : "Modelo colocado. Toca otro punto para recolocarlo.";
  }
}

// Cada cambio del texto del overlay obliga al navegador a volver a dibujarlo encima de la cámara, y eso
// cuesta. Por eso: (1) solo se escribe si el texto cambió y (2) como máximo cada 200 ms.
const INTERVALO_OVERLAY_MS = 200;
let ultimoPintado = 0;
let pendienteAR: EstadoAR | null = null;
let temporizadorAR = 0;

function pintarEstadoAR(e: EstadoAR): void {
  const si = (v: boolean) => (v ? "sí" : "no");
  const { x, y, z } = e.posicion;
  const pos = e.fase === "colocado" ? `(${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}) m` : "—";
  const ayuda = ayudaAR(e);
  const datos =
    `hit-test: ${si(e.hitTest)} · anclas: ${si(e.anclas)} · anclado: ${si(e.anclado)} · ` +
    `fase: ${e.fase} · escala: ${e.escala.toFixed(2)} · giro: ${e.giroGrados}° · pos: ${pos} · ` +
    `consultas: ${e.consultas} · resultados: ${e.resultados} · poses: ${e.impactos}`;
  if (xrEstado.textContent !== ayuda) xrEstado.textContent = ayuda;
  if (xrDatos.textContent !== datos) xrDatos.textContent = datos;
}

function mostrarEstadoAR(e: EstadoAR): void {
  if (performance.now() - ultimoPintado >= INTERVALO_OVERLAY_MS) {
    ultimoPintado = performance.now();
    pintarEstadoAR(e);
    return;
  }
  pendienteAR = e; // se pintará el último estado cuando venza el intervalo
  if (temporizadorAR) return;
  temporizadorAR = window.setTimeout(() => {
    temporizadorAR = 0;
    ultimoPintado = performance.now();
    if (pendienteAR) pintarEstadoAR(pendienteAR);
    pendienteAR = null;
  }, INTERVALO_OVERLAY_MS);
}

btnAR.addEventListener("click", async () => {
  avisarVisor("");
  // La sesión AR abre la cámara por su cuenta: la cámara de fondo (Sesión 36) y la AR no pueden convivir.
  // Los sensores (Sesión 35) también se apagan: la sesión XR ya entrega la orientación real del teléfono.
  apagarCamara();
  apagarSensores();
  try {
    // La petición ocurre DENTRO del clic: es el gesto del usuario que exige WebXR.
    const sesion = await pedirSesionAR(overlayAR);
    sesionAR = sesion;
    btnAR.disabled = true;
    const estado = await visor.entrarEnAR(sesion, {
      overlay: overlayAR,
      alCambiar: mostrarEstadoAR,
      alTerminar: () => {
        sesionAR = null;
        btnAR.disabled = false;
        estadoAR.textContent = "La sesión de realidad aumentada terminó.";
        void comprobarAR();
      },
    });
    // Alguna función se pidió como opcional: aquí se ve cuáles concedió de verdad el navegador.
    const faltan = [!estado.overlay && "dom-overlay", !estado.hitTest && "hit-test", !estado.anclas && "anchors"].filter(Boolean);
    estadoAR.textContent = faltan.length
      ? `Sesión de realidad aumentada activa. El navegador no concedió: ${faltan.join(", ")}.`
      : "Sesión de realidad aumentada activa con hit-test, anclas y botones sobre la cámara.";
  } catch (err) {
    sesionAR?.end().catch(() => {});
    sesionAR = null;
    btnAR.disabled = false;
    avisarVisor(describirErrorAR(err));
  }
});

// Un toque sobre un botón del overlay NO debe contar como «tocar para colocar»: el navegador avisa
// con `beforexrselect` y basta cancelarlo.
[btnSalirAR, btnPiezaAnt, btnPiezaSig].forEach((b) => b.addEventListener("beforexrselect", (e) => e.preventDefault()));

// Un único camino de salida: end() dispara el listener «end» del visor, que restaura todo.
btnSalirAR.addEventListener("click", () => {
  void sesionAR?.end();
});

// --- Sesión 41: instalación y estado de conexión ---
const btnInstalar = porId<HTMLButtonElement>("btn-instalar");
const estadoInstalacionEl = porId("estado-instalacion");
const estadoConexionEl = porId("estado-conexion");

const TEXTO_INSTALACION = {
  instalada: "✓ Estás usando Atlas 3D como app instalada.",
  recienInstalada: "✓ Instalada. Ábrela desde su icono en la pantalla de inicio.",
  instalable: "Puedes instalarla: se abre a pantalla completa, desde su icono, y funciona sin conexión.",
  ios: "En iPhone y iPad no hay botón: en Safari toca Compartir y luego «Añadir a pantalla de inicio».",
  noDisponible: "Este navegador no ofrece instalar desde la página. Si ya la instalaste, ábrela desde su icono; si no, usa el menú del navegador → «Instalar app».",
  rechazada: "Cancelaste la instalación. Chrome decide cuándo volver a ofrecerla; mientras tanto, usa el menú ⋮ → «Instalar app».",
};

function pintarInstalacion(): void {
  const estado = estadoInstalacion();
  btnInstalar.hidden = estado !== "instalable";
  estadoInstalacionEl.textContent =
    estado === "instalada" ? TEXTO_INSTALACION.instalada
    : estado === "recien-instalada" ? TEXTO_INSTALACION.recienInstalada
    : estado === "instalable" ? TEXTO_INSTALACION.instalable
    : estado === "ios" ? TEXTO_INSTALACION.ios
    : instalacionRechazada() ? TEXTO_INSTALACION.rechazada
    : TEXTO_INSTALACION.noDisponible;
}

btnInstalar.addEventListener("click", async () => {
  btnInstalar.disabled = true;
  try {
    await pedirInstalacion(); // el resultado lo pinta pintarInstalacion() vía iniciarInstalacion
  } finally {
    btnInstalar.disabled = false;
  }
});
iniciarInstalacion(pintarInstalacion);

let estuvoSinConexion = false;
let temporizadorConexion: number | undefined;
iniciarConexion((enLinea) => {
  window.clearTimeout(temporizadorConexion);
  if (!enLinea) {
    estuvoSinConexion = true;
    estadoConexionEl.hidden = false;
    estadoConexionEl.textContent = "Sin conexión: los modelos y las fichas descargadas siguen disponibles.";
  } else if (estuvoSinConexion) {
    estuvoSinConexion = false;
    estadoConexionEl.hidden = false;
    estadoConexionEl.textContent = "Volvió la conexión.";
    temporizadorConexion = window.setTimeout(() => {
      estadoConexionEl.hidden = true;
    }, 3000);
  } else {
    estadoConexionEl.hidden = true;
  }
});

// --- Sesión 34: registro del Service Worker con virtual:pwa-register ---
// (sustituye a navigator.serviceWorker.register("/sw.js") de la Sesión 17/28; desde la Sesión 37 el SW es src/sw.ts)
const estadoSwEl = porId<HTMLSpanElement>("estado-sw");

if ("serviceWorker" in navigator) {
  registerSW({
    immediate: true,
    onOfflineReady() {
      // Primera vez que el precaché quedó completo. El usuario está mirando: basta con la pantalla.
      estadoDescargaEl.textContent = "✓ La app ya funciona sin conexión.";
      if (document.visibilityState !== "visible") {
        void mostrarAviso("Atlas 3D listo", "Ya funciona sin conexión.", import.meta.env.BASE_URL, "atlas-offline");
      }
    },
    onRegisteredSW(swUrl, registration) {
      console.log("SW de Workbox registrado:", swUrl, registration);
      estadoSwEl.textContent = "Service Worker: activo";
      estadoSwEl.classList.add("activo");
    },
    onRegisterError(error) {
      console.error("Error al registrar el SW de Workbox:", error);
      estadoSwEl.textContent = "Service Worker: error al registrar";
      estadoSwEl.classList.add("error");
    },
  });
} else {
  estadoSwEl.textContent = "Este navegador no soporta Service Workers";
  estadoSwEl.classList.add("error");
}

// Sesión 40: al arrancar se muestra el primer modelo (o el que pida ?modelo=ID desde una notificación).
elegirModelo(modeloPorId(destacado ?? "") ? destacado! : CATALOGO[0].id);
