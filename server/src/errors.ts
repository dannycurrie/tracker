import { Response } from 'express';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

export function sendError(res: Response, error: ApiError): void {
  res.status(error.status).json({ error: { code: error.code, message: error.message } });
}
