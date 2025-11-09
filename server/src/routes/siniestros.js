import { Router } from "express";
import db from "../mongo-client.js";

const router = Router();
const COLL_NAME = "siniestros";
const POLIZAS_COLL = "polizas";
const CLIENTES_COLL = "clientes";

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

export default router;