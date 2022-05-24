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
    return res.send(controller.getPrices())
  })

  app.listen(port, () =>
    logger.log(`Listening on port ${port}`),
  )
}

function logRequest(req, res, next) {
  logger.log(`${req.method} ${req.url}`)
  next()
}
