import { NextFunction, Request, Response } from "express";

export const error = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const status = err.statusCode || 500;
  const message =
    err.message ||
    `Internal Server Error. Code: ${err.code}` ||
    "Internal Server Error";

  res.status(status).json({
    status: "error",
    message: "penis",
  });
};
