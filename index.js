// Load environment variables
require('dotenv').config();

// Import bot initialization function
const initBot = require('./src/bot');

// Initialize the bot with the Telegram token
const bot = initBot(process.env.TELEGRAM_BOT_TOKEN);

// Handle polling errors
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

console.log('Bubblemaps Telegram Bot is running...'); 