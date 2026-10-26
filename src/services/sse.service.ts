import { Worker } from 'node:worker_threads';
import { Response } from 'express';

export interface ListProcessedEvent {
  listId: string;
  title: string;
  status: 'CONFIRMADA';
  processedInThread: number;
  checksum: string;
  summary: string;
  processedAt: string;
}

const WORKER_SCRIPT = `
const { parentPort, workerData } = require('node:worker_threads');
const crypto = require('node:crypto');

// Procesamiento paralelo en hilo secundario (Worker Thread) para cálculo y cierre de reparto
const { listId, title } = workerData;
const checksum = crypto
  .pbkdf2Sync(String(listId) + ':' + String(title), 'repar-tir-salt', 1000, 16, 'sha256')
  .toString('hex');

setTimeout(() => {
  parentPort.postMessage({
    listId,
    title,
    status: 'CONFIRMADA',
    processedInThread: require('node:worker_threads').threadId,
    checksum,
    summary: 'Cálculo y reparto procesados exitosamente en segundo plano (Worker Thread)',
    processedAt: new Date().toISOString(),
  });
}, 30);
`;

export class SseService {
  private static clients = new Map<string, Set<Response>>();
  private static completedEvents = new Map<string, ListProcessedEvent>();
  private static pendingTasks = new Map<string, Promise<ListProcessedEvent>>();

  /**
   * Dispara una tarea asíncrona en un hilo secundario (Worker Thread)
   * cuando una lista pasa al estado CONFIRMADA.
   */
  static triggerBackgroundConfirmation(listId: string, title: string): Promise<ListProcessedEvent> {
    const existingTask = this.pendingTasks.get(listId);
    if (existingTask) {
      return existingTask;
    }

    const taskPromise = new Promise<ListProcessedEvent>((resolve, reject) => {
      const worker = new Worker(WORKER_SCRIPT, {
        eval: true,
        workerData: { listId, title },
      });

      worker.once('message', (result: ListProcessedEvent) => {
        this.completedEvents.set(listId, result);
        this.pendingTasks.delete(listId);
        this.broadcast(listId, result);
        resolve(result);
      });

      worker.once('error', (err) => {
        this.pendingTasks.delete(listId);
        reject(err);
      });
    });

    this.pendingTasks.set(listId, taskPromise);
    return taskPromise;
  }

  /**
   * Suscribe un cliente HTTP al canal Server-Sent Events (SSE) de una lista.
   */
  static subscribe(listId: string, res: Response): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.status(200);

    // Emitir evento inicial de conexión SSE
    res.write(`event: connected\ndata: ${JSON.stringify({ listId, connected: true })}\n\n`);

    // Si la tarea asíncrona ya finalizó previamente, emitir el evento de inmediato
    const completed = this.completedEvents.get(listId);
    if (completed) {
      this.sendEvent(res, completed);
      res.end();
      return;
    }

    // Registrar cliente para cuando finalice el Worker Thread en curso
    if (!this.clients.has(listId)) {
      this.clients.set(listId, new Set());
    }
    this.clients.get(listId)!.add(res);

    res.on('close', () => {
      const set = this.clients.get(listId);
      if (set) {
        set.delete(res);
        if (set.size === 0) {
          this.clients.delete(listId);
        }
      }
    });
  }

  private static broadcast(listId: string, event: ListProcessedEvent): void {
    const set = this.clients.get(listId);
    if (!set) return;

    for (const clientRes of set) {
      this.sendEvent(clientRes, event);
      clientRes.end();
    }
    this.clients.delete(listId);
  }

  private static sendEvent(res: Response, event: ListProcessedEvent): void {
    res.write(`event: list_processed\ndata: ${JSON.stringify(event)}\n\n`);
  }
}
