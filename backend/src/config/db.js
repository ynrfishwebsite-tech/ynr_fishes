import mongoose from "mongoose";
import dns from "node:dns";

// Prefer IPv4 first for Windows network compatibility
try {
  dns.setDefaultResultOrder("ipv4first");
} catch {
  // Ignore if not supported in environment
}

// Fallback direct replica set URI in case Windows DNS blocks SRV queries
const DIRECT_REPLICA_URI =
  "mongodb://mstechhived1_db_user:bcZdeggKnDHgdpmx@ac-0mpy1zk-shard-00-00.lyywyv4.mongodb.net:27017,ac-0mpy1zk-shard-00-01.lyywyv4.mongodb.net:27017,ac-0mpy1zk-shard-00-02.lyywyv4.mongodb.net:27017/fishes?ssl=true&authSource=admin&retryWrites=true&w=majority";

export const connectDB = async () => {
  const primaryUri = process.env.MONGO_URI || DIRECT_REPLICA_URI;

  try {
    console.log("[MongoDB] Attempting connection to Atlas cluster...");
    const conn = await mongoose.connect(primaryUri, {
      dbName: process.env.DB_NAME || "fishes",
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[MongoDB] ✅ Connected successfully: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    // If Windows DNS blocks SRV resolution (querySrv ECONNREFUSED), try direct replica set endpoints
    if (
      error.message &&
      (error.message.includes("querySrv") || error.message.includes("ECONNREFUSED"))
    ) {
      console.warn(
        "[MongoDB] SRV DNS resolution failed on local system. Attempting direct replica set connection..."
      );
      try {
        const directConn = await mongoose.connect(DIRECT_REPLICA_URI, {
          dbName: process.env.DB_NAME || "fishes",
          serverSelectionTimeoutMS: 7000,
        });
        console.log(
          `[MongoDB] ✅ Connected successfully via replica-set: ${directConn.connection.host}`
        );
        return directConn;
      } catch (directErr) {
        console.error(`[MongoDB] Direct connection error: ${directErr.message}`);
      }
    } else {
      console.error(`[MongoDB] Connection error: ${error.message}`);
    }

    console.log(
      "[MongoDB] Check your MongoDB Atlas Network Access (IP Whitelist: 0.0.0.0/0 or your current IP)."
    );
  }
};
