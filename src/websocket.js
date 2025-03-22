const WebSocket = require("ws");

class WebSocketServer {
	constructor(server, database) {
		this.wss = new WebSocket.Server({ server });
		this.database = database;
		this.init();
	}

	init() {
		this.wss.on("connection", async (ws) => {
			console.log("🔗 New WebSocket client connected");
			await this.handleNewClient(ws);

			ws.on("message", async (message) => {
				await this.handleMessage(ws, message);
			});

			ws.on("close", () => {
				console.log("❌ Client disconnected");
			});
		});
	}

	async handleNewClient(ws) {
		try {
			const allLocations = await this.database.getAllLocations();
			ws.send(JSON.stringify({
				type: "initialData",
				data: allLocations
			}));
		} catch (error) {
			console.error("⚠️ Error fetching existing data:", error);
		}
	}

	async handleMessage(ws, message) {
		try {
			const data = JSON.parse(message);
			if (!data.userId || !data.latitude || !data.longitude) return;

			console.log(`📍 Location from ${data.userId}: ${data.latitude}, ${data.longitude}`);

			const locationData = {
				latitude: data.latitude,
				longitude: data.longitude,
				timestamp: new Date().toISOString(),
			};

			// Store data in MongoDB
			await this.database.saveLocation(data.userId, locationData);

			// Fetch all latest location data
			const updatedData = await this.database.getAllLocations();

			// Broadcast updated locations to all clients
			this.broadcast({
				type: "updateMap",
				data: updatedData,
			});
		} catch (error) {
			console.error("⚠️ Invalid JSON received", error);
		}
	}

	broadcast(message) {
		const updateMessage = JSON.stringify(message);
		this.wss.clients.forEach(client => {
			if (client.readyState === WebSocket.OPEN) {
				client.send(updateMessage);
			}
		});
	}
}

module.exports = WebSocketServer;
