import { Router } from "express";
import db from "../mongo-client.js";

const router = Router();
const COLL_NAME = "vehiculos";
const CLIENTES_COLL = "clientes";
const POLIZAS_COLL = "polizas";

router.get("/insured", async (req, res) => {
  try {
    const pipeline = [
      {
        $match: {
          $or: [{ asegurado: true }, { asegurado: "True" }],
        },
      },
      {
        $lookup: {
          from: CLIENTES_COLL,
          let: { vehiculoCliente: { $toString: "$id_cliente" } },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [{ $toString: "$id_cliente" }, "$$vehiculoCliente"],
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
        $lookup: {
          from: POLIZAS_COLL,
          let: { vehiculoCliente: { $toString: "$id_cliente" } },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [{ $toString: "$id_cliente" }, "$$vehiculoCliente"],
                },
              },
            },
            {
              $project: {
                _id: 0,
                nro_poliza: 1,
              },
            },
          ],
          as: "polizas",
        },
      },
      { $unwind: "$polizas" },
      {
        $project: {
          _id: 0,
          patente: 1,
          cliente: "$cliente",
          poliza: "$polizas.nro_poliza",
        },
      },
    ];

    const insuredVehicles = await db.collection(COLL_NAME).aggregate(pipeline).toArray();
    res.json(insuredVehicles);
  } catch (err) {
    console.error("Error fetching insured vehicles", err);
    res.status(500).json({ error: "Failed to fetch insured vehicles" });
  }
});

export default router;