const axios = require('axios');
const mysql = require('mysql2/promise');
const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config();
const {
    BOT_TOKEN,
    CHANNEL_USERNAME,
    DB_HOST,
    DB_NAME,
    DB_USER,
    DB_PASSWORD,
    ADMIN_CHAT_ID,
  } = process.env;

const app = express();
app.use(bodyParser.json());

const botToken = BOT_TOKEN;
const channelUsername = CHANNEL_USERNAME;
const adminChatId = ADMIN_CHAT_ID;
const databaseCredentials = {
  host: DB_HOST,
  user: DB_NAME,
  password: DB_USER,
  database: DB_PASSWORD
};

// Setup database connection
async function createDatabaseConnection() {
  try {
    const connection = await mysql.createConnection(databaseCredentials);
    console.log("Database connected successfully");
    return connection;
  } catch (error) {
    console.error("Could not connect to the database:", error);
    process.exit(1);
  }
}

// Function to send message
async function sendMessage(chatId, text, replyMarkup = null) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const data = {
    chat_id: chatId,
    text: text,
    reply_markup: replyMarkup,
  };

  try {
    await axios.post(url, data);
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

// Function to check user membership
async function checkUserMembership(userId) {
  const url = `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=@${channelUsername}&user_id=${userId}`;

  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error('Error checking membership:', error);
    return null;
  }
}

// Main bot logic for updates
app.post('/webhook', async (req, res) => {
  const message = req.body.message;
  if (!message) return res.sendStatus(200); // No message to process

  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = message.text;
  const connection = await createDatabaseConnection();

  if (text === '/start') {
    const membershipInfo = await checkUserMembership(userId);
    if (membershipInfo && membershipInfo.ok && membershipInfo.result.status !== 'left') {
      // Check if user is in the database
      const [rows] = await connection.execute('SELECT user_id FROM users WHERE user_id = ?', [userId]);
      if (rows.length > 0) {
        sendMessage(chatId, "You are already added 😄");
      } else {
        await connection.execute('INSERT INTO users (user_id) VALUES (?)', [userId]);
        sendMessage(chatId, "You have been added to the list! ✅");
        // Optional: Notify admin about new user
        const [total] = await connection.execute('SELECT COUNT(*) AS total FROM users');
        sendMessage(adminChatId, `New user joined! Members: ${total[0].total}`);
      }
    } else {
      sendMessage(chatId, "Please join our channel first 😄", {
        inline_keyboard: [[{ text: "Join Channel", url: `https://t.me/${channelUsername}` }]]
      });
    }
  }

  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
