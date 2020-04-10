const fs = require('fs');
const EventEmitter = require('events');
const path = require("path");
const stream = require("stream");

const backStream = require('fs-backwards-stream');

class Tail extends stream.Readable {
    constructor() {
        super();
        this.isWatching = false;
        this.ignoreRename = true;
        this.buffer = "";
        this.queue = [];
        this.dispatcher = new EventEmitter();
        this.dispatcher.on("next", () => {
            this._read();
        });
    }

    setFile(file) {
        this.unwatch();
        this.file = file;
        this.watch();
    }

    _read() {
        if (this.queue.length >= 1) {
            let block = this.queue[0];
            if (block.end > block.beg) {
                let stream = fs.createReadStream(this.file, {
                    start: block.beg,
                    end: block.end
                });
                stream.on('error', (error) => {
                    this.emit("error", error);
                });
                stream.on("end", () => {
                    this.queue.shift();
                    if (this.queue.length > 0)
                        this.dispatcher.emit("next");
                    if (this.buffer.length > 0) {
                        this.emit("data", this.buffer);
                        this.buffer = "";
                    }
                });
                stream.on("data", (data) => {
                    this.buffer += data;
                    let chunks = this.buffer.split("\n");
                    this.buffer = chunks.pop();
                    for (let chunk of chunks) this.emit("data", chunk + "\n");
                });
            }
        }
    }

    change(fileName) {
        try {
            var stats = fs.statSync(fileName);
        } catch (err) {
            this.emit("error", `change failed on ${fileName}: ${err}`);
            return;
        }

        if (stats.size < this.pos) this.pos = stats.size;
        if (stats.size > this.pos) {
            this.queue.push({
                beg: this.pos,
                end: stats.size
            });
            this.pos = stats.size;
            if (this.queue.length === 1) this.dispatcher.emit("next");
        }
    }

    rename(fileName) {
        console.log("rename triggered");
        if (fileName === undefined || fileName != this.file) {
            this.unwatch();
            setTimeout(() => {
                this.watch();
            }, 1000);
        }
    }

    doFirstLines(stats) {
        let s = backStream(this.file, { end: stats.size });
        var dataString = "";
        s.on("data", (data) => {
            dataString += data.toString();
            let parts = dataString.split("\n");
            if (parts.length > 10) s.emit("end");
        });
        s.on("end", () => {
            var parts = dataString.split("\n");
            parts = parts.slice(parts.length - 10);
            this.buffer = parts.join("\n");
            s.emit("close");
        });
    }

    watch() {
        if (this.isWatching) return;

        this.isWatching = true;

        try {
            var stats = fs.statSync(this.file);
        } catch (err) {
            this.emit("error", `watch on ${this.file} failed: ${err}`);
            return;
        }

        this.doFirstLines(stats)

        this.pos = stats.size;
        this.watcher = fs.watch(this.file, { encoding: "utf8" }, (eventType, fileName) => {
            if (eventType == "change")
                this.change(fileName);
            else if (eventType == "rename")
                this.rename(fileName);
        });
    }

    unwatch() {
        if (this.watcher) this.watcher.close();
        this.isWatching = false;
        this.queue = [];
    }
}

module.exports = Tail;

/*var tails = new Tail(path.join(__dirname, "logs", "log.txt"));
tails.on("line", (data) => {
    console.log(data);
});
tails.watch();
*/