const logger = require('./logger')
const express = require('express')

module.exports = function(port, controller) {

  const app = express()

  app.get('/api/bitcoin/difficulty', (req, res) => {
    return res.send(controller.getDifficulty())
  })
  
  app.listen(port, () =>
    logger.log(`Listening on port ${port}`),
  )
}
