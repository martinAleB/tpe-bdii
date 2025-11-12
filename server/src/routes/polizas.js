import { Router } from "express";
import db from "../mongo-client.js";
import redis from "../redis-client.js";

const router = Router();
const COLL_NAME = "polizas";
const CLIENTES_COLL = "clientes";
const AGENTES_COLL = "agentes";
/**
 * @swagger
 * /api/polizas/expired:
 *   get:
 *     summary: Obtiene pólizas vencidas con info de cliente
 *     tags: [Polizas]
 *     responses:
 *       200:
 *         description: Lista de pólizas vencidas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   nro_poliza:
 *                     type: string
 *                   fecha_fin:
 *                     type: string
 *                     format: date-time
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
router.get("/expired", async (req, res) => {
    try {
        const pipeline = [
            {
                $match: {
                    estado: "Vencida"
                }
            },
            {
                $lookup: {
                    from: CLIENTES_COLL,
                    let: { polizaCliente: { $toString: "$id_cliente" } },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $eq: [{ $toString: "$id_cliente" }, "$$polizaCliente"]
                                }
                            }
                        },
                        {
                            $project: {
                                _id: 0,
                                nombre: 1,
                                apellido: 1
                            }
                        }
                    ],
                    as: "cliente"
                }
            },
            { $unwind: "$cliente" },
            {
                $project: {
                    _id: 0,
                    nro_poliza: 1,
                    fecha_fin: 1,
                    cliente: { nombre: "$cliente.nombre", apellido: "$cliente.apellido" }
                }
            }
        ];
        const expiredPolizas = await db.collection(COLL_NAME).aggregate(pipeline).toArray();
        res.json(expiredPolizas);
    } catch (err) {
        console.error("Error fetching expired polizas", err);
        res.status(500).json({ error: "Failed to fetch expired polizas" });
    }
});

/**
 * @swagger
 * /api/polizas/active-by-date:
 *   get:
 *     summary: Obtiene pólizas activas ordenadas por fecha de inicio
 *     tags: [Polizas]
 *     responses:
 *       200:
 *         description: Lista de pólizas activas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Poliza'
 *       500:
 *         description: Error del servidor
 */
router.get("/active-by-date", async (req, res) => {
  try {
    const pipeline = [
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
          estado:1,
        },
      },
    ];

    const polizas = await db.collection(COLL_NAME).aggregate(pipeline).toArray();
    res.json(polizas);
  } catch (err) {
    console.error("Error fetching pólizas activas", err);
    res.status(500).json({ error: "Failed to fetch pólizas activas" });
  }
});
/**
 * @swagger
 * /api/polizas/suspended-with-client-info:
 *   get:
 *     summary: Obtiene pólizas suspendidas con información del cliente
 *     tags: [Polizas]
 *     responses:
 *       200:
 *         description: Lista de pólizas suspendidas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id_poliza:
 *                     type: integer
 *                   id_cliente:
 *                     type: integer
 *                   fecha_inicio:
 *                     type: string
 *                     format: date-time
 *                   fecha_fin:
 *                     type: string
 *                     format: date-time
 *                   prima_mensual:
 *                     type: number
 *                   estado:
 *                     type: string
 *                   cobertura_total:
 *                     type: number
 *                   cliente:
 *                     type: object
 *                     properties:
 *                       nombre:
 *                         type: string
 *                       apellido:
 *                         type: string
 *                       activo:
 *                         type: boolean
 *       500:
 *         description: Error del servidor
 */
router.get("/suspended-with-client-info", async (req, res) => {
  try {
    const pipeline = [
      {
        $match: {
          estado: "Suspendida",
        },
      },
      {
        $lookup: {
          from: CLIENTES_COLL,
          localField: "id_cliente",
          foreignField: "id_cliente",
          as: "cliente",
        },
      },
      {
        $unwind: "$cliente",
      },
      {
        $project: {
          _id: 0,
          id_poliza: 1,
          id_cliente: 1,
          fecha_inicio: 1,
          fecha_fin: 1,
          prima_mensual: 1,
          estado: 1,
          cobertura_total: 1,
          "cliente.nombre": 1,
          "cliente.apellido": 1,
          "cliente.activo": 1,
        },
      },
    ];

    const suspendidas = await db.collection(COLL_NAME).aggregate(pipeline).toArray();
    res.json(suspendidas);
  } catch (err) {
    console.error("Error fetching pólizas suspendidas", err);
    res.status(500).json({ error: "Failed to fetch pólizas suspendidas" });
  }
});
/**
 * @swagger
 * /api/polizas:
 *   post:
 *     summary: Emite una nueva póliza
 *     tags: [Polizas]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id_cliente:
 *                 type: integer
 *               id_agente:
 *                 type: integer
 *               tipo:
 *                 type: string
 *               fecha_inicio:
 *                 type: string
 *                 format: date
 *               fecha_fin:
 *                 type: string
 *                 format: date
 *               prima_mensual:
 *                 type: number
 *               cobertura_total:
 *                 type: number
 *               estado:
 *                 type: string
 *                 description: Opcional. "Activa", "Vencida" o "Suspendida". Default "Activa".
 *             required:
 *               - id_cliente
 *               - id_agente
 *               - tipo
 *               - fecha_inicio
 *               - fecha_fin
 *               - prima_mensual
 *               - cobertura_total
 *     responses:
 *       201:
 *         description: Póliza emitida correctamente
 *       400:
 *         description: Datos inválidos, faltan campos, cliente/agente no activo, o fechas/montos incorrectos
 *       500:
 *         description: Error del servidor
 */
router.post("/", async (req, res) => {
  try {
    const {
      id_cliente,
      id_agente,
      tipo,
      fecha_inicio,
      fecha_fin,
      prima_mensual,
      cobertura_total,
      estado,
    } = req.body;

    if (
      !id_cliente ||
      !id_agente ||
      !tipo ||
      !fecha_inicio ||
      !fecha_fin ||
      !prima_mensual ||
      !cobertura_total
    ) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    const cliente = await db.collection(CLIENTES_COLL).findOne({
      id_cliente: parseInt(id_cliente),
      activo: true,
    });

    if (!cliente) {
      return res
        .status(400)
        .json({ error: "El cliente no existe o no está activo" });
    }

    const agente = await db.collection(AGENTES_COLL).findOne({
      id_agente: parseInt(id_agente),
      activo: true,
    });

    if (!agente) {
      return res
        .status(400)
        .json({ error: "El agente no existe o no está activo" });
    }

    const inicio = new Date(fecha_inicio);
    const fin = new Date(fecha_fin);

    if (isNaN(inicio) || isNaN(fin) || inicio >= fin) {
      return res.status(400).json({
        error: "Las fechas deben ser válidas y fecha_inicio < fecha_fin",
      });
    }

    const prima = parseFloat(prima_mensual);
    const cobertura = parseFloat(cobertura_total);

    if (isNaN(prima) || prima <= 0 || isNaN(cobertura) || cobertura <= 0) {
      return res
        .status(400)
        .json({ error: "Los montos deben ser valores numéricos positivos" });
    }

    const estadosValidos = ["Activa", "Vencida", "Suspendida"];
    const estadoFinal = estado ? estado.trim() : "Activa";

    if (!estadosValidos.includes(estadoFinal)) {
      return res.status(400).json({
        error: `Estado inválido. Debe ser uno de: ${estadosValidos.join(", ")}`,
      });
    }

    const nextNumber = (await db.collection(COLL_NAME).countDocuments()) + 1001;
    const nro_poliza = `POL${nextNumber}`;

    const nuevaPoliza = {
      nro_poliza,
      id_cliente: parseInt(id_cliente),
      id_agente: parseInt(id_agente),
      tipo,
      fecha_inicio: inicio,
      fecha_fin: fin,
      prima_mensual: prima,
      cobertura_total: cobertura,
      estado: estadoFinal,
    };

    await db.collection(COLL_NAME).insertOne(nuevaPoliza);

    await redis.zincrby(
      "ranking:cobertura_total",
      cobertura_total,
      id_cliente.toString()
    );

    res.status(201).json({
      message: "Póliza emitida correctamente",
      poliza: nuevaPoliza,
    });
  } catch (err) {
    console.error("Error al emitir póliza:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});
export default router;
