const logger = require('./logger')

const Difficulty = require('./bitcoin/difficulty')
const Halvings = require('./bitcoin/halvings')
const BitcoinPrices = require('./bitcoin/prices')
const GoldPrices = require('./gold/prices')
const Inflation = require('./dollar/inflation')
const SatsPerDollar = require('./image/sats_per_dollar')

module.exports = function(bitcoin_rpc) {
  const difficulty = new Difficulty(bitcoin_rpc)
  const halvings = new Halvings(bitcoin_rpc)
  const bitcoinPrices = new BitcoinPrices()
  const goldPrices = new GoldPrices()
  const inflation = new Inflation()
  const satsPerDollar = new SatsPerDollar()

  this.init = async () => {
    const networkInfo = await bitcoin_rpc.getNetworkInfo()
    logger.log(`connected to Bitcoin Core ${networkInfo.subversion} on ${bitcoin_rpc.getURI()}`)

    await difficulty.init()

    await halvings.init()

    bitcoinPrices.init()

    goldPrices.init()

    inflation.init()

    satsPerDollar.init()
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

  this.getSatsPerDollar = (fiat, sats) => satsPerDollar.get(fiat, sats)
}
