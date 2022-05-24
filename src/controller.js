const logger = require('./logger')

const Difficulty = require('./bitcoin/difficulty')
let difficulty

const Halvings = require('./bitcoin/halvings')
let halvings

const Prices = require('./bitcoin/prices')
let prices

module.exports = function(bitcoin_rpc) {

  this.init = async () => {
    const networkInfo = await bitcoin_rpc.getNetworkInfo()
    logger.log(`connected to Bitcoin Core ${networkInfo.subversion} on ${bitcoin_rpc.getURI()}`)

    difficulty = new Difficulty(bitcoin_rpc)
    await difficulty.init()

    halvings = new Halvings(bitcoin_rpc)
    await halvings.init()

    prices = new Prices()
    await prices.init()
  }

  this.onBlockHeader = async (blockHeader) => {
    await difficulty.onBlockHeader(blockHeader)
    await halvings.onBlockHeader(blockHeader)
  }

  this.getDifficulty = () => difficulty.getDifficulty()

  this.getHalvings = () => halvings.getHalvings()

  this.getPrices = () => prices.getPrices()
}
