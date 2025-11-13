import { Router } from "express";
import db from "../mongo-client.js";
import redis from "../redis-client.js";

const router = Router();
const COLL_NAME = "clientes";
const POLIZAS_COLL = "polizas";
const VEHICULOS_COLL = "vehiculos";
/**
 * @swagger
 * /api/clientes/multiple-vehicles:
 *   get:
 *     summary: Obtiene clientes con más de un vehículo asegurado
 *     tags: [Clientes]
 *     responses:
 *       200:
 *         description: Lista de clientes con múltiples vehículos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id_cliente:
 *                     type: integer
 *                   nombre:
 *                     type: string
 *                   apellido:
 *                     type: string
 *                   cantidad_vehiculos_asegurados:
 *                     type: integer
 *       500:
 *         description: Error del servidor
 */
router.get("/multiple-vehicles", async (req, res) => {
  try {
    const pipeline = [
      {
        $lookup: {
          from: VEHICULOS_COLL,
          let: { clienteIdStr: { $toString: "$id_cliente" } },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [{ $toString: "$id_cliente" }, "$$clienteIdStr"]
                }
              }
            }
          ],
          as: "vehiculos",
        },
      },
      {
        $addFields: {
          vehiculos_asegurados: {
            $filter: {
              input: "$vehiculos",
              as: "v",
              cond: {
                $or: [
                  { $eq: ["$$v.asegurado", true] },
                  { $eq: ["$$v.asegurado", "True"] }
                ]
              },
            },
          },
        },
      },
      {
        $match: {
          $expr: { $gt: [{ $size: "$vehiculos_asegurados" }, 1] },
        },
      },
      {
        $project: {
          _id: 0,
          id_cliente: 1,
          nombre: 1,
          apellido: 1,
          cantidad_vehiculos_asegurados: { $size: "$vehiculos_asegurados" },
        },
      },
    ];

    const clientes = await db.collection(COLL_NAME).aggregate(pipeline).toArray();
    res.json(clientes);
  } catch (err) {
    console.error("Error fetching clientes con múltiples vehículos", err);
    res.status(500).json({ error: "Failed to fetch clientes con múltiples vehículos" });
  }
});
/**
 * @swagger
 * /api/clientes/active:
 *   get:
 *     summary: Obtiene clientes activos que tienen al menos una póliza vigente
 *     tags: [Clientes]
 *     responses:
 *       200:
 *         description: Lista de clientes activos con pólizas vigentes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: integer
 *                     description: id_cliente
 *                   nombre:
 *                     type: string
 *                   apellido:
 *                     type: string
 *                   polizasVigentes:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         nro_poliza:
 *                           type: string
 *       500:
 *         description: Error del servidor
 */
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
          _id: "$id_cliente",
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

/**
 * @swagger
 * /api/clientes/top-cobertura:
 *   get:
 *     summary: Obtiene el top 10 de clientes por monto total de cobertura
 *     tags: [Clientes]
 *     description: Este endpoint utiliza caché (Redis) por 60 segundos.
 *     responses:
 *       200:
 *         description: Top 10 clientes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 top10:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id_cliente:
 *                         type: integer
 *                       cobertura_total:
 *                         type: number
 *                       nombre:
 *                         type: string
 *                       apellido:
 *                         type: string
 *       404:
 *         description: No hay pólizas cargadas
 *       500:
 *         description: Error del servidor
 */
router.get("/top-cobertura", async (req, res) => {
  try {
    const cacheKey = "ranking:cobertura_total";

    const cached = await redis.zrevrange(cacheKey, 0, 9, "WITHSCORES");

    if (cached && cached.length > 0) {
      const ranking = [];
      for (let i = 0; i < cached.length; i += 2) {
        ranking.push({
          id_cliente: parseInt(cached[i]),
          cobertura_total: parseFloat(cached[i + 1]),
        });
      }

      const clientesIds = ranking.map((r) => r.id_cliente);
      const clientes = await db
        .collection(COLL_NAME)
        .find({ id_cliente: { $in: clientesIds } })
        .project({ _id: 0, id_cliente: 1, nombre: 1, apellido: 1 })
        .toArray();

      const resultado = ranking.map((r) => ({
        ...r,
        ...clientes.find((c) => c.id_cliente === r.id_cliente),
      }));

      return res.json({
        top10: resultado,
      });
    }

    const pipeline = [
      {
        $group: {
          _id: "$id_cliente",
          cobertura_total: { $sum: "$cobertura_total" },
        },
      },
      { $sort: { cobertura_total: -1 } },
      { $limit: 10 },
    ];

    const topClientes = await db
      .collection(POLIZAS_COLL)
      .aggregate(pipeline)
      .toArray();

    if (topClientes.length === 0) {
      return res.status(404).json({ message: "No hay pólizas cargadas" });
    }

    const redisData = [];
    topClientes.forEach((c) => {
      redisData.push(c.cobertura_total, c._id.toString());
    });

    if (redisData.length > 0) {
      await redis.zadd(cacheKey, ...redisData);
      await redis.expire(cacheKey, 60);
    }

    const clientesIds = topClientes.map((c) => c._id);
    const clientes = await db
      .collection(COLL_NAME)
      .find({ id_cliente: { $in: clientesIds } })
      .project({ _id: 0, id_cliente: 1, nombre: 1, apellido: 1 })
      .toArray();

    const resultado = topClientes.map((c) => ({
      id_cliente: c._id,
      cobertura_total: c.cobertura_total,
      ...clientes.find((cl) => cl.id_cliente === c._id),
    }));

    res.json({
      top10: resultado,
    });
  } catch (err) {
    console.error("Error al obtener top 10 clientes:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});
/**
 * @swagger
 * /api/clientes/no-active-policies:
 *   get:
 *     summary: Obtiene clientes que no tienen ninguna póliza activa o vigente
 *     tags: [Clientes]
 *     responses:
 *       200:
 *         description: Lista de clientes sin pólizas activas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   nombre:
 *                     type: string
 *                   apellido:
 *                     type: string
 *       500:
 *         description: Error del servidor
 */
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
          _id: "$id_cliente",
          nombre: 1,
          apellido: 1,
          activo: 1,
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
/**
 * @swagger
 * /api/clientes:
 *   post:
 *     summary: Agrega un nuevo cliente
 *     tags: [Clientes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *               apellido:
 *                 type: string
 *               dni:
 *                 type: integer
 *               email:
 *                 type: string
 *               telefono:
 *                 type: string
 *               direccion:
 *                 type: string
 *               ciudad:
 *                 type: string
 *               provincia:
 *                 type: string
 *             required:
 *               - nombre
 *               - apellido
 *               - dni
 *               - email
 *     responses:
 *       201:
 *         description: Cliente agregado correctamente
 *       400:
 *         description: Faltan campos obligatorios o datos inválidos (DNI, email, nombre)
 *       409:
 *         description: Ya existe un cliente con ese DNI o email
 *       500:
 *         description: Error del servidor
 */

router.post("/", async (req, res) => {
  try {
    const {
      nombre,
      apellido,
      dni,
      email,
      telefono,
      direccion,
      ciudad,
      provincia,
    } = req.body;

    //@todo: Chequear si existen campos obligatorios
    if (!nombre || !apellido || !dni || !email) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    const nombreRegex = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/;
    if (!nombreRegex.test(nombre) || !nombreRegex.test(apellido)) {
      return res
        .status(400)
        .json({ error: "El nombre y apellido deben contener solo letras" });
    }

    const dniNum = parseInt(dni);
    if (Number.isNaN(dniNum) || dniNum < 0 || dniNum > 99999999) {
      return res
        .status(400)
        .json({ error: "El DNI debe ser un número de hasta 8 dígitos" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res
        .status(400)
        .json({ error: "El email no tiene un formato válido" });
    }

    // @todo: Chequear la necesidad de validar existencia previa
    const existing = await db.collection(COLL_NAME).findOne({
      $or: [{ dni: parseInt(dni) }, { email }],
    });
    if (existing) {
      return res
        .status(409)
        .json({ error: "Ya existe un cliente con ese DNI o email" });
    }

    const nextId =
      (await db.collection(COLL_NAME).countDocuments()) + 1;

    const newCliente = {
      id_cliente: nextId,
      nombre,
      apellido,
      dni: parseInt(dni),
      email,
      telefono,
      direccion,
      ciudad,
      provincia,
      activo: true,
    };

    await db.collection(COLL_NAME).insertOne(newCliente);
    res.status(201).json({
      message: "Cliente agregado correctamente",
      cliente: newCliente,
    });
  } catch (err) {
    console.error("Error al agregar cliente:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});
/**
 * @swagger
 * /api/clientes/{id_cliente}:
 *   delete:
 *     summary: Da de baja (lógica) a un cliente por ID
 *     tags: [Clientes]
 *     parameters:
 *       - in: path
 *         name: id_cliente
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID del cliente
 *     responses:
 *       200:
 *         description: Cliente dado de baja correctamente
 *       400:
 *         description: No se puede dar de baja (cliente con pólizas activas o vehículos)
 *       404:
 *         description: Cliente no encontrado
 *       500:
 *         description: Error del servidor
 */
router.delete("/:id_cliente", async (req, res) => {
  try {
    const id_cliente = parseInt(req.params.id_cliente);

    /*@todo: Chequear necesidad de ver si tiene pólizas o vehículos asociados*/
    const polizaActiva = await db.collection(POLIZAS_COLL).findOne({
      id_cliente,
      estado: "Activa",
    });      

  
    if (polizaActiva) {
      return res.status(400).json({
        error:
          "No se puede dar de baja un cliente con pólizas activas o vigentes",
      });
    }

    const vehiculoAsociado = await db.collection(VEHICULOS_COLL).findOne({
      id_cliente,
    });

    if (vehiculoAsociado) {
      return res.status(400).json({
        error: "No se puede dar de baja un cliente con vehículos asociados",
      });
    }

    const result = await db.collection(COLL_NAME).updateOne(
      { id_cliente },
      { $set: { activo: false } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    res.json({ message: "Cliente dado de baja correctamente" });
  } catch (err) {
    console.error("Error al dar de baja cliente:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});
/**
 * @swagger
 * /api/clientes/{id_cliente}:
 *   get:
 *     summary: Obtiene un cliente por su ID
 *     tags: [Clientes]
 *     parameters:
 *       - in: path
 *         name: id_cliente
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID del cliente
 *     responses:
 *       200:
 *         description: Datos del cliente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cliente'
 *       404:
 *         description: Cliente no encontrado
 *       500:
 *         description: Error del servidor
 */

router.get("/:id_cliente", async (req, res) => {
  try {
    const id_cliente = parseInt(req.params.id_cliente);

    const cliente = await db.collection(COLL_NAME).findOne(
      { id_cliente },
      { projection: { _id: 0 } } // ocultamos el _id interno de Mongo
    );

    if (!cliente) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    res.json(cliente);
  } catch (err) {
    console.error("Error al obtener cliente:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});
/**
 * @swagger
 * /api/clientes/{id_cliente}:
 *   put:
 *     summary: Actualiza los datos de un cliente por ID
 *     tags: [Clientes]
 *     parameters:
 *       - in: path
 *         name: id_cliente
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID del cliente
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Campos a actualizar (al menos uno)
 *             properties:
 *               nombre:
 *                 type: string
 *               apellido:
 *                 type: string
 *               dni:
 *                 type: string
 *               email:
 *                 type: string
 *               telefono:
 *                 type: string
 *               direccion:
 *                 type: string
 *               ciudad:
 *                 type: string
 *               provincia:
 *                 type: string
 *               activo:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Cliente actualizado correctamente
 *       400:
 *         description: No se enviaron campos o los datos son inválidos (DNI, email, nombre)
 *       404:
 *         description: Cliente no encontrado
 *       409:
 *         description: DNI o email ya están registrados por otro cliente
 *       500:
 *         description: Error del servidor
 */

router.put("/:id_cliente", async (req, res) => {
    try {
      const id_cliente = parseInt(req.params.id_cliente);
      const updates = req.body;

      delete updates.id_cliente;

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No se enviaron campos para actualizar" });
      }

      const nombreRegex = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (updates.nombre && !nombreRegex.test(updates.nombre)) {
        return res
          .status(400)
          .json({ error: "El nombre debe contener solo letras" });
      }
      if (updates.apellido && !nombreRegex.test(updates.apellido)) {
        return res
          .status(400)
          .json({ error: "El apellido debe contener solo letras" });
      }

      if (updates.dni !== undefined) {
        const dniNum = parseInt(updates.dni);
        if (Number.isNaN(dniNum) || dniNum < 0 || dniNum > 99999999) {
          return res
            .status(400)
            .json({ error: "El DNI debe ser un número de hasta 8 dígitos" });
        }
        updates.dni = dniNum;
      }

      if (updates.email && !emailRegex.test(updates.email)) {
        return res
          .status(400)
          .json({ error: "El email no tiene un formato válido" });
      }

      if (updates.dni || updates.email) {
        const conflict = await db.collection(COLL_NAME).findOne({
          $and: [
            { id_cliente: { $ne: id_cliente } },
            {
              $or: [
                { dni: parseInt(updates.dni) || -1 },
                { email: updates.email },
              ],
            },
          ],
        });

        if (conflict) {
          return res
            .status(409)
            .json({ error: "DNI o email ya están registrados por otro cliente" });
        }
      }

      const result = await db.collection(COLL_NAME).updateOne(
        { id_cliente },
        { $set: updates }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ error: "Cliente no encontrado" });
      }

      res.json({ message: "Cliente actualizado correctamente" });
    } catch (err) {
      console.error("Error al actualizar cliente:", err);
      res.status(500).json({ error: "Error interno del servidor" });
    }
});

export default router;