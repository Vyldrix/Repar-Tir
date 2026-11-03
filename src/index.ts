import dotenv from 'dotenv';
import app from './app.js';
import { ListService } from './services/list.service.js';
import { startAuthGrpcServer } from './grpc/auth.grpc.js';

dotenv.config();

const PORT = process.env.PORT || 3000;
const GRPC_PORT = Number(process.env.GRPC_PORT) || 50051;

app.listen(PORT, () => {
  console.log(`Servidor Repar-Tir corriendo en http://localhost:${PORT}`);
  void startAuthGrpcServer(GRPC_PORT)
    .then((boundPort) => {
      console.log(`Servidor gRPC AuthService activo en 127.0.0.1:${boundPort}`);
    })
    .catch((err) => {
      console.error('Error al iniciar el servidor gRPC:', err);
    });
  // Ejecutar limpieza inicial de la papelera (retención de 30 días)
  void ListService.purgeExpiredTrash(30);
  const cleanupTimer = setInterval(() => {
    void ListService.purgeExpiredTrash(30);
  }, 24 * 60 * 60 * 1000);
  cleanupTimer.unref();
});
