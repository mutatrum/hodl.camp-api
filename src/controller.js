const logger = require('./logger')

const Difficulty = require('./bitcoin/difficulty')
let difficulty

const Halvings = require('./bitcoin/halvings')
let halvings

const BitcoinPrices = require('./bitcoin/prices')
let bitcoinPrices

const GoldPrices = require('./gold/prices')
let goldPrices

const Inflation = require('./dollar/inflation')
let inflation

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

    inflation = new Inflation()
    inflation.init()
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

  this.getInflation = (since) => inflation.getInflation(since)
}
