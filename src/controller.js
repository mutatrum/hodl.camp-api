const logger = require('./logger')

const Difficulty = require('./bitcoin/difficulty')
let difficulty

const Halvings = require('./bitcoin/halvings')
let halvings

const BitcoinPrices = require('./bitcoin/prices')
let bitcoinPrices

const GoldPrices = require('./gold/prices')
let goldPrices

module.exports = function(bitcoin_rpc) {

  this.init = async () => {
    const networkInfo = await bitcoin_rpc.getNetworkInfo()
    logger.log(`connected to Bitcoin Core ${networkInfo.subversion} on ${bitcoin_rpc.getURI()}`)

    difficulty = new Difficulty(bitcoin_rpc)
    await difficulty.init()

    halvings = new Halvings(bitcoin_rpc)
    await halvings.init()

    bitcoinPrices = new BitcoinPrices()
    bitcoinPrices.init()

    goldPrices = new GoldPrices()
    goldPrices.init()
  }

  this.onBlockHeader = (blockHeader) => {
    logger.log(`Block ${blockHeader.height}`)

    difficulty.onBlockHeader(blockHeader)
    halvings.onBlockHeader(blockHeader)
  }

  this.getDifficulty = () => difficulty.getDifficulty()

  this.getHalvings = () => halvings.getHalvings()

  this.getBitcoinPrices = (since) => bitcoinPrices.getPrices(since)

  this.getGoldPrices = (since) => goldPrices.getPrices(since)
}
