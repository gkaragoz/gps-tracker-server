const Database = require("./src/database");
const Server = require("./src/server");
const WebSocketServer = require("./src/websocket");

(async () => {
	const database = new Database();
	await database.connect();

	const serverInstance = new Server(database);
	const httpServer = serverInstance.getHttpServer();

	new WebSocketServer(httpServer, database);
	serverInstance.start();
})();
