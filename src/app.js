const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const routes = require("./routes");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");

const app = express();

// Comma-separated list, or "*" for any origin. Example:
const corsOrigin = process.env.CORS_ORIGIN || "*";
const corsOptions =
  corsOrigin.trim() === "*"
    ? { origin: true }
    : {
        origin: corsOrigin
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean),
      };

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());
if (process.env.NODE_ENV !== "test") app.use(morgan("dev"));

app.use("/api", routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
