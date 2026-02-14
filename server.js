import express from "express";
import multer from "multer";
import forge from "node-forge";
import cors from "cors";

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Multer
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Stockage fichiers
const filesMap = {}; // { filename: { data, iv, aesKey, recipientId } }

// Upload fichier et chiffrement AES
app.post("/upload", upload.single("file"), (req, res) => {
  const file = req.file;
  const recipientId = req.body.recipientId;

  if (!file || !recipientId) return res.status(400).send("Fichier ou destinataire manquant");

  // Clé AES + IV
  const aesKey = forge.random.getBytesSync(32);
  const iv = forge.random.getBytesSync(16);

  // Chiffrement AES-CBC
  const cipher = forge.cipher.createCipher("AES-CBC", aesKey);
  cipher.start({ iv });
  cipher.update(forge.util.createBuffer(file.buffer));
  cipher.finish();
  const encrypted = cipher.output.getBytes();

  filesMap[file.originalname] = { data: encrypted, iv, aesKey, recipientId };

  console.log(`Fichier reçu: ${file.originalname}, destinataire: ${recipientId}`);
  res.send(`Fichier ${file.originalname} chiffré et stocké côté serveur.`);
});

// Liste fichiers d’un destinataire
app.get("/files/:recipientId", (req, res) => {
  const recipientId = req.params.recipientId;
  const files = Object.entries(filesMap)
    .filter(([_, info]) => info.recipientId === recipientId)
    .map(([name]) => name);
  res.json({ files });
});

// Télécharger un fichier
app.get("/download/:recipientId/:filename", (req, res) => {
  const { recipientId, filename } = req.params;
  const fileEntry = filesMap[filename];

  if (!fileEntry) return res.status(404).send("Fichier non trouvé");
  if (fileEntry.recipientId !== recipientId) return res.status(403).send("Accès refusé");

  res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
  res.send(Buffer.from(fileEntry.data, "binary"));
});

app.listen(PORT, () => console.log(`Serveur running on port ${PORT}`));
