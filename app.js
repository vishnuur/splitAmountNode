const express = require("express");
const loginRouter = require("./login");
const groupsRouter = require("./groups");

const app = express();
const PORT = process.env.PORT || 3000;

app.use("/login", loginRouter);
app.use("/api", groupsRouter);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
