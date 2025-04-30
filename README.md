# Bubblemaps Telegram Bot

A Telegram bot that provides token analysis and bubble map visualization for various blockchain networks. The bot uses Bubblemaps API to generate interactive token holder maps and CoinGecko API for price data.

## Features

- Generate bubble maps for tokens across multiple chains
- View token holder distribution and clustering
- Get real-time price data and market metrics
- Analyze token decentralization scores
- Support for multiple chains: ETH, BSC, FTM, AVAX, CRO, ARBI, POLY, BASE, SOL, SONIC

## Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)
- A Telegram Bot Token (obtained from BotFather)
- MAMP or similar local development environment (optional, for local development)

## Installation

1. Clone the repository:
```bash
git clone git@github.com:0ximgh05t/bubblemaps-hackaton.git
cd bubblemaps-hackaton
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following content:
```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
```

## Getting Your Telegram Bot Token

1. Open Telegram and search for [@BotFather](https://t.me/BotFather)
2. Start a chat with BotFather and send `/newbot`
3. Follow the instructions to:
   - Choose a name for your bot
   - Choose a username for your bot (must end in 'bot')
4. BotFather will provide you with a token. Copy this token and paste it into your `.env` file

## Running the Bot

1. Start the bot:
```bash
npm start
```

2. The bot will start running and you can interact with it on Telegram by:
   - Searching for your bot's username
   - Starting a chat with the bot
   - Using the `/start` command to see available commands

## Available Commands

- `/start` - Show welcome message and basic instructions
- `/help` - List all available commands
- `/analyze <chain> <contract_address>` - Generate bubble map and token analysis
  - Example: `/analyze bsc 0x603c7f932ed1fc6575303d8fb018fdcbb0f39a95`

## Supported Chains

- `eth` - Ethereum
- `bsc` - Binance Smart Chain
- `ftm` - Fantom
- `avax` - Avalanche
- `cro` - Cronos
- `arbi` - Arbitrum
- `poly` - Polygon
- `base` - Base
- `sol` - Solana
- `sonic` - Sonic

## Dependencies

- `node-telegram-bot-api` - For Telegram bot functionality
- `canvas` - For image generation
- `ngraph.graph` and `ngraph.forcelayout` - For graph visualization
- `axios` - For API requests
- `dotenv` - For environment variable management

## Project Structure

```
bubblemaps-hackaton/
├── src/
│   ├── bot.js              # Main bot logic and command handlers
│   ├── services/
│   │   ├── bubblemaps.js   # Bubblemaps API integration
│   │   ├── coingecko.js    # CoinGecko API integration
│   │   └── visualizer.js   # Bubble map visualization
├── .env                    # Environment variables
├── index.js               # Application entry point
└── package.json           # Project dependencies
```

## Development

### Local Development with MAMP

1. Install MAMP from [https://www.mamp.info/](https://www.mamp.info/)
2. Place the project in the MAMP htdocs directory
3. Start MAMP servers
4. Run the bot using `npm start`

### Environment Variables

The bot requires the following environment variables:
- `TELEGRAM_BOT_TOKEN` - Your Telegram bot token

## Error Handling

The bot includes comprehensive error handling for:
- Invalid chain specifications
- Invalid contract addresses
- API rate limits
- Network errors
- Invalid token data

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Bubblemaps](https://bubblemaps.io/) for the token holder visualization API
- [CoinGecko](https://www.coingecko.com/) for the cryptocurrency data API
- [Telegram Bot API](https://core.telegram.org/bots/api) for the bot platform
