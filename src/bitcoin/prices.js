const logger = require('../logger')

const https = require("https");
const cron = require("node-cron");

const URL = "https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?page_size=10000&metrics=PriceUSD&assets=btc";

module.exports = function() {

  const result = {
    since: '',
    prices: []
  }

  this.init = async () => {
    retrievePrices()
    cron.schedule("0 0 * * * *", retrievePrices)
  }

  this.getPrices = () => result

  function retrievePrices() {
    https.get(URL, res => {
        res.setEncoding("utf8");
        let body = "";
        res.on("data", chunk => body += chunk)
        res.on("end", () => process(JSON.parse(body)))
    }).on('error', (e) => {
      logger.log(`Error: ${e}`);
    })
  }

  function process(body) {
    result.since = body.data[0].time.substring(0,10);
    result.prices = body.data.map(entry => Number(Number(entry.PriceUSD).toFixed(4)));
  }
}
