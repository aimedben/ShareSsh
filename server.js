import express from "express";
import multer from "multer";
import forge from "node-forge";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Route test pour éviter "Cannot GET /"
app.get("/", (req, res) => {
  res.send("🚀 Serveur ShareServer opérationnel");
});

// Configuration Multer (mémoire)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Stockage en mémoire
const filesMap = {}; 
// Structure :
// {
//   fileId: {
//     filename,
//     data,
//     iv,
//     aesKey,
//     recipientId
//   }
// }

// ==============================
// 📤 Upload + chiffrement AES
// ==============================
app.post("/upload", upload.single("file"), (req, res) => {
  try {
    const file = req.file;
    const recipientId = req.body.recipientId;

    if (!file || !recipientId) {
      return res.status(400).json({ error: "Fichier ou destinataire manquant" });
    }

    // Génération clé AES + IV
    const aesKey = forge.random.getBytesSync(32);
    const iv = forge.random.getBytesSync(16);

    // Chiffrement AES-CBC
    const cipher = forge.cipher.createCipher("AES-CBC", aesKey);
    cipher.start({ iv });
    cipher.update(forge.util.createBuffer(file.buffer));
    cipher.finish();

    const encrypted = cipher.output.getBytes();

    // Générer ID unique fichier
    const fileId = Date.now().toString();

    filesMap[fileId] = {
      filename: file.originalname,
      data: encrypted,
      iv,
      aesKey,
      recipientId
    };

    console.log(`📁 Fichier reçu: ${file.originalname}`);
    console.log(`👤 Destinataire: ${recipientId}`);

    res.json({
      message: "Fichier chiffré et stocké",
      fileId
    });

  } catch (err) {
    console.error("❌ Erreur upload:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ==============================
// 📂 Liste fichiers par destinataire
// ==============================
app.get("/files/:recipientId", (req, res) => {
  const recipientId = req.params.recipientId;

  const files = Object.entries(filesMap)
    .filter(([_, info]) => info.recipientId === recipientId)
    .map(([fileId, info]) => ({
      fileId,
      filename: info.filename
    }));

  res.json({ files });
});

// ==============================
// 📥 Télécharger fichier
// ==============================
app.get("/download/:recipientId/:fileId", (req, res) => {
  const { recipientId, fileId } = req.params;
  const fileEntry = filesMap[fileId];

  if (!fileEntry) {
    return res.status(404).json({ error: "Fichier non trouvé" });
  }

  if (fileEntry.recipientId !== recipientId) {
    return res.status(403).json({ error: "Accès refusé" });
  }

  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${fileEntry.filename}"`
  );

  res.setHeader("Content-Type", "application/octet-stream");

  res.send(Buffer.from(fileEntry.data, "binary"));
});

// ==============================

app.listen(PORT, () => {
  console.log(`🚀 Serveur running on port ${PORT}`);
});
