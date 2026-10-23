// Sesión 33 — conecta el progreso (IndexedDB) con las 8 tarjetas del catálogo:
// clic en el nombre = modelo visto, ★ = favorito, y una nota de estudio cifrada por modelo.
import { PATRONES } from "./catalogo";
import {
  abrirBaseDeDatos,
  marcarModeloVisto,
  alternarFavorito,
  obtenerFavoritos,
  obtenerRecientes,
  obtenerProgreso,
  obtenerTodoElProgreso,
  guardarNotaDeEstudio,
  leerNotaDeEstudio,
  obtenerConfig,
  guardarConfig,
} from "./db";
import type { RegistroProgreso } from "./db";
import { derivarClaveDesdeContrasena, generarSal, crearVerificador, verificarClave } from "./crypto";
import type { TextoCifrado } from "./crypto";

function porId(id: string): HTMLElement {
  return document.getElementById(id)!;
}

function nombreDe(modeloId: string): string {
  return PATRONES.find((p) => p.id === modeloId)?.nombre ?? modeloId;
}

function hace(marca: number): string {
  const segundos = Math.max(0, Math.round((Date.now() - marca) / 1000));
  if (segundos < 60) return "hace unos segundos";
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  return `hace ${Math.round(horas / 24)} d`;
}

export async function iniciarProgreso(): Promise<void> {
  const db = await abrirBaseDeDatos();
  let clave: CryptoKey | null = null;
  let modeloSeleccionado: string | null = null;

  const panelNota = porId("nota-estudio");
  const tituloNota = porId("nota-titulo");
  const estadoNota = porId("nota-estado");
  const formClave = porId("form-clave-atlas") as HTMLFormElement;
  const inputClave = porId("input-clave-atlas") as HTMLInputElement;
  const textoNota = porId("nota-texto") as HTMLTextAreaElement;
  const botonGuardar = porId("btn-guardar-nota") as HTMLButtonElement;
  const botonBloquear = porId("btn-bloquear-atlas") as HTMLButtonElement;
  const mensajeNota = porId("nota-mensaje");

  function mensaje(texto: string, tipo: "ok" | "error" | "info" = "info") {
    mensajeNota.textContent = texto;
    mensajeNota.dataset.tipo = tipo;
  }

  function pintarChips(contenedorId: string, registros: RegistroProgreso[], vacio: string) {
    const contenedor = porId(contenedorId);
    contenedor.innerHTML = "";
    if (registros.length === 0) {
      const p = document.createElement("span");
      p.className = "chips-vacio";
      p.textContent = vacio;
      contenedor.appendChild(p);
      return;
    }
    for (const registro of registros) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = nombreDe(registro.modeloId);
      chip.addEventListener("click", () => abrirModelo(registro.modeloId));
      contenedor.appendChild(chip);
    }
  }

  function pintarTarjeta(registro: RegistroProgreso | undefined, modeloId: string) {
    const tarjeta = document.querySelector<HTMLElement>(`.patron-card[data-id="${modeloId}"]`);
    if (!tarjeta) return;
    const esFavorito = registro?.favorito === 1;
    const boton = tarjeta.querySelector<HTMLButtonElement>(".btn-fav")!;
    boton.textContent = esFavorito ? "★" : "☆";
    boton.setAttribute("aria-pressed", String(esFavorito));
    boton.classList.toggle("activo", esFavorito);
    tarjeta.querySelector(".visita")!.textContent = registro?.ultimaVisita ? `Visto ${hace(registro.ultimaVisita)}` : "Sin visitar";
    tarjeta.classList.toggle("seleccionada", modeloId === modeloSeleccionado);
  }

  async function refrescar() {
    const todo = await obtenerTodoElProgreso(db);
    for (const patron of PATRONES) pintarTarjeta(todo.find((r) => r.modeloId === patron.id), patron.id);
    pintarChips("recientes", await obtenerRecientes(db, 3), "Aún no has visto ningún modelo.");
    pintarChips("favoritos", await obtenerFavoritos(db), "Marca un modelo con ★ para verlo aquí.");
  }

  function actualizarEstadoClave() {
    const desbloqueada = clave !== null;
    estadoNota.textContent = desbloqueada ? "Notas desbloqueadas" : "Notas bloqueadas";
    estadoNota.classList.toggle("desbloqueado", desbloqueada);
    formClave.hidden = desbloqueada;
    botonBloquear.hidden = !desbloqueada;
    textoNota.disabled = !desbloqueada;
    botonGuardar.disabled = !desbloqueada;
  }

  async function cargarNotaDelModelo() {
    textoNota.value = "";
    if (!modeloSeleccionado || !clave) return;
    const registro = await obtenerProgreso(db, modeloSeleccionado);
    if (registro?.notaCifrada) {
      try {
        textoNota.value = (await leerNotaDeEstudio(clave, registro)) ?? "";
        mensaje("Nota descifrada con tu contraseña.", "ok");
      } catch {
        mensaje("No se pudo descifrar la nota con la clave actual.", "error");
      }
    }
  }

  async function abrirModelo(modeloId: string) {
    modeloSeleccionado = modeloId;
    await marcarModeloVisto(db, modeloId);
    panelNota.hidden = false;
    tituloNota.textContent = `Nota de estudio — ${nombreDe(modeloId)}`;
    mensaje(clave ? "" : "Desbloquea con tu contraseña para leer o escribir la nota.", "info");
    await refrescar();
    await cargarNotaDelModelo();
  }

  // --- Eventos de las tarjetas ---
  for (const patron of PATRONES) {
    const tarjeta = document.querySelector<HTMLElement>(`.patron-card[data-id="${patron.id}"]`);
    if (!tarjeta) continue;
    tarjeta.querySelector(".patron-abrir")!.addEventListener("click", () => abrirModelo(patron.id));
    tarjeta.querySelector(".btn-fav")!.addEventListener("click", async () => {
      await alternarFavorito(db, patron.id);
      await refrescar();
    });
  }

  // --- Contraseña y nota cifrada ---
  formClave.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const contrasena = inputClave.value;
    inputClave.value = "";
    if (!contrasena) return;

    let sal = await obtenerConfig<Uint8Array<ArrayBuffer>>(db, "sal");
    let verificador = await obtenerConfig<TextoCifrado>(db, "verificador");
    if (!sal) {
      sal = generarSal();
      await guardarConfig(db, "sal", sal);
    }
    const candidata = await derivarClaveDesdeContrasena(contrasena, sal);

    if (!verificador) {
      await guardarConfig(db, "verificador", await crearVerificador(candidata));
      clave = candidata;
      mensaje("Contraseña creada. Tus notas de estudio se cifrarán con ella.", "ok");
    } else if (await verificarClave(candidata, verificador)) {
      clave = candidata;
      mensaje("Notas desbloqueadas.", "ok");
    } else {
      mensaje("Contraseña incorrecta.", "error");
      return;
    }
    actualizarEstadoClave();
    await cargarNotaDelModelo();
  });

  botonBloquear.addEventListener("click", () => {
    clave = null;
    textoNota.value = "";
    actualizarEstadoClave();
    mensaje("Notas bloqueadas.", "info");
  });

  botonGuardar.addEventListener("click", async () => {
    if (!clave || !modeloSeleccionado) return;
    await guardarNotaDeEstudio(db, clave, modeloSeleccionado, textoNota.value);
    mensaje("Nota guardada cifrada (AES-GCM) en IndexedDB.", "ok");
  });

  actualizarEstadoClave();
  await refrescar();
}
