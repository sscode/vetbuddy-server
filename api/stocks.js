//stocks.js
const axios = require('axios');

// Define a function to fetch historical stock data
async function fetchHistoricalStockData(stockList, range) {
  const baseUrl = 'https://api.iex.cloud/v1/data/core/historical_prices/';

  const token = process.env.IEXCLOUD_API_KEY;

  try {
    const response = await axios.get(`${baseUrl}${stockList}?range=${range}&token=${token}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching historical stock data:', error);
    return "Error fetching historical stock data"
    // res.status(500).send('Error fetching historical stock data');
  }
}

function combineQuotesWithPortfolios(stockQuotes, portfolios) {
    return portfolios.map(portfolio => {
      const { stocks } = portfolio;
  
      const portfolioWithQuotes = stocks.map(stockPosition => {
        const { stock: stockSymbol, quantity } = stockPosition;
  
        const stockData = (stockQuotes || []).filter(quote => quote.symbol === stockSymbol)
          .map((quote, index, array) => {
            const prevClose = array[index + 1]?.close || 0;
            const currentClose = quote.close || 0;
            const prevPriceChangeDollar = currentClose - prevClose;
            const prevPriceChangePercentage = (prevPriceChangeDollar / prevClose) * 100;
  
            return {
              ...quote,
              prevPriceChangeDollar,
              prevPriceChangePercentage,
            };
          });
  
        const latestPrice = stockData[0]?.close || 0;
        const totalValue = quantity * latestPrice;
        const PriceChangePercentageYesterday = (latestPrice - stockData[0]?.open || 0) / (stockData[0]?.open || 1) * 100;
        const PriceChangePercentageThirty = (latestPrice - stockData[24]?.close || 0) / (stockData[29]?.close || 1) * 100;
        const PriceChangePercentageNinety = (latestPrice - stockData[65]?.close || 0) / (stockData[65]?.close || 1) * 100;
  
        return {
          symbol: stockSymbol,
          quantity,
          latestPrice,
          totalValue,
          PriceChangePercentageYesterday,
          PriceChangePercentageThirty,
          PriceChangePercentageNinety,
        };
      });
  
      const totalPortfolioValue = portfolioWithQuotes.reduce((acc, position) => acc + position.totalValue, 0);
  
      portfolioWithQuotes.forEach(position => {
        position.weight = position.totalValue / totalPortfolioValue * 100;
      });

      console.log(portfolioWithQuotes);
  
      return {
        ...portfolio,
        stocks: portfolioWithQuotes,
      };
    });
  }
  
  

module.exports = { fetchHistoricalStockData, combineQuotesWithPortfolios };