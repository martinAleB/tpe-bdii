import { Router } from "express";
import db from "../mongo-client.js";

const router = Router();
const COLL_NAME = "agentes";
const POLIZAS_COLL = "polizas";
const SINIESTROS_COLL = "siniestros";

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
          _id: "$id_agente",
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


router.get("/with-sinisters-count", async (req, res) => {
  try {
    const pipeline = [
      
      {
        $lookup: {
          from: POLIZAS_COLL,
          localField: "id_agente",
          foreignField: "id_agente",
          as: "polizas_docs",
        },
      },
      {
        $unwind: "$polizas_docs",
      },
      {
        $lookup: {
          from: SINIESTROS_COLL,
          localField: "polizas_docs.nro_poliza", 
          foreignField: "nro_poliza",         
          as: "siniestros_docs",
        },
      },
      {
        $unwind: "$siniestros_docs",
      },
      {
        $group: {
          _id: "$id_agente",
          nombre: { $first: "$nombre" },
          apellido: { $first: "$apellido" },
          matricula: { $first: "$matricula" },
          telefono: { $first: "$telefono" },
          email: { $first: "$email" },
          siniestros: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          id_agente: "$_id",
          nombre: 1,
          apellido: 1,
          matricula: 1,
          telefono: 1,
          email: 1,
          siniestros: 1,
        },
      },
    ];

    const agentesWithSinisters = await db.collection(COLL_NAME).aggregate(pipeline).toArray();
    res.json(agentesWithSinisters);

  } catch (err)
  {
    console.error("Error fetching agentes with sinisters count", err);
    res.status(500).json({ error: "Failed to fetch agentes with sinisters count" });
  }
});

router.get("/with-sinisters-count", async (req, res) => {
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
          as: "polizas_docs",
        },
      },
      {
        $unwind: "$polizas_docs",
      },
      {
        $lookup: {
          from: SINIESTROS_COLL,
          localField: "polizas_docs.nro_poliza", 
          foreignField: "nro_poliza",          
          as: "siniestros_docs",
        },
      },
      {
        $unwind: "$siniestros_docs",
      },
      {
        $group: {
          _id: "$id_agente",
          nombre: { $first: "$nombre" },
          apellido: { $first: "$apellido" },
          matricula: { $first: "$matricula" },
          telefono: { $first: "$telefono" },
          email: { $first: "$email" },
          siniestros: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          id_agente: "$_id",
          nombre: 1,
          apellido: 1,
          matricula: 1,
          telefono: 1,
          email: 1,
          siniestros: 1,
        },
      },
    ];

    const agentesWithSinisters = await db.collection(COLL_NAME).aggregate(pipeline).toArray();
    res.json(agentesWithSinisters);

  } catch (err)
  {
    console.error("Error fetching agentes with sinisters count", err);
    res.status(500).json({ error: "Failed to fetch agentes with sinisters count" });
  }
});



export default router;
