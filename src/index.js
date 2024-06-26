import dotenv from "dotenv";
import connectDB from "./db/index.js";
import { app } from "./app.js";

dotenv.config({ path: "./env" });
connectDB()
  .then(() => {
    app.on("error", (err) => {
      console.log("ERROR!! on express ", err);
      process.exit(1);
    });
  })
  .then(() => {
    app.listen(process.env.PORT || 8000, () => {
      console.log(`Server is running at port ${process.env.PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection failed !! ", err);
  });
