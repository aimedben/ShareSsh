import express from "express";
import multer from "multer";
import forge from "node-forge";
import cors from "cors";

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Multer pour récupérer fichiers
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Stockage en mémoire { filename: { data, recipientId, aesKey } }
const filesMap = {};

// Endpoint upload
app.post("/upload", upload.single("file"), (req, res) => {
  const file = req.file;
  const recipientId = req.body.recipientId;

  if (!file || !recipientId) {
    return res.status(400).send("Fichier ou destinataire manquant");
  }

  // Générer clé AES côté serveur
  const aesKey = forge.random.getBytesSync(32);

  // Chiffrement fichier AES
  const cipher = forge.cipher.createCipher("AES-CBC", aesKey);
  const iv = forge.random.getBytesSync(16);
  cipher.start({ iv });
  cipher.update(forge.util.createBuffer(file.buffer));
  cipher.finish();
  const encrypted = cipher.output.getBytes();

  // Ici, tu pourrais chiffrer aesKey avec la clé publique SSH du destinataire si tu la récupères
  // const publicKey = forge.pki.publicKeyFromPem(recipientPublicKey);
  // const encryptedAESKey = publicKey.encrypt(aesKey, "RSA-OAEP");

  filesMap[file.originalname] = { data: encrypted, iv, aesKey, recipientId };

  console.log(`Fichier reçu: ${file.originalname}, destinataire: ${recipientId}`);
  res.send(`Fichier ${file.originalname} chiffré et stocké côté serveur.`);
});

// Liste fichiers pour un destinataire
app.get("/files/:recipientId", (req, res) => {
  const recipientId = req.params.recipientId;
  const files = Object.entries(filesMap)
    .filter(([_, info]) => info.recipientId === recipientId)
    .map(([name]) => name);
  res.json({ files });
});

app.listen(PORT, () => console.log(`Serveur running on port ${PORT}`));
