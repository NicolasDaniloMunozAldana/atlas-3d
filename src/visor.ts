// Sesiones 35-38 — visor de Three.js del Atlas 3D.
// El catálogo real de modelos 3D (dominio, vista, controlador) todavía no existe, así que el visor
// muestra un CUBO DE PRUEBA, y la pantalla lo dice: inventar un .glb que no está en el proyecto sería
// peor. El resto de la app no sabe nada de Three.js: solo usa esta interfaz.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export interface Visor {
  /** Fija la rotación objetivo del modelo (radianes). El visor la alcanza suavemente. */
  rotarHacia(rotX: number, rotY: number): void;
  /** true: los sensores mandan (se apaga el ratón/dedo). false: control manual. */
  controlPorSensores(activo: boolean): void;
  /** Rotación actual del modelo, en grados (para mostrarla en pantalla). */
  rotacionActualGrados(): { x: number; y: number };
  /** Sesión 36 — true: sin color de fondo (se ve el video detrás). false: fondo oscuro. */
  fondoTransparente(activo: boolean): void;
  /** Sesión 38 — pasa el render a una sesión WebXR. `alTerminar` se llama cuando esa sesión se cierra. */
  entrarEnAR(sesion: XRSession, alTerminar: () => void): Promise<void>;
  /** true mientras hay una sesión AR abierta. */
  enAR(): boolean;
  destruir(): void;
}

// Más bajo = más suave pero con más retraso; más alto = más reactivo pero tiembla más.
const SUAVIZADO = 0.15;

export function crearVisor(contenedor: HTMLElement): Visor {
  const escena = new THREE.Scene();
  const COLOR_FONDO = new THREE.Color(0x11062d);
  escena.background = COLOR_FONDO;

  const camara = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camara.position.set(2.4, 1.8, 3.2); // en diagonal: el cubo se ve en 3D desde el primer fotograma

  // Sesión 36: alpha se decide AL CREAR el renderer (el contexto WebGL no se puede cambiar después).
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0); // limpiar con alfa 0 = transparente
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  contenedor.append(renderer.domElement);

  escena.add(new THREE.AmbientLight(0xffffff, 0.6));
  const luz = new THREE.DirectionalLight(0xffffff, 1.2);
  luz.position.set(3, 4, 5);
  escena.add(luz);

  const grupo = new THREE.Group();
  const cubo = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 1.6, 1.6),
    new THREE.MeshStandardMaterial({ color: 0x68eeb4, roughness: 0.45 }),
  );
  const aristas = new THREE.LineSegments(
    new THREE.EdgesGeometry(cubo.geometry),
    new THREE.LineBasicMaterial({ color: 0x11062d }),
  );
  grupo.add(cubo, aristas);
  escena.add(grupo);

  // Respaldo sin sensores: el control manual es la base y los sensores el atajo (mejora progresiva).
  const controles = new OrbitControls(camara, renderer.domElement);
  controles.enableDamping = true;
  controles.enablePan = false;

  let objetivoX = 0;
  let objetivoY = 0;
  let porSensores = false;

  function ajustarTamano() {
    const ancho = contenedor.clientWidth || 320;
    const alto = contenedor.clientHeight || ancho;
    renderer.setSize(ancho, alto);
    camara.aspect = ancho / alto;
    camara.updateProjectionMatrix();
  }
  ajustarTamano();
  window.addEventListener("resize", ajustarTamano);

  let animacion = 0;
  function bucle() {
    animacion = requestAnimationFrame(bucle);
    if (porSensores) {
      // Interpolación: cada fotograma avanza un 15 % de lo que falta (filtra el temblor del sensor).
      grupo.rotation.x += (objetivoX - grupo.rotation.x) * SUAVIZADO;
      grupo.rotation.y += (objetivoY - grupo.rotation.y) * SUAVIZADO;
    }
    controles.update();
    renderer.render(escena, camara);
  }
  bucle();

  // --- Sesión 38: modo AR ---
  let sesionAR: XRSession | null = null;

  async function entrarEnAR(sesion: XRSession, alTerminar: () => void) {
    cancelAnimationFrame(animacion); // en AR NO manda requestAnimationFrame: manda el reloj de la sesión XR
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType("local");
    await renderer.xr.setSession(sesion);
    sesionAR = sesion;

    const fondoPrevio = escena.background;
    escena.background = null; // la cámara real es el fondo: no se pinta nada detrás
    controles.enabled = false;
    // Las unidades son metros: un cubo de 1,6 m sería gigante. Se reduce a ~40 cm y se pone 1,5 m
    // delante (−Z), un poco por debajo de la vista. En el espacio «local» el origen es el usuario.
    const posicionPrevia = grupo.position.clone();
    const escalaPrevia = grupo.scale.clone();
    grupo.position.set(0, -0.2, -1.5);
    grupo.scale.setScalar(0.25);

    renderer.setAnimationLoop(() => {
      grupo.rotation.y += 0.01; // prueba de vida: el cubo gira solo
      renderer.render(escena, camara);
    });

    sesion.addEventListener(
      "end",
      () => {
        renderer.setAnimationLoop(null);
        renderer.xr.enabled = false;
        sesionAR = null;
        escena.background = fondoPrevio;
        controles.enabled = !porSensores;
        grupo.position.copy(posicionPrevia);
        grupo.scale.copy(escalaPrevia);
        grupo.rotation.set(0, 0, 0);
        ajustarTamano(); // la sesión XR cambió el tamaño del canvas
        bucle(); // vuelve el requestAnimationFrame normal
        alTerminar();
      },
      { once: true }, // la sesión termina una sola vez: el listener no se acumula al entrar varias veces
    );
  }

  const aGrados = (r: number) => Math.round((r * 180) / Math.PI);
  return {
    rotarHacia(x, y) {
      objetivoX = x;
      objetivoY = y;
    },
    controlPorSensores(activo) {
      // Dos controles peleando por el mismo modelo se ven fatal: con sensores, OrbitControls se apaga.
      porSensores = activo;
      controles.enabled = !activo;
      if (!activo) {
        objetivoX = 0;
        objetivoY = 0;
        grupo.rotation.set(0, 0, 0);
      }
    },
    rotacionActualGrados() {
      return { x: aGrados(grupo.rotation.x), y: aGrados(grupo.rotation.y) };
    },
    fondoTransparente(activo) {
      escena.background = activo ? null : COLOR_FONDO;
    },
    entrarEnAR,
    enAR() {
      return sesionAR !== null;
    },
    destruir() {
      cancelAnimationFrame(animacion);
      void sesionAR?.end();
      window.removeEventListener("resize", ajustarTamano);
      controles.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
