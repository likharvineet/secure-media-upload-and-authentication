import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

// configure cors
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

// configure json limit
app.use(express.json({ limit: "16kb" }));

// configure urlencoder ; extended: true -> we can pass nested objects
app.use(express.urlencoded({ extended: true, limit: "16kb" }));

// configure static
app.use(express.static("public"));

export { app };
