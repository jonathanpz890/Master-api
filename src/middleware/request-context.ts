import { randomUUID } from 'node:crypto';

import type { RequestHandler } from 'express';

export const requestContext: RequestHandler = (request, response, next) => {
  const incomingRequestId = request.header('x-request-id');
  request.id = incomingRequestId && incomingRequestId.length <= 128 ? incomingRequestId : randomUUID();
  response.setHeader('x-request-id', request.id);
  next();
};
