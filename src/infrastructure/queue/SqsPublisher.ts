export interface SyncJobMessage {
  jobId: string;
}

export type SyncJobConsumer = (message: SyncJobMessage) => void | Promise<void>;

/**
 * Simula una cola SQS en un único proceso: en vez de encolar el mensaje y
 * dejar que un trigger de SQS dispare la Lambda consumidora, invoca
 * directamente al consumer inyectado, de forma asíncrona y sin esperar su
 * resultado (`publish` no es awaited por quien la llama). Así se preserva el
 * mismo desacople productor/consumidor que tendría SQS real, sin necesitar
 * infraestructura adicional para el challenge.
 *
 * En un entorno real, esto se reemplazaría por `@aws-sdk/client-sqs`
 * (`SendMessageCommand` contra una cola real), y `syncDataConsumerHandler`
 * se dispararía por el trigger de SQS de la Lambda en vez de esta llamada
 * directa en el mismo proceso.
 */
export class SqsPublisher {
  constructor(private readonly consumer: SyncJobConsumer) {}

  publish(message: SyncJobMessage): void {
    setImmediate(() => {
      Promise.resolve(this.consumer(message)).catch((error: unknown) => {
        console.error(`Error processing sync job ${message.jobId}:`, error);
      });
    });
  }
}
