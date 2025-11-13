import { Router } from "express";
import db from "../mongo-client.js";

const router = Router();
const COLL_NAME = "siniestros";
const POLIZAS_COLL = "polizas";
const CLIENTES_COLL = "clientes";
const ESTADOS_VALIDOS = ["Abierto", "En evaluación", "Cerrado"];
/**
 * @swagger
 * /api/siniestros/open:
 *   get:
 *     summary: Obtiene siniestros abiertos con info de cliente
 *     tags: [Siniestros]
 *     responses:
 *       200:
 *         description: Lista de siniestros abiertos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   fecha:
 *                     type: string
 *                     format: date-time
 *                   tipo:
 *                     type: string
 *                   monto:
 *                     type: number
 *                   cliente:
 *                     type: object
 *                     properties:
 *                       nombre:
 *                         type: string
 *                       apellido:
 *                         type: string
 *       500:
 *         description: Error del servidor
 */
router.get("/open", async (req, res) => {
  try {
    const pipeline = [
      {
        $match: {
          estado: { $regex: /^abierto$/i },
        },
      },
      {
        $lookup: {
          from: POLIZAS_COLL,
          let: { siniestroPoliza: "$nro_poliza" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$nro_poliza", "$$siniestroPoliza"] },
              },
            },
            {
              $project: {
                _id: 0,
                id_cliente: 1,
              },
            },
          ],
          as: "poliza",
        },
      },
      { $unwind: "$poliza" },
      {
        $lookup: {
          from: CLIENTES_COLL,
          let: { clienteId: "$poliza.id_cliente" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [
                    { $toString: "$id_cliente" },
                    { $toString: "$$clienteId" },
                  ],
                },
              },
            },
            {
              $project: {
                _id: 0,
                nombre: 1,
                apellido: 1,
              },
            },
          ],
          as: "cliente",
        },
      },
      { $unwind: "$cliente" },
      {
        $project: {
          _id: 0,
          fecha: 1,
          tipo: 1,
          monto: "$monto_estimado",
          cliente: "$cliente",
        },
      },
    ];

    const openedClaims = await db.collection(COLL_NAME).aggregate(pipeline).toArray();
    res.json(openedClaims);
  } catch (err) {
    console.error("Error fetching opened siniestros", err);
    res.status(500).json({ error: "Failed to fetch opened siniestros" });
  }
});
/**
 * @swagger
 * /api/siniestros/accidents-last-year:
 *   get:
 *     summary: Obtiene accidentes ocurridos en el último año
 *     tags: [Siniestros]
 *     responses:
 *       200:
 *         description: Lista de accidentes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id_siniestro:
 *                     type: integer
 *                   tipo:
 *                     type: string
 *                   fecha:
 *                     type: string
 *                     format: date-time
 *                   monto_estimado:
 *                     type: number
 *       500:
 *         description: Error del servidor
 */
router.get("/accidents-last-year", async (req, res) => {
  try {
    const now = new Date();
    const lastYear = new Date(now);
    lastYear.setFullYear(now.getFullYear() - 1);

    const pipeline = [
      {
        $match: {
          tipo: "Accidente",
          fecha: { $gte: lastYear },
        },
      },
      {
        $project: {
          _id: 0,
          id_siniestro: 1,
          tipo: 1,
          fecha: 1,
          monto_estimado: 1,
        },
      },
    ];

    const accidentes = await db.collection(COLL_NAME).aggregate(pipeline).toArray();
    res.json(accidentes);
  } catch (err) {
    console.error("Error fetching accidentes del último año", err);
    res.status(500).json({ error: "Failed to fetch accidentes del último año" });
  }
});
/**
 * @swagger
 * /api/siniestros:
 *   post:
 *     summary: Registra un nuevo siniestro
 *     tags: [Siniestros]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nro_poliza:
 *                 type: string
 *               fecha:
 *                 type: string
 *                 format: date
 *               tipo:
 *                 type: string
 *               monto_estimado:
 *                 type: number
 *               descripcion:
 *                 type: string
 *               estado:
 *                 type: string
 *                 description: Opcional. "Abierto", "En evaluación" o "Cerrado". Default "Abierto".
 *             required:
 *               - nro_poliza
 *               - fecha
 *               - tipo
 *               - monto_estimado
 *               - descripcion
 *     responses:
 *       201:
 *         description: Siniestro registrado correctamente
 *       400:
 *         description: Datos inválidos, faltan campos, o la póliza no está activa/vigente
 *       500:
 *         description: Error del servidor
 */
router.post("/", async (req, res) => {
  try {
    const {
      nro_poliza,
      fecha,
      tipo,
      monto_estimado,
      descripcion,
      estado,
    } = req.body;

    if (!nro_poliza || !fecha || !tipo || !monto_estimado || !descripcion) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    const poliza = await db.collection(POLIZAS_COLL).findOne({
      nro_poliza: nro_poliza.trim(),
      estado: { $in: ["Activa", "Vigente"] },
    });

    if (!poliza) {
      return res.status(400).json({
        error: "La póliza no existe o no está activa/vigente",
      });
    }

    const estadoFinal = estado ? estado.trim() : "Abierto";

    if (!estadosValidos.includes(estadoFinal)) {
      return res.status(400).json({
        error: `Estado inválido. Debe ser uno de: ${ESTADOS_VALIDOS.join(", ")}`,
      });
    }

    const nextId =
      (await db.collection(COLL_NAME).countDocuments()) + 1;

    const fechaParsed = new Date(fecha);
    const montoParsed = parseFloat(monto_estimado);

    const nuevoSiniestro = {
      id_siniestro: nextId,
      nro_poliza: nro_poliza.trim(),
      fecha: fechaParsed,
      tipo,
      monto_estimado: montoParsed,
      descripcion,
      estado: estado || "Abierto",
    };

    await db.collection(COLL_NAME).insertOne(nuevoSiniestro);

    res.status(201).json({
      message: "Siniestro registrado correctamente",
      siniestro: nuevoSiniestro,
    });
  } catch (err) {
    console.error("Error al registrar siniestro:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

export default router;