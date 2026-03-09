const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  
  if (!uri) {
    console.log('MongoDB URI not configured - Running in DEMO MODE');
    return;
  }

  try {
    const conn = await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // Fail faster if server unavailable
      socketTimeoutMS: 45000, // 45 seconds for socket operations
      maxPoolSize: 10,
      retryWrites: true,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    console.error('MongoDB Atlas might be unreachable. Check:');
    console.error('1. Internet connection');
    console.error('2. IP whitelist in MongoDB Atlas (add 0.0.0.0/0 for development)');
    console.error('3. Cluster status at cloud.mongodb.com');
    console.log('Running in DEMO MODE without database');
  }
};

module.exports = connectDB;
