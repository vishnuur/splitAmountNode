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

function verifyAccessToken(token) {
  const secret = "secretKey";

  try {
    const decoded = jwt.verify(token, secret);
    return { success: true, data: decoded };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Middleware to verify JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.sendStatus(401);
  }

  const result = verifyAccessToken(token);

  if (!result.success) {
    return res.status(403).json({ error: result.error });
  }

  req.user = result;
  next();
}

router.post("/", async (req, res) => {
  const { username, password } = req.body;
  const db = client.db();
  const usersCollection = db.collection("users");

  try {
    const user = await usersCollection.findOne({ username, password });
    if (user) {
      // Generate JWT token
      const token = jwt.sign(
        { userId: user._id, username: user.username },
        "secretKey",
        {
          expiresIn: "1h",
        }
      );

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
  res.json({ message: "Protected API accessed successfully", user: req.user });
});

module.exports = router;
