const TelegramBot = require('node-telegram-bot-api');
const bubblemapsService = require('./services/bubblemaps');
const coingeckoService = require('./services/coingecko');
const visualizer = require('./services/visualizer');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Initialize and export the bot
function initBot(token) {
  // Validate token
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is not defined in .env. Obtain it from BotFather.');
  }

  // Create bot instance with polling enabled
  const bot = new TelegramBot(token, { polling: true });

  // /start command
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(
      chatId,
      'Welcome to the Bubblemaps Telegram Bot! 🚀\n\n' +
      'Use /analyze <chain> <contract_address> to get a bubble map and token insights.\n' +
      'Example: /analyze sol EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm\n\n' +
      'Available chains: eth, bsc, ftm, avax, cro, arbi, poly, base, sol, sonic'
    );
  });

  // /help command
  bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(
      chatId,
      'Available commands:\n' +
      '/analyze <chain> <contract_address> - Get bubble map and token data\n' +
      'Example: /analyze bsc 0x603c7f932ed1fc6575303d8fb018fdcbb0f39a95\n\n' +
      'Available chains: eth, bsc, ftm, avax, cro, arbi, poly, base, sol, sonic\n\n' +
      '/start - Show welcome message\n' +
      '/help - List available commands'
    );
  });

  // /analyze command
  bot.onText(/\/analyze (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const args = match[1].trim().split(/\s+/);
    
    // Check if we have both chain and contract address
    if (args.length < 2) {
      await bot.sendMessage(
        chatId,
        '❌ Please provide both chain and contract address.\n' +
        'Example: /analyze bsc 0x603c7f932ed1fc6575303d8fb018fdcbb0f39a95\n\n' +
        'Available chains: eth, bsc, ftm, avax, cro, arbi, poly, base, sol, sonic'
      );
      return;
    }
    
    const chain = args[0].toLowerCase();
    const contractAddress = args[1].trim();
    
    // Validate chain
    const validChains = ['eth', 'bsc', 'ftm', 'avax', 'cro', 'arbi', 'poly', 'base', 'sol', 'sonic'];
    if (!validChains.includes(chain)) {
      await bot.sendMessage(
        chatId,
        '❌ Invalid chain. Please use one of the following:\n' +
        'eth, bsc, ftm, avax, cro, arbi, poly, base, sol, sonic'
      );
      return;
    }

    // Validate contract address format
    if (chain === 'eth' || chain === 'bsc' || chain === 'ftm' || chain === 'avax' || chain === 'cro' || chain === 'arbi' || chain === 'poly' || chain === 'base') {
      if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
        await bot.sendMessage(
          chatId,
          `❌ Invalid contract address format for ${chain.toUpperCase()}. Please provide a valid contract address.`
        );
        return;
      }
    } else if (chain === 'sol') {
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(contractAddress)) {
        await bot.sendMessage(
          chatId,
          '❌ Invalid Solana address format. Please provide a valid Solana address.'
        );
        return;
      }
    } else if (chain === 'sonic') {
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(contractAddress)) {
        await bot.sendMessage(
          chatId,
          '❌ Invalid Sonic address format. Please provide a valid Sonic address.'
        );
        return;
      }
    }

    try {
      // Send initial message
      const processingMsg = await bot.sendMessage(chatId, '🔍 Analyzing token and generating bubble map...');

      // Get map data first
      const [mapData, metadata] = await Promise.all([
        bubblemapsService.getMapData(contractAddress, chain),
        bubblemapsService.getTokenMetadata(contractAddress, chain)
      ]);

      // Generate bubble map image
      const imageBuffer = await visualizer.generateImage(mapData);

      // Create a temporary file
      const tempDir = os.tmpdir();
      const tempFilePath = path.join(tempDir, `bubble-map-${Date.now()}.png`);
      fs.writeFileSync(tempFilePath, imageBuffer);

      try {
        // Format decentralization score
        const decentralizationScore = metadata.decentralisation_score.toFixed(1);
        
        // Send the bubble map image with caption
        await bot.sendPhoto(chatId, tempFilePath, {
          caption: `Bubble Map - ${metadata.identified_supply.percent_in_contracts.toFixed(1)}% of ${mapData.symbol} supply is in contracts\n` +
                   `🕒 Last updated: ${mapData.dt_update}`,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: "📊 View on Bubblemaps", url: bubblemapsService.getBubbleMapUrl(contractAddress, chain) }]
            ]
          }
        });

        // Calculate top 10 holders percentage excluding contracts
        const nonContractHolders = mapData.nodes
          .filter(node => !node.is_contract)
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 10);
        
        const top10HoldersExcludingContracts = nonContractHolders
          .reduce((sum, node) => sum + node.percentage, 0)
          .toFixed(1);

        // Try to get price data, but don't fail if it doesn't work
        let priceData = null;
        try {
          priceData = await coingeckoService.getTokenPrice(
            contractAddress, 
            chain, 
            mapData.symbol, 
            mapData.full_name
          );
        } catch (error) {
          console.error('Error fetching token price:', error);
          // Continue without price data
        }

        // Prepare token info message with or without price data
        let tokenInfoMessage = `*${mapData.full_name} (${mapData.symbol})*\n\n`;
        
        if (priceData) {
          tokenInfoMessage += 
            `💰 *Price:* $${priceData.usd.toFixed(2)}\n` +
            `📊 *Market Cap:* ${coingeckoService.formatNumber(priceData.usd_market_cap)}\n` +
            `📈 *24h Volume:* ${coingeckoService.formatNumber(priceData.usd_24h_vol)}\n` +
            `${priceData.price_change_24h >= 0 ? '🟢' : '🔴'} *24h Change:* ${priceData.price_change_24h.toFixed(2)}%\n\n`;
        } else {
          tokenInfoMessage += '⚠️ *Price data not available*\n\n';
        }

        tokenInfoMessage += 
          `🌐 *Supply Analysis*\n` +
          `• *Decentralization Score:* ${decentralizationScore}%\n` +
          `• *In CEXs:* ${metadata.identified_supply.percent_in_cexs.toFixed(1)}%\n` +
          `• *In Contracts:* ${metadata.identified_supply.percent_in_contracts.toFixed(1)}%\n\n` +
          `👥 *Holder Analysis*\n` +
          `• Top 10 holders control ${top10HoldersExcludingContracts}% (excluding contracts)`;

        // Send token info and analysis
        await bot.sendMessage(
          chatId,
          tokenInfoMessage,
          { 
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "🔄 Refresh", callback_data: `refresh_${chain}_${contractAddress}` }
                ]
              ]
            }
          }
        );

      } finally {
        // Clean up the temporary file
        fs.unlinkSync(tempFilePath);
      }

      // Delete processing message
      await bot.deleteMessage(chatId, processingMsg.message_id);

    } catch (error) {
      console.error('Error in /analyze command:', error);
      await bot.sendMessage(
        chatId,
        '❌ Sorry, there was an error analyzing this token. Please try again later.'
      );
    }
  });

  // Handle callback queries
  bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    const messageId = callbackQuery.message.message_id;

    try {
      if (data.startsWith('refresh_')) {
        const [_, chain, contractAddress] = data.split('_');
        // Show loading message
        await bot.answerCallbackQuery(callbackQuery.id, { text: 'Refreshing data...' });
        await bot.editMessageText('🔄 Refreshing data...', { chat_id: chatId, message_id: messageId });
        
        // Get map data first
        const [mapData, metadata] = await Promise.all([
          bubblemapsService.getMapData(contractAddress, chain),
          bubblemapsService.getTokenMetadata(contractAddress, chain)
        ]);

        // Then get price data using the map data
        const priceData = await coingeckoService.getTokenPrice(
          contractAddress, 
          chain, 
          mapData.symbol, 
          mapData.full_name
        );

        // Format decentralization score
        const decentralizationScore = metadata.decentralisation_score.toFixed(1);

        const replyMarkup = {
          inline_keyboard: [
            [
              { text: "🔄 Refresh", callback_data: `refresh_${chain}_${contractAddress}` }
            ]
          ]
        };

        // Calculate top 10 holders percentage excluding contracts
        const nonContractHolders = mapData.nodes
          .filter(node => !node.is_contract)
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 10);
        
        const top10HoldersExcludingContracts = nonContractHolders
          .reduce((sum, node) => sum + node.percentage, 0)
          .toFixed(1);

        // Update the message with fresh data
        await bot.editMessageText(
          `*${mapData.full_name} (${mapData.symbol})*\n\n` +
          `💰 *Price:* $${priceData.usd.toFixed(2)}\n` +
          `📊 *Market Cap:* ${coingeckoService.formatNumber(priceData.usd_market_cap)}\n` +
          `📈 *24h Volume:* ${coingeckoService.formatNumber(priceData.usd_24h_vol)}\n` +
          `${priceData.price_change_24h >= 0 ? '🟢' : '🔴'} *24h Change:* ${priceData.price_change_24h.toFixed(2)}%\n\n` +
          `🌐 *Supply Analysis*\n` +
          `• *Decentralization Score:* ${decentralizationScore}%\n` +
          `• *In CEXs:* ${metadata.identified_supply.percent_in_cexs.toFixed(1)}%\n` +
          `• *In Contracts:* ${metadata.identified_supply.percent_in_contracts.toFixed(1)}%\n\n` +
          `👥 *Holder Analysis*\n` +
          `• Top 10 holders control ${top10HoldersExcludingContracts}% (excluding contracts)`,
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: replyMarkup
          }
        );
      }
    } catch (error) {
      console.error('Error handling callback query:', error);
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Error processing request. Please try again.' });
    }
  });

  return bot;
}

module.exports = initBot; 