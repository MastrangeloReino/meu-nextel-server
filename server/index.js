const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

app.get("/", (req, res) => {
  res.send("Servidor VozOn rodando");
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  console.log("Conectado:", socket.id);

  socket.on("entrar-canal", (canal) => {
    socket.join(canal);
    socket.data.canal = canal;
    console.log(`${socket.id} entrou no canal: ${canal}`);
  });

  socket.on("ptt-message", (data) => {
    const canal = socket.data.canal;

    if (!canal) {
      console.log("Usuário sem canal");
      return;
    }

    socket.to(canal).emit("ptt-message", data);
  });

  socket.on("disconnect", () => {
    console.log("Desconectado:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
