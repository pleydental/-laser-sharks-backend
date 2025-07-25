const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());

const client_id = process.env.YAHOO_CLIENT_ID;
const client_secret = process.env.YAHOO_CLIENT_SECRET;
const redirect_uri = process.env.REDIRECT_URI;
const league_id = process.env.LEAGUE_ID;

let access_token = "";

// === STEP 1: Redirect user to Yahoo login ===
app.get("/auth/login", (req, res) => {
  const url = `https://api.login.yahoo.com/oauth2/request_auth?client_id=${client_id}&redirect_uri=${redirect_uri}&response_type=code`;
  res.redirect(url);
});

// === STEP 2: Handle Yahoo OAuth callback ===
app.get("/auth/callback", async (req, res) => {
  const code = req.query.code;
  try {
    const tokenRes = await axios.post("https://api.login.yahoo.com/oauth2/get_token", null, {
      headers: {
        Authorization: "Basic " + Buffer.from(`${client_id}:${client_secret}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      params: {
        grant_type: "authorization_code",
        redirect_uri,
        code,
      },
    });

    access_token = tokenRes.data.access_token;
    res.send("✅ OAuth successful! You can now access `/league`.");
  } catch (err) {
    console.error("OAuth callback error:", err.response?.data || err.message);
    res.status(500).send("OAuth failed. See logs for details.");
  }
});

// === STEP 3: Fetch Yahoo Fantasy League Data ===
app.get("/league", async (req, res) => {
  try {
    const leagueKey = `nfl.l.${league_id}`;
    const result = await axios.get(
      `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}?format=json`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );
    res.json(result.data);
  } catch (err) {
    console.error("League fetch error:", err.response?.data || err.message);
    res.status(500).send("Failed to fetch league data.");
  }
});

// === SERVER START ===
const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
