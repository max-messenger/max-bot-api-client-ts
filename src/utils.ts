import fs from 'node:fs';

export const sleep = async (ms: number) => {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

export const streamToBlob = async (stream: fs.ReadStream, mimeType?: string) => {
  return new Promise<Blob>((resolve, reject) => {
    const chunks: Array<string | Buffer> = [];
    stream
      .on('data', (chunk) => chunks.push(chunk))
      .once('end', () => {
        const blob = mimeType
          ? new Blob(chunks, { type: mimeType })
          : new Blob(chunks);
        resolve(blob);
      })
      .once('error', reject);
  });
};
