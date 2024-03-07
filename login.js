const express = require("express");
const { MongoClient } = require("mongodb");
const jwt = require("jsonwebtoken");

const uri = "mongodb://localhost:27017/mydatabase"; // MongoDB connection URI
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const router = express.Router();

client
  .connect()
  .then(() => {
    console.log("Connected to mongodb");
  })
  .catch((err) => {
    console.log("mongodb connection Failed...", err);
  });

router.use(express.json());

// Middleware to verify JWT token
function authenticateToken(req, res, next) {
  const token = req.headers["authorization"];
  if (!token) return res.status(401).json({ message: "Token not provided" });

  jwt.verify(token, "secretKey", (err, user) => {
    console.log(err, "errr", user, "userrr");
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.user = user;
    next();
  });
}

router.post("/", async (req, res) => {
  const { username, password } = req.body;
  const db = client.db();
  const usersCollection = db.collection("users");

  try {
    const user = await usersCollection.findOne({ username, password });
    if (user) {
      // Generate JWT token
      const token = jwt.sign({ username: user.username }, "secretKey", {
        expiresIn: "1h",
      });

      // Send token along with success response
      res
        .status(200)
        .json({ message: "Login successful", success: true, token, ...user });
    } else {
      res.status(401).json({
        message: `Incorrect username or password`,
        success: false,
      });
    }
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Example API using authentication middleware
router.get("/protected", authenticateToken, (req, res) => {
  // Only accessible with valid token
  console.log(req.user);
  res.json({ message: "Protected API accessed successfully", user: req.user });
});

module.exports = router;
