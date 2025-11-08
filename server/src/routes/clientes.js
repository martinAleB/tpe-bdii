import { Router } from "express";
import db from "../mongo-client.js";

const router = Router();
const COLL_NAME = "clientes";
const POLIZAS_COLL = "polizas";

router.get("/active", async (req, res) => {
    try {
    const pipeline = [
      {
        $match: {
          $or: [{ activo: true }, { activo: "True" }],
        },
      },
      {
        $lookup: {
          from: POLIZAS_COLL,
          let: { clienteId: "$id_cliente" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$id_cliente", "$$clienteId"] },
              },
            },
            {
              $match: {
                $or: [{ estado: "Activa" }, { estado: "Vigente" }],
              },
            },
            {
              $project: {
                _id: 0,
                nro_poliza: 1,
              },
            },
          ],
          as: "polizasVigentes",
        },
      },
      {
        $match: {
          "polizasVigentes.0": { $exists: true },
        },
      },
      {
        $project: {
          _id: 0,
          nombre: 1,
          apellido: 1,
          polizasVigentes: 1,
        },
      },
    ];

    const clientesActivos = await db.collection(COLL_NAME).aggregate(pipeline).toArray();
    res.json(clientesActivos);
  } catch (err) {
    console.error("Error fetching active clientes", err);
    res.status(500).json({ error: "Failed to fetch active clientes" });
  }
});

router.get("/no-active-policies", async (req, res) => {
  try {
    const pipeline = [
      {
        $lookup: {
          from: POLIZAS_COLL,
          let: { clienteId: { $toString: "$id_cliente" } },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [{ $toString: "$id_cliente" }, "$$clienteId"],
                },
              },
            },
            {
              $match: {
                estado: { $in: ["Activa", "Vigente"] },
              },
            },
            {
              $project: {
                _id: 0,
                nro_poliza: 1,
              },
            },
          ],
          as: "polizasActivas",
        },
      },
      {
        $match: {
          "polizasActivas.0": { $exists: false },
        },
      },
      {
        $project: {
          _id: 0,
          nombre: 1,
          apellido: 1,
        },
      },
    ];

    const clientesSinPolizas = await db.collection(COLL_NAME).aggregate(pipeline).toArray();
    res.json(clientesSinPolizas);
  } catch (err) {
    console.error("Error fetching clientes sin pólizas activas", err);
    res.status(500).json({ error: "Failed to fetch clientes sin pólizas activas" });
  }
});

export default router;