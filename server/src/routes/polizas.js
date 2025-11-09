import { Router } from "express";
import db from "../mongo-client.js";

const router = Router();
const COLL_NAME = "polizas";
const CLIENTES_COLL = "clientes";

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
export default router;
