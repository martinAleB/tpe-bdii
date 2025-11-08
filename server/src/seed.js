import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CSV_DIR = path.resolve(__dirname, "../../data/csv");

const COLLECTION_SOURCES = [
  { collection: "agentes", file: "agentes.csv" },
  { collection: "polizas", file: "polizas.csv" },
  { collection: "clientes", file: "clientes.csv" },
  { collection: "siniestros", file: "siniestros.csv" },
  { collection: "vehiculos", file: "vehiculos.csv" },
];

export async function seedDatabase(db) {
  await Promise.all(
    COLLECTION_SOURCES.map((source) => seedCollection(db, source))
  );
}

async function seedCollection(db, { collection, file }) {
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

  const documents = parseCsv(csvRaw);
  if (!documents.length) {
    console.warn(`[seed] ${file} no contenía filas para importar.`);
    return;
  }

  await db.collection(collection).insertMany(documents);
  console.log(
    `[seed] Insertados ${documents.length} documentos en ${collection}`
  );
}

function parseCsv(csvText) {
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
    const values = line
      .split(",")
      .map((value) => (value ?? "").trim());
    const doc = {};
    headers.forEach((header, index) => {
      doc[header] = normalizeValue(header, values[index]);
    });
    return doc;
  });
}

function normalizeValue(field, rawValue = "") {
  const value = rawValue.trim();
  if (field === "activo") {
    const normalized = value.toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return value;
}
