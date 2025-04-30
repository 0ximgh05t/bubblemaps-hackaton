const axios = require('axios');

class BubblemapsService {
  constructor() {
    this.baseUrl = 'https://api-legacy.bubblemaps.io';
    this.appUrl = 'https://app.bubblemaps.io';
  }

  async getMapData(contractAddress, chain) {
    try {
      const response = await axios.get(`${this.baseUrl}/map-data`, {
        params: {
          chain,
          token: contractAddress
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching map data:', error.message);
      throw new Error('Failed to fetch map data');
    }
  }

  async getTokenMetadata(contractAddress, chain) {
    try {
      const response = await axios.get(`${this.baseUrl}/map-metadata`, {
        params: {
          chain,
          token: contractAddress
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching token metadata:', error.message);
      throw new Error('Failed to fetch token metadata');
    }
  }

  getBubbleMapUrl(contractAddress, chain) {
    return `${this.appUrl}/${chain}/token/${contractAddress}`;
  }
}

module.exports = new BubblemapsService(); 