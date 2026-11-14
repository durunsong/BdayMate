import { SMTPServer } from 'smtp-server';
import type { AddressInfo, Socket } from 'node:net';

export async function startSMTP() {
  const messages: { recipient: string; source: string }[] = [];
  const state = { reject: false, acceptWithoutAck: false };
  const sockets = new Set<Socket>();
  const server = new SMTPServer({
    disabledCommands: ['AUTH', 'STARTTLS'],
    authOptional: true,
    logger: false,
    onData(stream, session, callback) {
      let source = '';
      stream.on('data', (chunk: Buffer) => {
        source += chunk.toString('utf8');
      });
      stream.on('error', callback);
      stream.on('end', () => {
        if (state.reject) {
          callback(
            Object.assign(new Error('Temporary test rejection'), {
              responseCode: 451,
            }),
          );
          return;
        }
        messages.push({
          recipient: session.envelope.rcptTo[0]?.address || '',
          source,
        });
        if (state.acceptWithoutAck) {
          for (const socket of sockets) socket.destroy();
          return;
        }
        callback();
      });
    },
  });
  server.server.on('connection', (socket) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = (server.server.address() as AddressInfo).port;
  return {
    messages,
    state,
    port,
    close: () => new Promise<void>((resolve) => server.close(resolve)),
  };
}
