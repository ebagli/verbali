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

// Validate JWT_SECRET is set and not a default value
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "your-secret-key-change-in-production") {
  console.error("⚠️  WARNING: JWT_SECRET is not set or is using a default value.");
  console.error("   Generate a secure secret with: openssl rand -base64 32");
}

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
});
