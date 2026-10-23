export interface PatronCatalogo {
  id: string; // se usa como modeloId en IndexedDB
  nombre: string;
}

export const PATRONES: PatronCatalogo[] = [
  { id: "arquitectura-en-capas", nombre: "Arquitectura en Capas" },
  { id: "mvc", nombre: "MVC" },
  { id: "arbol-binario", nombre: "Árbol Binario" },
  { id: "cliente-servidor", nombre: "Cliente-Servidor" },
  { id: "cliente-cache-servidor", nombre: "Cliente-Caché-Servidor" },
  { id: "microservicios", nombre: "Microservicios" },
  { id: "publicador-suscriptor", nombre: "Publicador-Suscriptor" },
  { id: "repositorio", nombre: "Repositorio" },
];
