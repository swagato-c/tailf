
const Tail = require("./tail");
const path = require('path');
const process = require('process');
const express = require('express');
const app = express();
const http = require('http');
const PORT = process.env.PORT || 80;
const server = http.createServer(app).listen(PORT);
const io = require('socket.io')(server);



app.use(express.static("public"));
var tails = new Tail();

app.get("/tail/*", (req, res) => {
    tails.setFile(path.join(__dirname, req.params[0]));
    tails.on("data", (data) => console.log(data));
    tails.pipe(res);
    //res.json("OK");
});

app.get("/untail/*", (req, res) => {
    if (tails && path.join(__dirname, req.params[0]) === tails.file) tails.unwatch();
    res.send("Removed tailing");
})


