// server.js

const express = require("express");
const http = require("http");
const https = require("https");
const path = require("path");
const { Server } = require("socket.io");
const fs = require("fs");

const app = express();

const PORT = 3050;
const HTTPS_PORT = 3051;

console.log("Serving files from:", __dirname);

app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.url} from ${req.ip}`);
  next();
});

app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/manager", (req, res) => {
  res.redirect("/?manager=1");
});

app.get("/debug-routes", (req, res) => {
  res.send("DEBUG ROUTE WORKS");
});

app.get("/test", (req, res) => {
  res.send("SERVER IS WORKING");
});

function attachSocket(server, label) {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket) => {
    console.log(`[${label}] Connected:`, socket.id);

    socket.on("gameStateUpdate", (data) => {
      console.log(`[${label}] gameStateUpdate`, {
        day: data?.gameState?.day,
        secondsLeft: data?.gameState?.secondsLeft,
        revenue: data?.gameState?.revenue,
        views: data?.gameState?.views,
        followers: data?.gameState?.followers
      });

      socket.broadcast.emit("gameStateUpdate", data);
    });

    socket.on("disconnect", () => {
      console.log(`[${label}] Disconnected:`, socket.id);
    });
  });
}

// HTTP server
const httpServer = http.createServer(app);
attachSocket(httpServer, "HTTP");

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`HTTP Server started at http://0.0.0.0:${PORT}`);
});

// HTTPS server
try {
  const options = {
    key: fs.readFileSync(path.join(__dirname, "localhost-key.pem")),
    cert: fs.readFileSync(path.join(__dirname, "localhost.pem")),
  };

  const httpsServer = https.createServer(options, app);
  attachSocket(httpsServer, "HTTPS");

  httpsServer.listen(HTTPS_PORT, "0.0.0.0", () => {
    console.log(`HTTPS Server started at https://0.0.0.0:${HTTPS_PORT}`);
  });
} catch (err) {
  console.warn("HTTPS server did not start.");
  console.warn(err.message);
}