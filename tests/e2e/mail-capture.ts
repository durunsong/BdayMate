import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { SMTPServer } from 'smtp-server';

// This is a loopback-only test guard, never an application credential.
export const CAPTURE_SECRET = 'bdaymate-local-test-mail-capture';
export type CapturedMail = {
  recipients: string[];
  links: string[];
  text: string;
};

function decodeMail(raw: string): string {
  return raw
    .split(/--[^\r\n]+\r?\n/)
    .map((part) => {
      const index = part.search(/\r?\n\r?\n/);
      if (index < 0) return part;
      const headers = part.slice(0, index);
      const body = part.slice(index).trim();
      if (/content-transfer-encoding: base64/i.test(headers)) {
        return Buffer.from(body.replace(/\s/g, ''), 'base64').toString('utf8');
      }
      if (/content-transfer-encoding: quoted-printable/i.test(headers)) {
        const bytes = body
          .replace(/=\r?\n/g, '')
          .replace(/=([0-9a-f]{2})/gi, (_, hex: string) =>
            String.fromCharCode(parseInt(hex, 16)),
          );
        return Buffer.from(bytes, 'latin1').toString('utf8');
      }
      return body;
    })
    .join('\n')
    .replace(/&amp;/g, '&')
    .replace(/&#x3D;/gi, '=');
}

export async function startMailCapture(httpPort = 0) {
  const messages: CapturedMail[] = [];
  const smtp = new SMTPServer({
    authOptional: true,
    disabledCommands: ['AUTH', 'STARTTLS'],
    logger: false,
    onRcptTo(address, _session, callback) {
      callback(
        /^test-[a-z0-9-]+@example\.test$/i.test(address.address)
          ? undefined
          : new Error('Only isolated test recipients are accepted'),
      );
    },
    onData(stream, session, callback) {
      const chunks: Buffer[] = [];
      let size = 0;
      stream.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size <= 1_000_000) chunks.push(chunk);
      });
      stream.on('end', () => {
        if (size > 1_000_000) {
          callback(new Error('Test message exceeds capture size limit'));
          return;
        }
        const text = decodeMail(Buffer.concat(chunks).toString('utf8'));
        const links = [...new Set(text.match(/https?:\/\/[^\s<>"']+/g) ?? [])];
        messages.push({
          recipients: session.envelope.rcptTo.map((value) => value.address),
          links,
          text,
        });
        callback();
      });
      stream.on('error', callback);
    },
  });
  smtp.on('error', () => {
    /* The test launch/listen promise reports startup errors. */
  });
  await new Promise<void>((resolve, reject) => {
    smtp.once('error', reject);
    smtp.listen(0, '127.0.0.1', () => {
      smtp.off('error', reject);
      resolve();
    });
  });
  const smtpPort = (smtp.server.address() as AddressInfo).port;
  const http = createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    if (request.headers['x-test-mail-secret'] !== CAPTURE_SECRET) {
      response.writeHead(403).end();
      return;
    }
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    if (url.pathname !== '/messages') {
      response.writeHead(404).end();
      return;
    }
    const recipient = url.searchParams.get('recipient') || '';
    if (!/^test-[a-z0-9-]+@example\.test$/i.test(recipient)) {
      response.writeHead(400).end();
      return;
    }
    if (request.method === 'GET') {
      response.setHeader('Content-Type', 'application/json');
      response.end(
        JSON.stringify(
          messages.filter((mail) => mail.recipients.includes(recipient)),
        ),
      );
    } else if (request.method === 'DELETE') {
      for (let index = messages.length - 1; index >= 0; index--) {
        if (messages[index].recipients.includes(recipient))
          messages.splice(index, 1);
      }
      response.writeHead(204).end();
    } else response.writeHead(405).end();
  });
  try {
    await new Promise<void>((resolve, reject) => {
      http.once('error', reject);
      http.listen(httpPort, '127.0.0.1', () => {
        http.off('error', reject);
        resolve();
      });
    });
  } catch (error) {
    await new Promise<void>((resolve) => smtp.close(resolve));
    throw error;
  }
  return {
    smtpPort,
    url: 'http://127.0.0.1:' + (http.address() as AddressInfo).port,
    async close() {
      http.closeAllConnections();
      await Promise.all([
        new Promise<void>((resolve, reject) =>
          http.close((error) => (error ? reject(error) : resolve())),
        ),
        new Promise<void>((resolve) => smtp.close(resolve)),
      ]);
    },
  };
}

export async function readMail(
  captureURL: string,
  recipient: string,
): Promise<CapturedMail[]> {
  const response = await fetch(
    captureURL + '/messages?recipient=' + encodeURIComponent(recipient),
    {
      headers: { 'x-test-mail-secret': CAPTURE_SECRET },
    },
  );
  if (!response.ok) throw new Error('Local test mail capture is unavailable.');
  return response.json() as Promise<CapturedMail[]>;
}
