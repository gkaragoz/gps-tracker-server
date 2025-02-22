const WebSocket = require("ws");
const express = require("express");
const http = require("http");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

let connectedClients = {};

// Load existing data from JSON files
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
	fs.mkdirSync(dataDir);
}

fs.readdirSync(dataDir).forEach((file) => {
	const filePath = path.join(dataDir, file);
	const userId = path.basename(file, ".json");
	const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
	connectedClients[userId] = data;
});

wss.on("connection", (ws) => {
	console.log("New WebSocket client connected");

	ws.on("message", (message) => {
		try {
			const data = JSON.parse(message);
			if (!data.userId || !data.latitude || !data.longitude) return;

			console.log(
				`Location from ${data.userId}: ${data.latitude}, ${data.longitude}, ${data.searchingAreaName}`
			);

			if (!connectedClients[data.userId]) {
				connectedClients[data.userId] = [];
			}

			const locationData = {
				latitude: data.latitude,
				longitude: data.longitude,
				timestamp: new Date().toISOString(),
				searchingAreaName: data.searchingAreaName,
			};

			connectedClients[data.userId].push(locationData);

			// Save data to JSON file
			const filePath = path.join(dataDir, `${data.userId}.json`);
			fs.writeFileSync(
				filePath,
				JSON.stringify(connectedClients[data.userId], null, 2)
			);

			// Broadcast updated locations
			const updateMessage = JSON.stringify({
				type: "updateMap",
				data: connectedClients,
			});
			wss.clients.forEach((client) => {
				if (client.readyState === WebSocket.OPEN) {
					client.send(updateMessage);
				}
			});
		} catch (error) {
			console.error("Invalid JSON received", error);
		}
	});

	ws.on("close", () => {
		console.log("Client disconnected");
	});
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
	console.log(`WebSocket server running on ws://localhost:${PORT}`);
});
