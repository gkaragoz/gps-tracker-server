const WebSocket = require("ws");
const express = require("express");
const http = require("http");
const cors = require("cors");
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI, {
	serverApi: {
		version: ServerApiVersion.v1,
		strict: true,
		deprecationErrors: true,
	}
});

let db, locationsCollection;

// Connect to MongoDB and initialize collection
async function connectDB() {
	try {
		await client.connect();
		db = client.db("locationDB"); // Change "locationDB" to your actual DB name
		locationsCollection = db.collection("locations");
		console.log("Connected to MongoDB!");
		const userCount = await locationsCollection.countDocuments();
		console.log(`Total users with locations: ${userCount}`);
	} catch (error) {
		console.error("Error connecting to MongoDB:", error);
		process.exit(1);
	}
}

connectDB();

wss.on("connection", async (ws) => {
	console.log("New WebSocket client connected");

	// Send all existing locations data to the newly connected client
	try {
		const existingData = await locationsCollection.find({}).toArray();
		const formattedData = {};

		existingData.forEach(doc => {
			formattedData[doc.userId] = doc.locations;
		});

		ws.send(JSON.stringify({
			type: "initialData",
			data: formattedData
		}));
	} catch (error) {
		console.error("Error fetching existing data:", error);
	}

	ws.on("message", async (message) => {
		try {
			const data = JSON.parse(message);
			if (!data.userId || !data.latitude || !data.longitude) return;

			console.log(`Location from ${data.userId}: ${data.latitude}, ${data.longitude}, ${data.searchingAreaName}`);

			const locationData = {
				latitude: data.latitude,
				longitude: data.longitude,
				timestamp: new Date().toISOString(),
				searchingAreaName: data.searchingAreaName,
			};

			// Store data in MongoDB
			await locationsCollection.updateOne(
				{ userId: data.userId },
				{ $push: { locations: locationData } },
				{ upsert: true } // Create a new document if user doesn't exist
			);

			// Fetch all latest location data
			const updatedData = await locationsCollection.find({}).toArray();
			const allLocations = {};

			updatedData.forEach(doc => {
				allLocations[doc.userId] = doc.locations;
			});

			// Broadcast updated locations to all clients
			const updateMessage = JSON.stringify({
				type: "updateMap",
				data: allLocations,
			});
			wss.clients.forEach(client => {
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

const PORT = process.env.PORT || process.env.WEBSOCKET_PORT;
server.listen(PORT, () => {
	console.log(`WebSocket server running on ws://localhost:${PORT}`);
});
