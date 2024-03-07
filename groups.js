// Import necessary modules
const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");

const uri = "mongodb://localhost:27017/mydatabase"; // MongoDB connection URI
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const jwt = require("jsonwebtoken");

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

// Create a group
router.post("/groups", async (req, res) => {
  const { title, usernames } = req.body;
  const db = client.db();
  const groupsCollection = db.collection("groups");
  const usersCollection = db.collection("users");

  try {
    // Get user IDs corresponding to the provided usernames
    const userIds = await Promise.all(
      usernames.map(async (username) => {
        const user = await usersCollection.findOne({ username });
        if (!user) throw new Error(`User not found: ${username}`);
        return user._id;
      })
    );

    // Insert the group with associated user IDs
    const result = await groupsCollection.insertOne({ title, users: userIds });
    res.status(201).json({
      message: "Group created successfully",
      groupId: result.insertedId,
    });
  } catch (error) {
    console.error("Error creating group:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// List all groups
// Middleware to authenticate and filter groups
function authenticateAndFilterGroups(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Token not provided" });

  jwt.verify(token, "secretKey", async (err, decoded) => {
    if (err) return res.status(403).json({ message: "Invalid token" });

    // Extract user ID from token payload
    const userId = decoded.userId;

    // Filter groups where user ID is included in the users array
    const db = client.db();
    const groupsCollection = db.collection("groups");

    const userIdToFilter = new ObjectId(userId);

    groupsCollection
      .find({ users: { $in: [userIdToFilter] } })
      .toArray()
      .then((groups) => {
        // Attach filtered groups to request object
        req.groups = groups;
        next();
      })
      .catch((error) => {
        console.error("Error while filtering groups:", error);
        res.status(500).json({ message: "Internal server error" });
      });
  });
}

// API to get list of groups
router.get("/groups", authenticateAndFilterGroups, (req, res) => {
  // Return filtered groups
  res.status(200).json(req.groups);
});

// API endpoint to get data for a single group
router.get("/groups/:groupId", async (req, res) => {
  const groupId = req.params.groupId; // Get the groupId from the request parameters

  const db = client.db();
  const groupsCollection = db.collection("groups");

  try {
    // Find the group by groupId where the user is a member
    const group = await groupsCollection.findOne({
      _id: groupId,
    });

    if (!group) {
      // If group is not found or user is not a member, return 404 Not Found
      return res.status(404).json({ message: "Group not found" });
    }

    res.status(200).json(group);
  } catch (error) {
    console.error("Error fetching group:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
