import { NextFunction, Request, Response, Router } from "express";

export const err = Router({ mergeParams: true });
err.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);

  const status = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(status).json({
    status: "error",
    message: message,
  });
});
