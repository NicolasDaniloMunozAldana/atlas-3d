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
import { crearVisor } from "./visor";
import { pedirPermisoOrientacion, hayOrientacionReal, iniciarControlOrientacion } from "./sensores";
import type { ControlOrientacion } from "./sensores";
import { iniciarCamaraDeFondo, detenerCamaraDeFondo, describirErrorCamara } from "./camara";
import { estadoAvisos, pedirPermisoAvisos, mostrarAviso } from "./avisos";
import { ETIQUETA_SYNC, FICHAS_DESCARGABLES, descargarPendientes } from "./descargas";
import { diagnosticarAR, mensajeSoporteAR, pedirSesionAR, describirErrorAR } from "./xr";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <header class="nav-bar">
    <div class="nav-brand">
      <span class="nav-dot" aria-hidden="true"></span>
      <span>Atlas 3D</span>
    </div>
    <span id="estado-sw" class="sw-badge">Service Worker: comprobando…</span>
  </header>

  <section class="hero">
    <p class="hero-eyebrow">Módulo AR · Sub-bloque B · Sesión 38</p>
    <h1>Atlas 3D de Arquitectura de Software</h1>
    <p>Catálogo interactivo en 3D de patrones y arquitecturas de software, con soporte de realidad aumentada. El proyecto se construye desde cero, sesión a sesión.</p>
  </section>

  <section class="visor-zona" aria-label="Visor 3D">
    <div class="visor-barra">
      <button type="button" id="btn-orientacion" class="btn-visor">📱 Rotar con el teléfono</button>
      <button type="button" id="btn-calibrar" class="btn-visor" disabled>Calibrar</button>
      <button type="button" id="btn-camara" class="btn-visor">📷 Cámara de fondo</button>
      <button type="button" id="btn-ar" class="btn-visor destacado" disabled>🥽 Ver en AR</button>
    </div>
    <p id="aviso-visor" class="aviso-visor" role="status" hidden></p>
    <div class="escena-contenedor" id="escena">
      <video id="fondo-camara" class="fondo-camara" playsinline muted hidden></video>
    </div>
    <span id="lectura-visor" class="lectura-visor"></span>
    <p id="estado-ar" class="estado-ar" role="status">Comprobando realidad aumentada…</p>
    <details class="diag-ar">
      <summary>Diagnóstico de realidad aumentada</summary>
      <pre id="diag-ar" class="diag-ar-texto"></pre>
      <button type="button" id="btn-recomprobar" class="btn-nota secundario">Comprobar de nuevo</button>
    </details>
    <p class="aviso-demo">Visor de prueba: un cubo, no un modelo real. Con la cámara de fondo NO es realidad aumentada: el cubo solo se dibuja encima del video. «Ver en AR» abre una sesión WebXR real, pero el cubo aún no se apoya en ninguna superficie.</p>
  </section>

  <section class="catalogo">
    <h2>Los 8 patrones del catálogo</h2>
    <div class="catalogo-grid">
      ${PATRONES.map(
        (patron, i) => `
        <article class="patron-card" data-id="${patron.id}">
          <div class="patron-top">
            <span class="numero">0${i + 1}</span>
            <button type="button" class="btn-fav" aria-pressed="false" aria-label="Marcar ${patron.nombre} como favorito">☆</button>
          </div>
          <button type="button" class="patron-abrir">${patron.nombre}</button>
          <span class="estado">Modelo 3D · Próximamente</span>
          <span class="visita">Sin visitar</span>
        </article>`
      ).join("")}
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

  <div id="xr-overlay" class="xr-overlay">
    <p id="xr-estado">Sesión de realidad aumentada activa</p>
    <button type="button" id="btn-salir-ar">Salir de AR</button>
  </div>

  <footer class="pie">
    <p>Vite + TypeScript + Three.js + Workbox + WebXR · Instalable como aplicación</p>
  </footer>
`;

// --- Sesión 33: progreso del usuario (visto / favorito / nota cifrada) en IndexedDB ---
iniciarProgreso().catch((error) => console.error("Error al abrir IndexedDB:", error));

function porId<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

// --- Sesión 35: visor 3D controlado por sensores de orientación ---
const visor = crearVisor(porId("escena"));
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
      : FICHAS_DESCARGABLES.includes(id) ? "Ficha descargable · Modelo 3D próximamente" : "Modelo 3D · Próximamente";
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

// --- Sesión 38: realidad aumentada con WebXR ---
const btnAR = porId<HTMLButtonElement>("btn-ar");
const estadoAR = porId("estado-ar");
const overlayAR = porId("xr-overlay");
const btnSalirAR = porId<HTMLButtonElement>("btn-salir-ar");
const diagAR = porId("diag-ar");
const detallesAR = document.querySelector<HTMLDetailsElement>(".diag-ar")!;
const btnRecomprobar = porId<HTMLButtonElement>("btn-recomprobar");
let sesionAR: XRSession | null = null;

// ¿Se puede? El botón solo se habilita si la respuesta es «disponible». Se pregunta al cargar, al pulsar
// «Comprobar de nuevo» y cuando el navegador avisa que cambió el dispositivo XR (p. ej. al activar el emulador).
async function comprobarAR(): Promise<void> {
  const { estado, lineas } = await diagnosticarAR();
  estadoAR.textContent = mensajeSoporteAR(estado);
  diagAR.textContent = lineas.join("\n");
  if (!sesionAR) btnAR.disabled = estado !== "disponible";
  // Si no se puede, el diagnóstico se muestra abierto para ver qué comprobación falló.
  detallesAR.open = estado !== "disponible";
}
void comprobarAR();
btnRecomprobar.addEventListener("click", () => void comprobarAR());
navigator.xr?.addEventListener("devicechange", () => void comprobarAR());

btnAR.addEventListener("click", async () => {
  avisarVisor("");
  // La sesión AR abre la cámara por su cuenta: la cámara de fondo (Sesión 36) y la AR no pueden convivir.
  // Los sensores (Sesión 35) también se apagan: la sesión XR ya entrega la orientación real del teléfono.
  // Ambas llamadas son síncronas, así que no consumen el «gesto del usuario».
  apagarCamara();
  apagarSensores();
  try {
    // La petición ocurre DENTRO del clic: es el gesto del usuario que exige WebXR.
    const sesion = await pedirSesionAR(overlayAR);
    sesionAR = sesion;
    btnAR.disabled = true;
    await visor.entrarEnAR(sesion, () => {
      sesionAR = null;
      btnAR.disabled = false;
      estadoAR.textContent = "La sesión de realidad aumentada terminó.";
    });
    // domOverlayState existe solo si el navegador concedió la función «dom-overlay».
    estadoAR.textContent = sesion.domOverlayState
      ? "Sesión de realidad aumentada activa. Usa «Salir de AR» sobre la cámara."
      : "Sesión de realidad aumentada activa. Este navegador no mostró el botón sobre la cámara: sal con el gesto de salida del sistema.";
  } catch (err) {
    sesionAR?.end().catch(() => {});
    sesionAR = null;
    btnAR.disabled = false;
    avisarVisor(describirErrorAR(err));
  }
});

// Un único camino de salida: end() dispara el listener «end» del visor, que restaura todo.
btnSalirAR.addEventListener("click", () => {
  void sesionAR?.end();
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
