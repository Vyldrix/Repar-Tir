import dotenv from 'dotenv';
import app from './app.js';
import { ListService } from './services/list.service.js';

dotenv.config();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor Repar-Tir corriendo en http://localhost:${PORT}`);
  // Ejecutar limpieza inicial de la papelera (retención de 30 días)
  void ListService.purgeExpiredTrash(30);
  const cleanupTimer = setInterval(() => {
    void ListService.purgeExpiredTrash(30);
  }, 24 * 60 * 60 * 1000);
  cleanupTimer.unref();
});
