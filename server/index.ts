import express from "express";
import cors from "cors";
import fileUpload from "express-fileupload";
import { initDatabase, seedDefaultUser } from "./db.js";
import authRoutes from "./routes/auth.routes.js";
import transcriptionsRoutes from "./routes/transcriptions.routes.js";
import speakersRoutes from "./routes/speakers.routes.js";
import aiRoutes from "./routes/ai.routes.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(fileUpload());

initDatabase();
seedDefaultUser();

app.use("/api/auth", authRoutes);
app.use("/api/transcriptions", transcriptionsRoutes);
app.use("/api/speakers", speakersRoutes);
app.use("/api/ai", aiRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Default credentials: admin@example.com / admin123`);
});
