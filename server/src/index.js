import express from "express"
import Redis from "ioredis"
import dotenv from "dotenv"
import db from "./mongo-client.js"
import { seedDatabase } from "./seed.js"
import agentesRouter from "./routes/agentes.js"
import clientesRouter from "./routes/clientes.js"
import siniestrosRouter from "./routes/siniestros.js"
import vehiculosRouter from "./routes/vehiculos.js"

dotenv.config()

const PORT = process.env.PORT || 3000
const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379"

const app = express()
app.use(express.json())

await seedDatabase(db)
const col = db.collection("agentes")

const redis = new Redis(REDIS_URL)

app.get("/", (req, res) => res.send("OK"))

app.use("/api/agentes", agentesRouter)
app.use("/api/clientes", clientesRouter)
app.use("/api/siniestros", siniestrosRouter)
app.use("/api/vehiculos", vehiculosRouter)

app.get("/redis", async (_req, res) => {
  const n = await redis.incr("hits");
  res.json({ hits: n });
})

app.listen(PORT, () =>
  console.log(`Server listening on http://localhost:${PORT}`)
)
