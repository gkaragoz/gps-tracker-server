const WebSocket = require("ws");

class WebSocketServer {
	constructor(server, database) {
		this.wss = new WebSocket.Server({ server });
		this.database = database;
		this.mockUserLocations = []; // Store mock user locations
		this.init();
		// this.startMockUsers();
	}

	init() {
		this.wss.on("connection", async (ws) => {
			console.log("🔗 [CLIENT CONNECTED] New WebSocket client connected");
			await this.handleNewClient(ws);

			ws.on("message", async (message) => {
				console.log("📩 [CLIENT MESSAGE] Received from real client:", message);
				await this.handleMessage(ws, message, true); // Real client message
			});

			ws.on("close", () => {
				console.log("❌ [CLIENT DISCONNECTED] WebSocket client disconnected");
			});
		});
	}

	async handleNewClient(ws) {
		try {
			// Fetch all user location documents
			let realLocations = await this.database.getAllLocations();
			if (!realLocations) {
				console.warn("⚠️ [NO DATA] No location data found in DB.");
				realLocations = [];
			}
			else {
				realLocations = Object.values(realLocations).flat();
			}
			
			// `mockUserLocations` is an array
			const mockLocations = Object.values(this.mockUserLocations).flat();

			const combinedData = [...realLocations, ...mockLocations];

			console.log("📤 [SENDING INITIAL DATA] Sending real + mock locations to new client.");
			ws.send(JSON.stringify({
				type: "initialData",
				data: combinedData,
			}));
		} catch (error) {
			console.error("⚠️ [ERROR] Fetching initial data:", error);
		}
	}

	async handleMessage(ws, message, isRealClient = false) {
		try {
			const data = JSON.parse(message);
			if (!data.userId || !data.latitude || !data.longitude) {
				console.warn("⚠️ [INVALID DATA] Missing required fields:", data);
				return;
			}

			const locationData = {
				userId: data.userId,
				latitude: data.latitude,
				longitude: data.longitude,
				timestamp: new Date().toISOString(),
			};

			// Only write to DB if this message came from a real client
			if (isRealClient) {
				console.log(`💾 [DB SAVE] Storing location for ${data.userId}:`, locationData);
				await this.database.saveLocation(data.userId, locationData);
			} else {
				console.log(`🟡 [MOCK USER] ${data.userId} updated location (not saved to DB).`);
				// Add to mock locations (not saved to DB)
				this.mockUserLocations.push(locationData);
			}

			// Broadcast the new location to all clients
			console.log(`📡 [BROADCAST] Sending update for ${data.userId}`);
			this.broadcast({
				type: "userUpdate",
				data: locationData,
			});
		} catch (error) {
			console.error("⚠️ [ERROR] Invalid JSON received:", error);
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

	/** =========================
 *  MOCK USERS - SIMULATED MOVEMENT
 *  ========================= */
	startMockUsers() {
		const mockUsers = [
			{ userId: "user1", latitude: 37.7201, longitude: -122.4101, direction: { lat: 0.0001, lng: 0.0002 } }, // Moves NE
			{ userId: "user2", latitude: 37.7312, longitude: -122.4212, direction: { lat: 0.0002, lng: -0.0001 } }, // Moves NW
			{ userId: "user3", latitude: 37.7423, longitude: -122.4323, direction: { lat: -0.0001, lng: 0.0002 } }, // Moves SE
			{ userId: "user4", latitude: 37.7534, longitude: -122.4434, direction: { lat: -0.0002, lng: -0.0001 } }, // Moves SW
			{ userId: "user5", latitude: 37.7645, longitude: -122.4545, direction: { lat: 0.0001, lng: 0.0001 } }, // Moves NE
		];

		setInterval(() => {
			mockUsers.forEach(user => {
				// Move the user in their assigned direction
				user.latitude += user.direction.lat;
				user.longitude += user.direction.lng;

				const mockData = {
					userId: user.userId,
					latitude: user.latitude,
					longitude: user.longitude,
				};

				console.log(`🤖 [MOCK UPDATE] ${user.userId} moved to: (${user.latitude}, ${user.longitude})`);

				// Simulate receiving message from a client (but don't save to DB)
				this.handleMessage(null, JSON.stringify(mockData), false);
			});
		}, 1000); // Update every 1 second
	}
}

module.exports = WebSocketServer;
