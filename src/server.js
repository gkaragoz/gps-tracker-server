const express = require("express");
const http = require("http");
const cors = require("cors");
const { PORT } = require("./config");

class Server {
	constructor(database) {
		this.app = express();
		this.server = http.createServer(this.app);
		this.database = database;
		this.setupMiddleware();
	}

	setupMiddleware() {
		this.app.use(cors());
		this.app.use(express.json());
	}

	start() {
		const port = PORT || 5000;
		this.server.listen(port, () => {
			console.log(`🚀 Server running on http://localhost:${port}`);
		});
	}

	getHttpServer() {
		return this.server;
	}
}

module.exports = Server;
