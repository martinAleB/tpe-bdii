import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CSV_DIR = path.resolve(__dirname, "../../data/csv");
const POLIZAS_COLLECTION = "polizas";
const ACTIVE_POLIZAS_VIEW = "vw_polizas_activas_por_fecha";
const ACTIVE_POLIZAS_PIPELINE = [
  {
    $match: {
      estado: { $in: ["Activa"] },
    },
  },
  {
    $sort: {
      fecha_inicio: 1,
    },
  },
  {
    $project: {
      _id: 0,
      id_poliza: 1,
      id_cliente: 1,
      id_agente: 1,
      fecha_inicio: 1,
      fecha_fin: 1,
      prima_mensual: 1,
      cobertura_total: 1,
      estado: 1,
    },
  },
];

const COLLECTION_SOURCES = [
  {
    collection: "agentes",
    file: "agentes.csv",
    transform: (doc) => ({
      ...doc,
      id_agente: toInteger(doc.id_agente),
      activo: toBoolean(doc.activo),
    }),
  },
  {
    collection: "polizas",
    file: "polizas.csv",
    transform: (doc) => ({
      ...doc,
      id_cliente: toInteger(doc.id_cliente),
      id_agente: toInteger(doc.id_agente),
      fecha_inicio: toDate(doc.fecha_inicio),
      fecha_fin: toDate(doc.fecha_fin),
      prima_mensual: toDecimal(doc.prima_mensual),
      cobertura_total: toDecimal(doc.cobertura_total),
      estado: doc.estado,
    }),
  },
  {
    collection: "clientes",
    file: "clientes.csv",
    transform: (doc) => ({
      ...doc,
      id_cliente: toInteger(doc.id_cliente),
      dni: toInteger(doc.dni),
      activo: toBoolean(doc.activo),
    }),
  },
  {
    collection: "siniestros",
    file: "siniestros.csv",
    transform: (doc) => ({
      ...doc,
      id_siniestro: toInteger(doc.id_siniestro),
      fecha: toDate(doc.fecha),
      monto_estimado: toDecimal(doc.monto_estimado),
    }),
  },
  {
    collection: "vehiculos",
    file: "vehiculos.csv",
    transform: (doc) => ({
      ...doc,
      id_vehiculo: toInteger(doc.id_vehiculo),
      id_cliente: toInteger(doc.id_cliente),
      anio: toInteger(doc.anio),
      asegurado: toBoolean(doc.asegurado),
    }),
  },
];

export async function seedDatabase(db) {
  await Promise.all(
    COLLECTION_SOURCES.map((source) => seedCollection(db, source))
  );
  await ensureActivePolizasView(db);
}

async function seedCollection(db, { collection, file, transform }) {
  const existingDocs = await db.collection(collection).estimatedDocumentCount();
  if (existingDocs > 0) {
    return;
  }

  const filePath = path.join(CSV_DIR, file);
  let csvRaw;
  try {
    csvRaw = await readFile(filePath, "utf8");
  } catch (err) {
    console.warn(`[seed] No se pudo leer ${filePath}: ${err.message}`);
    return;
  }

  const documents = parseCsv(csvRaw, transform);
  if (!documents.length) {
    console.warn(`[seed] ${file} no contenía filas para importar.`);
    return;
  }

  await db.collection(collection).insertMany(documents);
  console.log(
    `[seed] Insertados ${documents.length} documentos en ${collection}`
  );
}

async function ensureActivePolizasView(db) {
  const cursor = db.listCollections({
    name: ACTIVE_POLIZAS_VIEW,
    type: "view",
  });
  if (await cursor.hasNext()) {
    return;
  }

  try {
    await db.command({
      create: ACTIVE_POLIZAS_VIEW,
      viewOn: POLIZAS_COLLECTION,
      pipeline: ACTIVE_POLIZAS_PIPELINE,
    });
    console.log(`[seed] Vista ${ACTIVE_POLIZAS_VIEW} creada correctamente.`);
  } catch (err) {
    if (err.codeName === "NamespaceExists") {
      return;
    }
    console.error(
      `[seed] No se pudo crear la vista ${ACTIVE_POLIZAS_VIEW}: ${err.message}`
    );
  }
}

function parseCsv(csvText, transform = identity) {
  const sanitized = csvText.replace(/^\uFEFF/, "");
  const lines = sanitized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    return [];
  }

  const headers = lines[0].split(",").map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((value) => (value ?? "").trim());
    const doc = headers.reduce((acc, header, index) => {
      acc[header] = values[index] ?? "";
      return acc;
    }, {});
    return transform(doc) ?? doc;
  });
}

const identity = (doc) => doc;

function toInteger(rawValue = "") {
  const parsed = Number.parseInt(rawValue, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function toDecimal(rawValue = "") {
  const normalized = rawValue.replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

function toBoolean(rawValue = "") {
  const normalized = rawValue.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
}

function toDate(rawValue = "") {
  const [day, month, year] = rawValue
    .split("/")
    .map((part) => Number.parseInt(part, 10));
  if (
    [day, month, year].some(
      (value) => Number.isNaN(value) || value === undefined
    )
  ) {
    return null;
  }
  return new Date(Date.UTC(year, month - 1, day));
}
