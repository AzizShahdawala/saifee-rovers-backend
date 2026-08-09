import mongoose from "mongoose";

let connectionPromise;

const connectDB = async () => {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not configured");
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(process.env.MONGO_URI)
      .then(() => {
        console.log("MongoDB connected");
        return mongoose.connection;
      })
      .catch((error) => {
        connectionPromise = undefined;
        throw error;
      });
  }
  return connectionPromise;
};

export default connectDB;
