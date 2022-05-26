const logger = require('./logger')
const express = require('express')

module.exports = function(port, controller) {

  const app = express()

  app.use(logRequest)

  app.get('/api/bitcoin/difficulty', (req, res) => {
    return res.send(controller.getDifficulty())
  })

  app.get('/api/bitcoin/halvings', (req, res) => {
    return res.send(controller.getHalvings())
  })

  app.get('/api/bitcoin/prices', (req, res) => {
    return res.send(controller.getBitcoinPrices(req.query.since))
  })

  app.get('/api/gold/prices', (req, res) => {
    return res.send(controller.getGoldPrices(req.query.since))
  })

  app.get('/api/dollar/inflation', (req, res) => {
    return res.send(controller.getInflation(req.query.since))
  })

  app.listen(port, () =>
    logger.log(`Listening on port ${port}`),
  )
}

function logRequest(req, res, next) {
  logger.log(`${req.method} ${req.url}`)
  next()
}
