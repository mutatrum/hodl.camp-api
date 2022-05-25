const logger = require('../logger')
const { formatDate } = require('../formatDate')

const https = require("https");
const cron = require("node-cron");

const URL = "https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?page_size=10000&metrics=PriceUSD&assets=btc";

module.exports = function() {

  let result = {
    since: '',
    prices: []
  }

  this.init = () => {
    retrievePrices()
    cron.schedule("0 0 * * * *", retrievePrices)
  }

  this.getPrices = (since) => {
    if (since) {
      const date = new Date(since)
      const start = new Date(result.since)
      const diff = (date - start) / 86400 / 1000
      return {
        since: formatDate(date),
        prices: result.prices.slice(diff)
      }
    }
    return result
  }

  function retrievePrices() {
    https.get(URL, res => {
      res.setEncoding('utf8');
      let body = '';
      res.on('data', chunk => body += chunk)
      res.on('end', () => process(JSON.parse(body)))
    }).on('error', e => logger.log(`Error: ${e}`))
  }

  function process(body) {
    result = {
      since: body.data[0].time.substring(0,10),
      prices: body.data.map(entry => Number(Number(entry.PriceUSD).toFixed(4)))
    }
  }
}
