require("dotenv").config();

module.exports = {
	MONGODB_URI: process.env.MONGODB_URI,
	DB_NAME: "locationDB",
	PORT: process.env.PORT || process.env.WEBSOCKET_PORT || 5000,
};
