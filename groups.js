// Import necessary modules
const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");

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
    res
      .status(201)
      .json({
        message: "Group created successfully",
        groupId: result.insertedId,
      });
  } catch (error) {
    console.error("Error creating group:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// List all groups
router.get("/groups", async (req, res) => {
  const db = client.db();
  const groupsCollection = db.collection("groups");
  const usersCollection = db.collection("users");

  try {
    const groups = await groupsCollection.find().toArray();

    // Iterate through each group
    for (const group of groups) {
      // Retrieve user documents based on user IDs in the group
      const users = await usersCollection
        .find({ _id: { $in: group.users } })
        .toArray();

      // Map user IDs to user names
      const userNames = users.map((user) => user.username);

      // Replace user IDs with user names in the group object
      group.users = userNames;
    }

    res.status(200).json(groups);
  } catch (error) {
    console.error("Error listing groups:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});
module.exports = router;
