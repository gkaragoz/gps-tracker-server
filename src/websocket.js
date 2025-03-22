const WebSocket = require("ws");

class WebSocketServer {
	constructor(server, database) {
		this.wss = new WebSocket.Server({ server });
		this.database = database;
		this.onlineUsers = new Set();
		this.init();
	}

	init() {
		this.wss.on("connection", async (ws) => {
			console.log("🔗 New WebSocket client connected");

			ws.on("message", async (message) => {
				await this.handleMessage(ws, message);
			});

			ws.on("close", () => {
				this.handleDisconnection(ws);
			});
		});
	}

	async handleMessage(ws, message) {
		try {
			const data = JSON.parse(message);
			if (!data.userId || !data.latitude || !data.longitude) return;

			console.log(`📍 Location from ${data.userId}: ${data.latitude}, ${data.longitude}`);

			this.onlineUsers.add(data.userId); // Mark user as online

			const locationData = {
				latitude: data.latitude,
				longitude: data.longitude,
				timestamp: new Date().toISOString(),
			};

			// Store data in MongoDB
			await this.database.saveLocation(data.userId, locationData);

			// Fetch all latest location data
			const updatedData = await this.database.getAllLocations();

			// Broadcast updated locations and online users list
			this.broadcast({
				type: "updateMap",
				data: {
					locations: updatedData,
					onlineUsers: [...this.onlineUsers],
				},
			});
		} catch (error) {
			console.error("⚠️ Invalid JSON received", error);
		}
	}

	async handleNewClient(ws, userId) {
		try {
			const allLocations = await this.database.getAllLocations();
			const onlineUsersList = [...this.onlineUsers];

			// Send previous locations and current online users
			ws.send(JSON.stringify({
				type: "initialData",
				data: {
					locations: allLocations,
					onlineUsers: onlineUsersList,
				},
			}));

			if (userId) {
				this.onlineUsers.add(userId); // Mark new user as online
				this.broadcast({
					type: "updateOnlineUsers",
					data: [...this.onlineUsers],
				});
			}
		} catch (error) {
			console.error("⚠️ Error fetching existing data:", error);
		}
	}

	handleDisconnection(ws) {
		// Assuming userId is stored in ws object (you may need to modify message handling to store it)
		if (ws.userId) {
			this.onlineUsers.delete(ws.userId);
			this.broadcast({
				type: "updateOnlineUsers",
				data: [...this.onlineUsers],
			});
		}
		console.log("❌ Client disconnected");
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
