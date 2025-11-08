import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URL =
  process.env.MONGO_URL ??
  process.env.MONGODB_URL ??
  "mongodb://mongo:27017/aseguradora";

const mongoClient = new MongoClient(MONGO_URL);
await mongoClient.connect();
const db = mongoClient.db();

export { mongoClient };
export default db;
