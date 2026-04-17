import mongoose from "mongoose";

const MONGODB_URI =
  import.meta.env.MONGODB_URI || "mongodb://localhost:27017/motionhub";

let isConnected = false;

export async function connectDB() {
  if (isConnected) return;

  try {
    await mongoose.connect(MONGODB_URI);
    isConnected = true;
    console.log("✅ MongoDB conectado");
  } catch (error) {
    console.error("❌ Error conectando a MongoDB:", error);
    throw error;
  }
}

export default connectDB;
