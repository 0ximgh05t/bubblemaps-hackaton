const axios = require('axios');

class CoinGeckoService {
  constructor() {
    this.baseUrl = 'https://api.coingecko.com/api/v3';
    this.platformIds = {
      'eth': 'ethereum',
      'bsc': 'binance-smart-chain',
      'ftm': 'fantom',
      'avax': 'avalanche',
      'cro': 'cronos',
      'arbi': 'arbitrum-one',
      'poly': 'polygon-pos',
      'base': 'base'
    };
  }

  async getTokenPrice(contractAddress, chain, tokenSymbol, tokenName) {
    try {
      // For Solana and Sonic, use fallback mechanism directly
      if (chain === 'sol' || chain === 'sonic') {
        const coinsList = await this.getCoinsList();
        // Clean up symbol by removing $ if present
        const cleanSymbol = tokenSymbol.replace('$', '').toLowerCase();
        const cleanName = tokenName.toLowerCase();
        
        const tokenId = this.findTokenId(coinsList, cleanSymbol, cleanName);
        
        if (!tokenId) {
          throw new Error('Token not found on CoinGecko');
        }

        const response = await axios.get(`${this.baseUrl}/coins/${tokenId}`);
        return this.formatPriceData(response.data);
      }

      // For EVM chains, try contract endpoint first
      if (this.platformIds[chain]) {
        try {
          const response = await axios.get(`${this.baseUrl}/coins/${this.platformIds[chain]}/contract/${contractAddress}`);
          return this.formatPriceData(response.data);
        } catch (error) {
          console.log(`Contract endpoint failed for ${chain}, trying fallback...`);
          // Only proceed to fallback if contract endpoint fails
          const coinsList = await this.getCoinsList();
          const tokenId = this.findTokenId(coinsList, tokenSymbol, tokenName);
          
          if (!tokenId) {
            throw new Error('Token not found on CoinGecko');
          }

          const response = await axios.get(`${this.baseUrl}/coins/${tokenId}`);
          return this.formatPriceData(response.data);
        }
      } else {
        // For other chains not supported by contract endpoint, use fallback directly
        const coinsList = await this.getCoinsList();
        const tokenId = this.findTokenId(coinsList, tokenSymbol, tokenName);
        
        if (!tokenId) {
          throw new Error('Token not found on CoinGecko');
        }

        const response = await axios.get(`${this.baseUrl}/coins/${tokenId}`);
        return this.formatPriceData(response.data);
      }
    } catch (error) {
      console.error('Error fetching token price:', error);
      throw new Error('Failed to fetch token price data');
    }
  }

  async getCoinsList() {
    try {
      // Add rate limiting - wait 2 seconds between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
      const response = await axios.get(`${this.baseUrl}/coins/list`);
      return response.data;
    } catch (error) {
      console.error('Error fetching coins list:', error);
      throw new Error('Failed to fetch coins list');
    }
  }

  findTokenId(coinsList, symbol, name) {
    // Clean up symbol by removing $ if present and convert to lowercase
    const cleanSymbol = symbol.replace('$', '').toLowerCase();
    const cleanName = name.toLowerCase();

    // Find exact match (case-insensitive)
    const matches = coinsList.filter(coin => 
      coin.symbol.toLowerCase() === cleanSymbol && 
      coin.name.toLowerCase() === cleanName
    );

    // If we have multiple matches, prefer the one that matches case exactly
    if (matches.length > 0) {
      const exactMatch = matches.find(coin => 
        coin.symbol === symbol.replace('$', '') && 
        coin.name === name
      ) || matches[0]; // Fallback to first match if no exact case match

      return exactMatch.id;
    }

    return null;
  }

  formatPriceData(data) {
    return {
      usd: data.market_data.current_price.usd,
      usd_market_cap: data.market_data.market_cap.usd,
      usd_24h_vol: data.market_data.total_volume.usd,
      price_change_24h: data.market_data.price_change_percentage_24h
    };
  }

  formatNumber(num) {
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  }
}

module.exports = new CoinGeckoService(); 