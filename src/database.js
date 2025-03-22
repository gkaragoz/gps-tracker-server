const { MongoClient, ServerApiVersion } = require('mongodb');
const { MONGODB_URI, DB_NAME } = require('./config');

class Database {
	constructor() {
		this.client = new MongoClient(MONGODB_URI, {
			serverApi: {
				version: ServerApiVersion.v1,
				strict: true,
				deprecationErrors: true,
			}
		});
		this.db = null;
		this.locationsCollection = null;
	}

	async connect() {
		try {
			await this.client.connect();
			this.db = this.client.db(DB_NAME);
			this.locationsCollection = this.db.collection("locations");
			console.log("✅ Connected to MongoDB!");

			const userCount = await this.locationsCollection.countDocuments();
			console.log(`📌 Total users with locations: ${userCount}`);
		} catch (error) {
			console.error("❌ MongoDB connection error:", error);
			process.exit(1);
		}
	}

	async getAllLocations() {
		const existingData = await this.locationsCollection.find({}).toArray();
		const formattedData = {};
		existingData.forEach(doc => {
			formattedData[doc.userId] = doc.locations;
		});
		return formattedData;
	}

	async saveLocation(userId, locationData) {
		await this.locationsCollection.updateOne(
			{ userId },
			{ $push: { locations: locationData } },
			{ upsert: true }
		);
	}

	async getLocationCount() {
		const totalLocations = await this.locationsCollection.aggregate([
			{ $unwind: "$locations" },
			{ $count: "totalLocations" }
		]).toArray();
		return totalLocations[0]?.totalLocations || 0;
	}
}

module.exports = Database;
