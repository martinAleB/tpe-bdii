import { Router } from "express";
import db from "../mongo-client.js";

const router = Router();
const COLL_NAME = "agentes";
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
          localField: "id_agente",
          foreignField: "id_agente",
          as: "polizas",
        },
      },
      {
        $addFields: {
          polizas: { $size: "$polizas" },
        },
      },
      {
        $project: {
          _id: 0,
          nombre: 1,
          apellido: 1,
          matricula: 1,
          polizas: 1,
        },
      },
    ];
    const activeAgentes = await db.collection(COLL_NAME).aggregate(pipeline).toArray();
    res.json(activeAgentes);
  } catch (err) {
    console.error("Error fetching active agentes", err);
    res.status(500).json({ error: "Failed to fetch active agentes" });
  }
});


export default router;
