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

  app.get('/api/img/sats_per_:fiat/:sats', (req, res) => {
    if (req.headers['if-none-match']) return res.sendStatus(304)

    let result = controller.getSatsPerDollar(req.params.fiat, req.params.sats)
    if (result) {
      return res
        .contentType('png')
        .set('Cache-Control', 'public, max-age=31536000, immutable')
        .send(result)
    }
    return res.sendStatus(404)
  })

  app.get('*', function(req, res) {
    return res.sendStatus(404)
  });

  app.listen(port, () =>
    logger.log(`Listening on port ${port}`),
  )
}

function logRequest(req, res, next) {
  logger.log(`${req.method} ${req.url}`)
  next()
}
