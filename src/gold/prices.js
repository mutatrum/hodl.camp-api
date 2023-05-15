const logger = require('../logger')
const { formatDate } = require('../formatDate')

const https = require("https");
const cron = require("node-cron");

module.exports = function(nasdaq) {

  const URL = `https://data.nasdaq.com/api/v3/datasets/11304240/data?collapse=daily&api_key=${nasdaq.apiKey}`
  
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
    https.get(URL, { headers : { "accept" : "application/json" }}, res => {
      res.setEncoding("utf8");
      let body = "";
      res.on("data", chunk => body += chunk)
      res.on("end", () => process(JSON.parse(body)))
    }).on('error', e => logger.log(`Error: ${e}`));
  }

  function process(body) {
    if (!body.dataset_data) {
      logger.log(`Error: ${JSON.stringify(body)}`)
      return
    }
    if (!body.dataset_data.hasOwnProperty('column_names')) {
      logger.log(`Error: ${JSON.stringify(body)}`)
      return
    }
    const dateColumn = body.dataset_data.column_names.indexOf('Date')
    const priceColumn = body.dataset_data.column_names.indexOf('USD (AM)')

    var today = new Date()
    today.setDate(today.getDate() - 1)

    var date = new Date(body.dataset_data.start_date)
    var i = body.dataset_data.data.length - 1
    var currentPrice

    const prices = []
    while (date < today) {
      var currentDate = formatDate(date)
      if (i >= 0 && body.dataset_data.data[i][dateColumn] == currentDate) {
        currentPrice = body.dataset_data.data[i][priceColumn];
        i--
      }
      if (currentPrice == undefined) {
        currentPrice = prices[prices.length - 1]
      }
      prices.push(currentPrice)
      date.setDate(date.getDate() + 1)
    }
    result = {
      since: body.dataset_data.start_date,
      prices: prices
    }
  }
}
