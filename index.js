const express = require("express");
const bodyParser = require("body-parser");
const twilio = require("twilio");
const fs = require("fs");
const cors = require("cors");

const app = express();
app.use(bodyParser.json());
app.use(cors()); // allow frontend HTML to call API

// Twilio setup
const accountSid = "AC1238b6b75213b49f49d10b3a4b1acdcd";
const authToken = "07727f9091fa14f6632c1a62d6c6bef8";
const client = twilio(accountSid, authToken);

// JSON DB file
const dbFile = "./users.json";

// Ensure users.json exists
if (!fs.existsSync(dbFile)) {
  fs.writeFileSync(dbFile, JSON.stringify({}));
}

// Load users
function loadUsers() {
  return JSON.parse(fs.readFileSync(dbFile));
}

// Save users
function saveUsers(data) {
  fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
}

// OTP storage (temporary memory)
const otpStore = {};

// Signup route
app.post("/signup", async (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) {
    return res.status(400).json({ error: "Phone and password required" });
  }

  const users = loadUsers();
  if (users[phone]) {
    return res.status(400).json({ error: "Phone already registered" });
  }

  users[phone] = { phone, password, verified: false };
  saveUsers(users);

  // Generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000);
  otpStore[phone] = otp;

  try {
    await client.messages.create({
      body: `Your signup OTP is ${otp}`,
      from: "+1234567890", // your Twilio number
      to: phone
    });
  } catch (e) {
    return res.status(500).json({ error: "Failed to send OTP" });
  }

  res.json({ message: "User created. OTP sent" });
});

// Verify OTP
app.post("/verify", (req, res) => {
  const { phone, otp } = req.body;
  const users = loadUsers();

  if (!users[phone]) {
    return res.status(400).json({ error: "User not found" });
  }

  if (otpStore[phone] && otpStore[phone] == otp) {
    users[phone].verified = true;
    saveUsers(users);
    delete otpStore[phone];
    return res.json({ message: "Phone verified" });
  }

  res.status(400).json({ error: "Invalid OTP" });
});

// Login route
app.post("/login", (req, res) => {
  const { phone, password } = req.body;
  const users = loadUsers();

  const user = users[phone];
  if (!user) return res.status(400).json({ error: "User not found" });

  if (!user.verified) return res.status(403).json({ error: "Phone not verified" });

  if (user.password !== password) return res.status(401).json({ error: "Wrong password" });

  res.json({ message: "Login successful" });
});

// Start server
app.listen(3000, () => console.log("Server running on port 3000"));
