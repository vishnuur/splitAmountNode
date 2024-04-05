// Import necessary modules
const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const moment = require("moment");

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

// Create a group
router.post("/groups", async (req, res) => {
  const { title, userIds } = req.body;
  const db = client.db();
  const groupsCollection = db.collection("groups");
  const usersCollection = db.collection("users");

  try {
    // Check if all user IDs exist
    // const existingUsers = await usersCollection.find({ _id: { $in: userIds } }).toArray();

    // if (existingUsers.length !== userIds.length) {
    //   throw new Error("One or more user IDs not found");
    // }

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

    // const userIdToFilter = new ObjectId(userId);
    console.log(userId, "useriddd");

    groupsCollection
      .find({ users: { $in: [userId] } })
      .toArray()
      .then((groups) => {
        // Attach filtered groups to request object
        req.groups = groups;
        console.log(req.groups, "grupsss");
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
      _id: new ObjectId(groupId),
    });
    console.log(group, groupId);
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

router.post("/expense/:groupId/createExpense", async (req, res) => {
  const { groupId } = req.params;
  const paymentData = req.body;

  const db = client.db(); // Access MongoDB client
  const expensesCollection = db.collection("expenses");

  const { ObjectId } = require("mongodb"); // Import ObjectId from MongoDB

  try {
    // Add groupId to paymentData
    paymentData.groupId = groupId;

    // Insert paymentData into expenses collection
    await expensesCollection.insertOne(paymentData);

    res.status(201).json({
      message: "Payment added to expenses collection successfully",
      success: true,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/expense/:groupId/getexpenses", async (req, res) => {
  const { groupId } = req.params;

  const db = client.db(); // Access MongoDB client
  const expensesCollection = db.collection("expenses");

  const { ObjectId } = require("mongodb"); // Import ObjectId from MongoDB

  try {
    // Find expenses by groupId
    const expenses = await expensesCollection
      .find({ groupId: groupId })
      .toArray();

    res.status(200).json(expenses);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/expenseTypes", async (req, res) => {
  const db = client.db(); // Access MongoDB client
  const expenseTypesCollection = db.collection("expenseTypes");
  try {
    const expenseTypes = await expenseTypesCollection.find({}).toArray();

    res.status(200).json(expenseTypes);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/users/:userId", async (req, res) => {
  const { userId } = req.params;
  const db = client.db();
  const usersCollection = db.collection("users");

  try {
    // Validate user ID format (assuming it's a valid MongoDB ObjectID)
    // if (!require("mongodb").ObjectID.isValid(userId)) {
    //   return res.status(400).json({ message: "Invalid user ID format" });
    // }

    const userIdToFilter = new ObjectId(userId);

    // Find user by ID
    const user = await usersCollection.findOne({
      _id: userIdToFilter,
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { username, email } = user; // Destructure username and email

    res.status(200).json({ username, email });
  } catch (error) {
    console.error("Error fetching user details:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/find-userId", async (req, res) => {
  const { email } = req.query;
  console.log(email, "emailvalue");

  if (!email) {
    return res.status(400).json({ message: "Missing email in query" });
  }

  try {
    const user = await client.db().collection("users").findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { _id } = user; // Destructure user ID

    res.status(200).json({ userId: _id }); // Return user ID with a clear property name
  } catch (error) {
    console.error("Error fetching user ID:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/expenseChartBar/:groupId", async (req, res) => {
  const groupId = req.params.groupId;

  try {
    const db = client.db();
    const expensesCollection = db.collection("expenses");

    const expenses = await expensesCollection.find({ groupId }).toArray();

    // Grouping expenses by month
    const monthlyExpenses = {};
    expenses.forEach((expense) => {
      const month = moment(expense.date).format("MMMM");
      if (!monthlyExpenses[month]) {
        monthlyExpenses[month] = 0;
      }
      monthlyExpenses[month] += parseFloat(expense.amount);
    });

    // Convert monthly expenses object to array
    const result = Object.keys(monthlyExpenses).map((month) => ({
      label: month,
      value: monthlyExpenses[month],
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/expensesPieChart/:groupId", async (req, res) => {
  const groupId = req.params.groupId;

  try {
    const db = client.db();
    const expensesCollection = db.collection("expenses");

    const expenses = await expensesCollection.find({ groupId }).toArray();

    // Grouping expenses by expenseType
    const expenseTypeMap = {};
    expenses.forEach((expense) => {
      const { expenseType, amount } = expense;
      if (!expenseTypeMap[expenseType]) {
        expenseTypeMap[expenseType] = 0;
      }
      expenseTypeMap[expenseType] += amount;
    });

    // Create an array of objects from the expenseTypeMap
    const result = Object.keys(expenseTypeMap).map((expenseType) => ({
      key: expenseType,
      value: expenseTypeMap[expenseType],
      color: randomColor(),
      gradientCenterColor: randomColor(),
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
