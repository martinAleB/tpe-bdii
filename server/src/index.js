import express from "express"
import dotenv from "dotenv"
import db from "./mongo-client.js"
import { seedDatabase } from "./seed.js"
import agentesRouter from "./routes/agentes.js"
import clientesRouter from "./routes/clientes.js"
import siniestrosRouter from "./routes/siniestros.js"
import vehiculosRouter from "./routes/vehiculos.js"
import polizasRouter from "./routes/polizas.js"
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from '../swagger.js';
import redis from "./redis-client.js"

dotenv.config()

const PORT = process.env.PORT || 3000

const app = express()
app.use(express.json())

await seedDatabase(db)

redis.del("ranking:cobertura_total")

app.get("/", (req, res) => res.sendFile("index.html", { root: "." }))
app.use("/swagger", swaggerUi.serve, swaggerUi.setup(swaggerSpec))
app.use("/api/agentes", agentesRouter)
app.use("/api/clientes", clientesRouter)
app.use("/api/siniestros", siniestrosRouter)
app.use("/api/vehiculos", vehiculosRouter)
app.use("/api/polizas", polizasRouter)

app.listen(PORT, () =>
  console.log(`Server listening on http://localhost:${PORT}`)
)
